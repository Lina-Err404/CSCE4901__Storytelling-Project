import { NextRequest, NextResponse } from "next/server";
import { authenticateRequest, getSupabaseAdmin, isTeacher } from "@/lib/supabaseAdmin";
import { AccessError, errorResponse, requireLobbyOwner, serializeStory, studentGroup, UUID } from "@/lib/storyAccess";

export async function GET(request: NextRequest) {
  const user = await authenticateRequest(request);
  if (!user) return NextResponse.json({ error: "Sign in is required" }, { status: 401 });
  const lobbyId = request.nextUrl.searchParams.get("lobbyId") || "";
  if (!UUID.test(lobbyId)) return NextResponse.json({ error: "Valid lobbyId required" }, { status: 400 });
  try {
    const db = getSupabaseAdmin();
    if (await isTeacher(user)) {
      await requireLobbyOwner(lobbyId, user.id);
      const { data: rooms, error: roomError } = await db.from("breakout_rooms")
        .select("room_id,room_name").eq("lobby_id", lobbyId);
      if (roomError) throw roomError;
      const roomIds = (rooms || []).map((r) => r.room_id);
      if (!roomIds.length) return NextResponse.json({ stories: [] });
      const { data: stories, error } = await db.from("stories")
        .select("story_id,room_id,title,status,created_at").in("room_id", roomIds)
        .order("created_at", { ascending: true });
      if (error) throw error;
      const names = new Map((rooms || []).map((r) => [r.room_id, r.room_name]));
      return NextResponse.json({ stories: (stories || []).map((story) => ({
        id: story.story_id, group: names.get(story.room_id) || "Group",
        title: story.title, status: story.status === "approved" ? "approved" : "pending",
      })) });
    }
    const roomId = await studentGroup(lobbyId, user.id);
    if (!roomId) return NextResponse.json({ story: null });
    const { data, error } = await db.from("stories")
      .select("story_id,room_id,title,status").eq("room_id", roomId)
      .order("created_at", { ascending: true }).limit(1).maybeSingle();
    if (error) throw error;
    return NextResponse.json({ story: data ? await serializeStory(data) : null });
  } catch (e) {
    const { status, error } = errorResponse(e);
    return NextResponse.json({ error }, { status });
  }
}
export async function POST(request: NextRequest) {
  const user = await authenticateRequest(request);
  if (!user) return NextResponse.json({ error: "Sign in is required" }, { status: 401 });
  if (await isTeacher(user)) return NextResponse.json({ error: "Students write stories" }, { status: 403 });
  const body = await request.json().catch(() => null);
  const lobbyId = typeof body?.lobbyId === "string" ? body.lobbyId : "";
  if (!UUID.test(lobbyId)) return NextResponse.json({ error: "Valid lobbyId required" }, { status: 400 });
  try {
    const { data, error } = await getSupabaseAdmin().rpc("r12_ensure_story", {
      p_lobby_id: lobbyId, p_student_id: user.id,
    });
    if (error) {
      if (error.code === "P0001") throw new AccessError(error.message, 403);
      throw error;
    }
    return NextResponse.json({ story: await serializeStory(data) });
  } catch (e) {
    const { status, error } = errorResponse(e);
    return NextResponse.json({ error }, { status });
  }
}
