import { NextResponse } from "next/server";
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
}