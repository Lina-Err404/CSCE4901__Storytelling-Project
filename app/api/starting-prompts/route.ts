import { NextRequest, NextResponse } from "next/server";
import { authenticateRequest, getSupabaseAdmin, isTeacher } from "@/lib/supabaseAdmin";
import { AccessError, requireLobbyOwner, UUID } from "@/lib/lobbyAccess";
const PROMPT_TYPES = ["custom", "random", "none"];
const ASSIGNMENT_TYPES = ["entire-class", "different-groups", "randomized"];
export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => null);
  if (!body || typeof body !== "object" || Array.isArray(body)) return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  const { lobbyId, promptType, promptText, assignmentType } = body;
  if (typeof lobbyId !== "string" || !UUID.test(lobbyId) ||
      !PROMPT_TYPES.includes(promptType) || !ASSIGNMENT_TYPES.includes(assignmentType) ||
      (promptType === "custom" && (typeof promptText !== "string" || !promptText.trim())) ||
      (typeof promptText === "string" && promptText.length > 10000)) {
    return NextResponse.json({ error: "Invalid starting-prompt configuration" }, { status: 400 });
  }
  try {
    const user = await authenticateRequest(request);
    if (!user) return NextResponse.json({ error: "Authentication required" }, { status: 401 });
    if (!(await isTeacher(user))) return NextResponse.json({ error: "Teacher access required" }, { status: 403 });
    const lobby = await requireLobbyOwner(lobbyId, user.id);
    if (lobby.status === "closed") return NextResponse.json({ error: "Lobby is closed" }, { status: 409 });
    const startingPrompt = promptType === "custom" ? promptText.trim() : "";
    const { data, error } = await getSupabaseAdmin().from("lobbies").update({
      starting_prompt: startingPrompt,
      prompt_type: promptType,
      prompt_assignment_type: assignmentType,
    }).eq("lobby_id", lobbyId).eq("class_id", lobby.class_id)
      .neq("status", "closed").select("lobby_id").maybeSingle();
    if (error) throw error;
    if (!data) return NextResponse.json({ error: "Lobby is unavailable" }, { status: 409 });
    return NextResponse.json({ success: true, lobbyId, startingPrompt });
  } catch (error) {
    if (error instanceof AccessError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    console.error("Could not save starting prompt", error);
    return NextResponse.json({ error: "Could not save starting prompt" }, { status: 500 });
  }
}
