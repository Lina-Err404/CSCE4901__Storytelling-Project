import { NextRequest, NextResponse } from "next/server";
import { db } from "../../../lib/firebaseAdmin";

//this gets the teachers custom starting prompt
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    //this is to reject prompts that arent formatted right
    if(!body || typeof body !== "object" || Array.isArray(body)) {
      return NextResponse.json(
        { error: "Invalid request." },
        {status: 400 } // means request isnt valid
      );
    }

    const VALID_PROMPT_TYPES = ["custom", "random", "none"] as const;
    const VALID_ASSIGNMENT_TYPES = ["entire-class", "different-groups", "randomized"] as const;
    const { promptType, promptText, assignmentType } = body as Record<string, unknown>;

    if (typeof promptType !== "string" || !VALID_PROMPT_TYPES.includes(promptType as never)) {
      return NextResponse.json({ error: "Invalid prompt mode." }, { status: 400 });
    }
    if (typeof assignmentType !== "string" || !VALID_ASSIGNMENT_TYPES.includes(assignmentType as never)) {
      return NextResponse.json({ error: "Invalid assignment type." }, { status: 400 });
    }
    if (promptType === "custom" && (typeof promptText !== "string" || !promptText.trim())) {
      return NextResponse.json({ error: "Please enter a starting prompt." }, { status: 400 });
    }

        const startingPrompt =
      promptType === "custom" ? (promptText as string).trim() : "";

    try {
      await db.collection("Lobbies").doc("B9WD4X").set(
        {
          startingPrompt,
          promptType,
          assignmentType,
        },
        { merge: true }
      );

      return NextResponse.json({ message: "Starting prompt saved." });
    } catch (error) {
      console.error("Could not save starting prompt:", error);
      return NextResponse.json(
        { error: "Could not save starting prompt." },
        { status: 500 }
      );
    }
  }  catch {
    return NextResponse.json(
      { error: "Invalid request." },
      { status: 400 }
    );
  }
}
