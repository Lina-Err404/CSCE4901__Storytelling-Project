import { NextResponse } from "next/server";
import { adminAuth, db } from "@/lib/firebaseAdmin";

export const runtime = "nodejs";
const generationLimit = 3;
const usageRef = (uid: string) => db.collection("writingSuggestionUsage").doc(uid);
const remaining = (data: { used?: number } | undefined) => generationLimit - (data?.used ?? 0);
const exhausted = () => NextResponse.json({ remainingGenerations: 0 }, { status: 429 });
const unauthorized = () => NextResponse.json({ error: "Authentication required." }, { status: 401 });
const unavailable = () => NextResponse.json({ error: "Could not check idea usage. Please try again." }, { status: 503 });

async function authenticatedUid(req: Request) {
  const token = req.headers.get("authorization")?.match(/^Bearer ([^\s]+)$/i)?.[1];
  if (!token) return null;
  try {
    const { uid } = await adminAuth.verifyIdToken(token, true);
    return /^[A-Za-z0-9_-]{1,128}$/.test(uid) ? uid : null;
  } catch { return null; }
}

export async function GET(req: Request) {
  const uid = await authenticatedUid(req);
  if (!uid) return unauthorized();
  try {
    const snapshot = await usageRef(uid).get();
    return NextResponse.json({ remainingGenerations: remaining(snapshot.data()) }, {
      headers: { "Cache-Control": "private, no-store" },
    });
  } catch { return unavailable(); }
}

async function deliverIdeas(uid: string, ideas: string[], signal: AbortSignal, demo = false) {
  try {
    const ref = usageRef(uid);
    const left = await db.runTransaction(async tx => {
      const snapshot = await tx.get(ref);
      const available = remaining(snapshot.data());
      signal.throwIfAborted();
      if (available <= 0) return null;
      tx.set(ref, { used: generationLimit - available + 1 });
      return available - 1;
    });
    return left === null ? exhausted() : NextResponse.json({ ideas, remainingGenerations: left, ...(demo ? { demo } : {}) });
  } catch { return unavailable(); }
}

export async function POST(req: Request) {
  const uid = await authenticatedUid(req);
  if (!uid) return unauthorized();
  let input: unknown;
  try {
    const reader = req.body?.getReader();
    if (!reader) throw new Error();
    const chunks: Uint8Array[] = []; let size = 0;
    try { while (true) { const { done, value } = await reader.read(); if (done) break; size += value.length; if (size > 500000) { await reader.cancel(); throw new Error(); } chunks.push(value); } } finally { reader.releaseLock(); }
    input = JSON.parse(Buffer.concat(chunks, size).toString("utf8"));
  } catch { return NextResponse.json({ error: "Invalid or oversized request." }, { status: 400 }); }
  if (!input || typeof input !== "object" || !("text" in input) || !("mode" in input) || typeof input.text !== "string" || input.text.length > 100000 || typeof input.mode !== "string" || !["grammar", "generate"].includes(input.mode)) return NextResponse.json({ error: "Invalid text or mode." }, { status: 400 });
  const { text, mode } = input;
  if (mode === "generate") {
    try {
      const snapshot = await usageRef(uid).get();
      if (remaining(snapshot.data()) <= 0) return exhausted();
    } catch { return unavailable(); }
  }
  try {

    if (mode === "grammar" && !text.trim()) {
      return NextResponse.json({ grammar: [], ideas: [] });
    }

    const apiKey = process.env.GROQ_API_KEY?.trim();

    // Preserve teammate demo responses only when explicitly enabled outside production.
    if (!apiKey) {
      if (process.env.NODE_ENV === "production" || process.env.SUGGESTIONS_DEMO_MODE !== "true") return NextResponse.json({ error: "Writing assistance is not configured." }, { status: 503 });
      if (mode === "generate") {
        return deliverIdeas(uid, [
            "She spotted a glowing golden key hidden inside a hollow tree trunk.",
            "The strange bird dropped a tiny rolled-up map right at her feet.",
            "A friendly talking squirrel hopped onto a branch and offered to guide her.",
        ], req.signal, true);
      }
      return NextResponse.json({
        demo: true,
        grammar: [
          {
            id: "demo-1",
            original: "walk",
            replacement: "walked",
            explanation: "Use past tense to match the rest of your story.",
          },
          {
            id: "demo-2",
            original: "see",
            replacement: "saw",
            explanation: "Change 'see' to past tense 'saw'.",
          },
          {
            id: "demo-3",
            original: "were",
            replacement: "was",
            explanation: "Use 'was' with 'She'.",
          },
          {
            id: "demo-4",
            original: "don't",
            replacement: "didn't",
            explanation: "Use past tense 'didn't' instead of 'don't'.",
          },
        ],
      });
    }

    const systemPrompt =
        mode === "generate"
            ? `You are a friendly creative writing buddy for kids aged 8 to 13.
Read the student's story excerpt and suggest 3 fun, imaginative, age-appropriate ONE-LINE ideas for what could happen next to continue the story.
If the excerpt is blank, suggest 3 opening lines instead.
Return ONLY a JSON object in this exact format:
{
  "ideas": [
    "One short sentence idea 1.",
    "One short sentence idea 2.",
    "One short sentence idea 3."
  ]
}`
            : `You are a friendly grammar helper for kids aged 8 to 13.
Find grammar or spelling mistakes in the student's story excerpt.
Return ONLY a JSON object in this exact format:
{
  "grammar": [
    {
      "id": "g-1",
      "original": "exact word or phrase from the text",
      "replacement": "corrected word or phrase",
      "explanation": "Short, kid-friendly 1-sentence explanation."
    }
  ]
}`;

    const response = await fetch(
        "https://api.groq.com/openai/v1/chat/completions",
        {
          method: "POST",
          signal: AbortSignal.any([req.signal, AbortSignal.timeout(20000)]),
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${apiKey}`,
          },
          body: JSON.stringify({
            model: "openai/gpt-oss-120b",
            response_format: { type: "json_object" },
            temperature: mode === "generate" ? 0.7 : 0.2,
            max_completion_tokens: 500,
            messages: [
              { role: "system", content: systemPrompt },
              { role: "user", content: text },
            ],
          }),
        }
    );

    if (!response.ok) {
      return NextResponse.json(
          { error: "Groq API request failed." },
          { status: response.status }
      );
    }

    const completion = await response.json();
    const rawContent = completion.choices?.[0]?.message?.content || "{}";
    const parsed = JSON.parse(rawContent);

    const validIdeas = Array.isArray(parsed.ideas) && parsed.ideas.length === 3 && parsed.ideas.every((idea: unknown) => typeof idea === "string" && idea.trim().length > 0 && idea.length <= 2000);
    const validGrammar = Array.isArray(parsed.grammar) && parsed.grammar.length <= 100 && parsed.grammar.every((item: unknown) => {
      if (!item || typeof item !== "object" || !("original" in item) || !("replacement" in item)) return false;
      return typeof item.original === "string" && item.original.trim().length > 0 && item.original.length <= 100000 && typeof item.replacement === "string" && item.replacement.length <= 100000 && (!("explanation" in item) || typeof item.explanation === "string");
    });
    if (mode === "generate" ? !validIdeas : !validGrammar) throw new Error("Invalid provider response");
    if (mode === "generate") return deliverIdeas(uid, parsed.ideas, req.signal);
    return NextResponse.json({ grammar: parsed.grammar });
  } catch {
    return NextResponse.json(
        { error: "Could not generate suggestions. Please try again." },
        { status: 502 }
    );
  }
}
