import { NextRequest, NextResponse } from "next/server";
import { FieldValue } from "firebase-admin/firestore";
import { adminAuth, db } from "@/lib/firebaseAdmin";

export async function POST(request: NextRequest) {
  try {
    // Make sure the student is authenticated (supports dev/emulator header bypass from main)
    const authHeader = request.headers.get("authorization");
    const devBypassEnabled =
      process.env.NODE_ENV !== "production" &&
      (process.env.ALLOW_DEV_MODE === "true" ||
        process.env.USE_AUTH_EMULATOR === "true" ||
        process.env.NEXT_PUBLIC_USE_AUTH_EMULATOR === "true");
    const devStudentUid = request.headers.get("x-test-student-uid");

    let uid: string | undefined;

    if (devBypassEnabled && devStudentUid && devStudentUid.trim().length > 0) {
      uid = devStudentUid.trim();
    } else if (authHeader?.startsWith("Bearer ")) {
      try {
        const decoded = await adminAuth.verifyIdToken(
          authHeader.slice(7).trim()
        );
        uid = decoded.uid;
      } catch {
        return NextResponse.json(
          { error: "Authentication required." },
          { status: 401 }
        );
      }
    }

    if (!uid) {
      return NextResponse.json(
        { error: "Authentication required." },
        { status: 401 }
      );
    }

    // Safely read the request body (accepts either lobbyCode or code)
    const body = await request.json().catch(() => null);
    const record =
      body && typeof body === "object"
        ? (body as Record<string, unknown>)
        : null;

    const lobbyCode = record?.lobbyCode ?? record?.code;

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

    // Check and update the lobby safely in one transaction
    const result = await db.runTransaction(async (tx) => {
      const lobbyDoc = await tx.get(lobbyRef);

      // Lobby code does not exist
      if (!lobbyDoc.exists) {
        return {
          errorResponse: NextResponse.json(
            { error: "Lobby not found." },
            { status: 404 }
          ),
        };
      }

      const lobby = lobbyDoc.data();

      // Lobby has already started
      if (lobby?.status !== "open") {
        return {
          errorResponse: NextResponse.json(
            { error: "Lobby has already started." },
            { status: 409 }
          ),
        };
      }

      // If the lobby belongs to a class in Firestore, verify student enrollment
      if (typeof lobby.classId === "string" && lobby.classId.length > 0) {
        const classRef = db.collection("classes").doc(lobby.classId);
        const classDoc = await tx.get(classRef);
        if (classDoc.exists) {
          const classData = classDoc.data();
          if (
            Array.isArray(classData?.studentIds) &&
            !classData.studentIds.includes(uid)
          ) {
            return {
              errorResponse: NextResponse.json(
                { error: "Student is not enrolled in this class." },
                { status: 403 }
              ),
            };
          }
        }
      }

      const participantIds = Array.isArray(lobby.participantIds)
        ? lobby.participantIds
        : [];
      const currentCount =
        typeof lobby.playerCount === "number" && lobby.playerCount >= 0
          ? lobby.playerCount
          : 0;

      // Do not count the same student twice
      if (participantIds.includes(uid)) {
        return {
          playerCount: currentCount,
          alreadyJoined: true,
        };
      }

      // Lobby has reached its player limit
      if (
        typeof lobby.playerCount !== "number" ||
        typeof lobby.maxPlayers !== "number" ||
        lobby.maxPlayers < 1 ||
        lobby.playerCount >= lobby.maxPlayers
      ) {
        return {
          errorResponse: NextResponse.json(
            { error: "Lobby is full." },
            { status: 409 }
          ),
        };
      }

      // Add the student and increase the player count
      tx.update(lobbyRef, {
        participantIds: FieldValue.arrayUnion(uid),
        playerCount: FieldValue.increment(1),
      });

      return {
        playerCount: currentCount + 1,
        alreadyJoined: false,
      };
    });

    if (result.errorResponse) {
      return result.errorResponse;
    }

    return NextResponse.json(
      {
        success: true,
        code,
        playerCount: result.playerCount,
        alreadyJoined: result.alreadyJoined,
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