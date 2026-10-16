
import { NextRequest, NextResponse } from "next/server";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const lobbyCode = body.lobbyCode;

    // Make sure the student entered a lobby code
    if (typeof lobbyCode !== "string" || !lobbyCode.trim()) {
      return NextResponse.json(
        { error: "Please enter a lobby code." },
        { status: 400 }
      );
    }

    // Lobby lookup will be connected to the database later.
    return NextResponse.json(
      {
        error: "Lobby validation is not connected yet.",
      },
      { status: 501 }
    );
  } catch {
    return NextResponse.json(
      { error: "Invalid request." },
      { status: 400 }
    );
  }
}
