import { NextRequest, NextResponse } from "next/server";

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

    //saving the prompt to the lobby when connected
    // it just returns an error because the prompt isnt saved as of now
    return NextResponse.json(
      { error: "Starting prompt saved when it gets connected." },
      {status: 501 } //not implemented yet
    );
  } catch {
    return NextResponse.json(
      { error: "Invalid request." },
      { status: 400 }
    );
  }
}