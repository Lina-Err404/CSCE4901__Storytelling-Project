import { NextRequest, NextResponse } from "next/server";
import { getLobbyById } from "@/lib/mockLobbyData";
import {
  replaceBreakoutRooms,
  BreakoutRoom,
} from "@/lib/breakoutRooms";

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ lobbyId: string }> }
) {
  try {
    const { lobbyId } = await context.params;

    // Find the requested lobby.
    const lobby = getLobbyById(lobbyId);

    if (!lobby) {
      return NextResponse.json(
        {
          success: false,
          error: "Lobby not found.",
        },
        { status: 404 }
      );
    }

    // Return the students and current breakout room assignments.
    return NextResponse.json(
      {
        success: true,
        students: lobby.students,
        rooms: lobby.breakoutRooms,
      },
      { status: 200 }
    );
  } catch (error) {
    console.error("Breakout room retrieval error:", error);

    return NextResponse.json(
      {
        success: false,
        error: "Internal server error.",
      },
      { status: 500 }
    );
  }
}

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ lobbyId: string }> }
) {
  try {
    const { lobbyId } = await context.params;

    // Safely parse the request body.
    const body = await request.json().catch(() => null);

    if (!body || typeof body !== "object") {
      return NextResponse.json(
        {
          success: false,
          error: "Invalid JSON body.",
        },
        { status: 400 }
      );
    }

    const teacherId =
      typeof body.teacherId === "string"
        ? body.teacherId.trim()
        : "";

    const rooms: BreakoutRoom[] = body.rooms;

    // Make sure the request contains the required data.
    if (!teacherId || !Array.isArray(rooms)) {
      return NextResponse.json(
        {
          success: false,
          error: "teacherId and rooms are required.",
        },
        { status: 400 }
      );
    }

    // Find the requested lobby.
    const lobby = getLobbyById(lobbyId);

    if (!lobby) {
      return NextResponse.json(
        {
          success: false,
          error: "Lobby not found.",
        },
        { status: 404 }
      );
    }

    // Only the teacher assigned to this lobby can change its rooms.
    if (lobby.teacherId !== teacherId) {
      return NextResponse.json(
        {
          success: false,
          error: "You do not have permission to manage this lobby.",
        },
        { status: 403 }
      );
    }

    // Validate and replace the current breakout room assignments.
    const result = replaceBreakoutRooms(
      lobby,
      teacherId,
      rooms
    );

    if (!result.success) {
      return NextResponse.json(
        result,
        { status: 400 }
      );
    }

    return NextResponse.json(
      result,
      { status: 200 }
    );
  } catch (error) {
    console.error(
      "Breakout room assignment error:",
      error
    );

    return NextResponse.json(
      {
        success: false,
        error: "Internal server error.",
      },
      { status: 500 }
    );
  }
}