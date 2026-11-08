import { NextRequest, NextResponse } from "next/server";
import { authenticateRequest, getSupabaseAdmin, isTeacher } from "@/lib/supabaseAdmin";
import { validateBreakoutRooms, type BreakoutRoom, type Lobby } from "@/lib/breakoutRooms";
import { requireLobbyOwner, UUID } from "@/lib/lobbyAccess";
type Context = { params: Promise<{ lobbyId: string }> };

async function loadLobby(request: NextRequest, context: Context) {
  const user = await authenticateRequest(request);
  if (!user) return { error: NextResponse.json({ error: "Authentication required" }, { status: 401 }) };
  if (!(await isTeacher(user))) return { error: NextResponse.json({ error: "Teacher access required" }, { status: 403 }) };
  const { lobbyId } = await context.params;
  if (!UUID.test(lobbyId)) return { error: NextResponse.json({ error: "Invalid lobby ID" }, { status: 400 }) };
  const db = getSupabaseAdmin();
  const row = await requireLobbyOwner(lobbyId, user.id);
  const { data: seats, error: se } = await db.from("lobby_participants")
    .select("student_id").eq("lobby_id", lobbyId).eq("status", "active");
  if (se) throw se;
  const ids = (seats || []).map((s) => s.student_id);
  const { data: profiles, error: pe } = ids.length ? await db.from("profiles")
    .select("id,display_name").in("id", ids) : { data: [], error: null };
  if (pe) throw pe;
  const names = new Map((profiles || []).map((p) => [p.id, p.display_name]));
  const lobby: Lobby = { lobbyId, teacherId: user.id,
    students: ids.map((id) => ({ id, name: names.get(id) || "Student" })), breakoutRooms: [] };
  return { db, lobby, row, user };
}
export async function GET(request: NextRequest, context: Context) {
  try {
    const loaded = await loadLobby(request, context);
    if (loaded.error) return loaded.error;
    const { db, lobby } = loaded;
    const { data: rooms, error: re } = await db!.from("breakout_rooms")
      .select("room_id,room_name").eq("lobby_id", lobby!.lobbyId).order("room_name");
    const { data: members, error: me } = await db!.from("breakout_participants")
      .select("room_id,student_id").eq("lobby_id", lobby!.lobbyId);
    if (re || me) throw re || me;
    const result: BreakoutRoom[] = (rooms || []).map((room) => ({
      roomId: room.room_id, roomName: room.room_name,
      studentIds: (members || []).filter((m) => m.room_id === room.room_id).map((m) => m.student_id),
    }));
    return NextResponse.json({ success: true, students: lobby!.students, rooms: result });
  } catch (error) {
    console.error("Could not load breakout rooms", error);
    return NextResponse.json({ success: false, error: "Could not load breakout rooms" }, { status: 500 });
  }
}
export async function POST(request: NextRequest, context: Context) {
  try {
    const loaded = await loadLobby(request, context);
    if (loaded.error) return loaded.error;
    const { db, lobby, row, user } = loaded;
    if (row!.status !== "waiting") return NextResponse.json({
      success: false, error: "Breakout rooms can only be changed before the session starts",
    }, { status: 409 });
    const body = await request.json().catch(() => null);
    if (!body || !Array.isArray(body.rooms) || body.rooms.length > 100) {
      return NextResponse.json({ success: false, error: "Rooms array required (max 100)" }, { status: 400 });
    }
    const rooms = body.rooms as BreakoutRoom[];
    const validation = validateBreakoutRooms(lobby!, user!.id, rooms);
    if (!validation.valid || rooms.some((room) => !UUID.test(room.roomId))) {
      return NextResponse.json({ success: false, error: validation.error || "Room IDs must be UUIDs" }, { status: 400 });
    }
    const { error } = await db!.rpc("r12_replace_breakout_rooms", {
      p_lobby_id: lobby!.lobbyId, p_teacher_id: user!.id, p_rooms: rooms,
    });
    if (error) {
      if (error.code === "P0001") return NextResponse.json({
        success: false, error: error.message,
      }, { status: 409 });
      throw error;
    }
    return NextResponse.json({ success: true, message: "Breakout rooms updated", rooms });
  } catch (error) {
    console.error("Could not save breakout rooms", error);
    return NextResponse.json({ success: false, error: "Could not save breakout rooms" }, { status: 500 });
  }
}
