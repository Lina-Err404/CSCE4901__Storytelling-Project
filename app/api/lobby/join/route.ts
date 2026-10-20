
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/firebaseAdmin";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const lobbyCode = body.lobbyCode;

    // Make sure the student entered a valid 6-character code
    if (
      typeof lobbyCode !== "string" ||
      !/^[a-zA-Z0-9]{6}$/.test(lobbyCode.trim())
    ) {
      return NextResponse.json(
        { error: "Please enter a valid 6-character lobby code." },
        { status: 400 }
      );
    }

    // Convert the code to uppercase so lookup is case insensitive
    const code = lobbyCode.trim().toUpperCase();

    const lobbyRef = db.collection("Lobbies").doc(code);
    const lobbyDoc = await lobbyRef.get();

    // Lobby code does not exist
    if (!lobbyDoc.exists) {
      return NextResponse.json(
        { error: "Lobby not found." },
        { status: 404 }
      );
    }

    const lobby = lobbyDoc.data();

    // Lobby has already started
    if (lobby?.status !== "open") {
      return NextResponse.json(
        { error: "Lobby has already started." },
        { status: 409 }
      );
    }

    // Lobby has reached its player limit
    if (
      typeof lobby.playerCount === "number" &&
      typeof lobby.maxPlayers === "number" &&
      lobby.playerCount >= lobby.maxPlayers
    ) {
      return NextResponse.json(
        { error: "Lobby is full." },
        { status: 409 }
      );
    }

    return NextResponse.json(
      {
        success: true,
        code,
      },
      { status: 200 }
    );
  } catch (error) {
    console.error("Join lobby error:", error);

    return NextResponse.json(
      { error: "Unable to join lobby." },
      { status: 500 }
    );
  }
}