/*import { NextResponse } from "next/server";
import Groq from "groq-sdk";

const groq = new Groq({
  apiKey: process.env.GROQ_API_KEY || "",
});

export async function POST(req: Request) {
  try {
    const { text } = await req.json();

    if (!process.env.GROQ_API_KEY) {
      return NextResponse.json({
        suggestion: `[Demo Mode] Received snippet: "${text}". Add GROQ_API_KEY to .env.local for live AI output.`,
      });
    }

    const completion = await groq.chat.completions.create({
      model: "llama-3.3-70b-versatile",
      messages: [
        {
          role: "system",
          content:
            "You are a creative writing assistant. Give a concise suggestion to improve narrative pacing and imagery for the user's story excerpt.",
        },
        { role: "user", content: text },
      ],
      max_tokens: 250,
    });

    return NextResponse.json({
      suggestion:
        completion.choices[0]?.message?.content ?? "No suggestion generated.",
    });
  } catch (error) {
    return NextResponse.json(
      { error: "Failed to generate suggestions." },
      { status: 500 }
    );
  }
}*/
import { NextResponse } from "next/server";

export async function POST(req: Request) {
  try {
    const { text, mode } = await req.json();

    if (!text || !text.trim()) {
      return NextResponse.json({ grammar: [], ideas: [] });
    }

    const apiKey = process.env.GROQ_API_KEY;

    // Fallback Demo Mode if GROQ_API_KEY is not set in .env.local
    if (!apiKey) {
      if (mode === "generate") {
        return NextResponse.json({
          ideas: [
            "She spotted a glowing golden key hidden inside a hollow tree trunk.",
            "The strange bird dropped a tiny rolled-up map right at her feet.",
            "A friendly talking squirrel hopped onto a branch and offered to guide her.",
          ],
        });
      }
      return NextResponse.json({
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

    return NextResponse.json({
      grammar: Array.isArray(parsed.grammar) ? parsed.grammar : [],
      ideas: Array.isArray(parsed.ideas) ? parsed.ideas : [],
    });
  } catch (error) {
    console.error("Groq suggestion error:", error);
    return NextResponse.json(
        { error: "git add app/api/suggestions/route.tsFailed to generate suggestions." },
        { status: 500 }
    );
  }
}