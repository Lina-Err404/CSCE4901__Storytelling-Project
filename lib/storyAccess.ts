import type { User } from "@supabase/supabase-js";
import { getSupabaseAdmin, isTeacher } from "@/lib/supabaseAdmin";

export const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export type StoryRow = {
  story_id: string;
  room_id: string;
  title: string;
  status: string;
};
export class AccessError extends Error {
  constructor(message: string, public status: number) { super(message); }
}
export async function requireLobbyOwner(lobbyId: string, teacherId: string) {
  const db = getSupabaseAdmin();
  const { data: lobby, error } = await db.from("lobbies")
    .select("lobby_id,class_id,status,starting_prompt").eq("lobby_id", lobbyId).maybeSingle();
  if (error) throw error;
  if (!lobby) throw new AccessError("Lobby not found", 404);
  const { data: cls, error: ce } = await db.from("classes")
    .select("teacher_id").eq("class_id", lobby.class_id).maybeSingle();
  if (ce) throw ce;
  if (!cls || cls.teacher_id !== teacherId) throw new AccessError("Forbidden", 403);
  return lobby;
}
export async function studentGroup(lobbyId: string, userId: string) {
  const db = getSupabaseAdmin();
  const { data: lobby, error: le } = await db.from("lobbies")
    .select("status").eq("lobby_id", lobbyId).maybeSingle();
  if (le) throw le;
  if (!lobby || lobby.status === "closed") throw new AccessError("Lobby unavailable", 404);
  const { data: seat, error: se } = await db.from("lobby_participants")
    .select("student_id").eq("lobby_id", lobbyId).eq("student_id", userId)
    .eq("status", "active").maybeSingle();
  if (se) throw se;
  if (!seat) throw new AccessError("You are not part of this lobby", 403);
  const { data: membership, error: me } = await db.from("breakout_participants")
    .select("room_id").eq("lobby_id", lobbyId).eq("student_id", userId).maybeSingle();
  if (me) throw me;
  if (membership) return membership.room_id as string;
  const { count, error: re } = await db.from("breakout_rooms")
    .select("room_id", { count: "exact", head: true }).eq("lobby_id", lobbyId);
  if (re) throw re;
  if (count) throw new AccessError("Your teacher has not assigned you to a breakout room", 403);
  return null; // No assignments yet; r12_ensure_story creates the default group.
}
export async function requireStoryAccess(storyId: string, user: User) {
  const db = getSupabaseAdmin();
  const { data, error } = await db.from("stories")
    .select("story_id,room_id,title,status").eq("story_id", storyId).maybeSingle();
  if (error) throw error;
  if (!data) throw new AccessError("Story not found", 404);
  const { data: room, error: re } = await db.from("breakout_rooms")
    .select("lobby_id").eq("room_id", data.room_id).maybeSingle();
  if (re) throw re;
  if (!room) throw new AccessError("Story room unavailable", 404);
  if (await isTeacher(user)) {
    await requireLobbyOwner(room.lobby_id, user.id);
  } else {
    const membership = await studentGroup(room.lobby_id, user.id);
    if (membership !== data.room_id) throw new AccessError("Another group's story is private", 403);
  }
  return data as StoryRow;
}
export async function serializeStory(story: StoryRow) {
  const db = getSupabaseAdmin();
  const { data: room, error: re } = await db.from("breakout_rooms")
    .select("lobby_id,room_name").eq("room_id", story.room_id).single();
  if (re) throw re;
  const { data: members, error: me } = await db.from("breakout_participants")
    .select("student_id").eq("lobby_id", room.lobby_id).eq("room_id", story.room_id);
  if (me) throw me;
  const memberIds = (members || []).map((member) => member.student_id as string);
  const { data: seats, error: se } = memberIds.length ? await db.from("lobby_participants")
    .select("student_id").eq("lobby_id", room.lobby_id).eq("status", "active")
    .in("student_id", memberIds) : { data: [], error: null };
  if (se) throw se;
  const ids = (seats || []).map((seat) => seat.student_id as string);
  const { data: profiles, error: pe } = ids.length ? await db.from("profiles")
    .select("id,display_name").in("id", ids) : { data: [], error: null };
  if (pe) throw pe;
  const names = new Map((profiles || []).map((p) => [p.id, p.display_name]));
  const { data: segments, error: ge } = await db.from("story_segments")
    .select("segment_id,student_id,writing_content,section_order")
    .eq("story_id", story.story_id).order("section_order");
  if (ge) throw ge;
  const words = new Map((segments || []).filter((s) => s.student_id)
    .map((s) => [s.student_id as string, s.writing_content]));
  // Preserve the order of authored segments, followed by not-yet-writing students.
  const ordering = new Map((segments || []).filter((s) => s.student_id)
    .map((s, i) => [s.student_id as string, i]));
  const students = ids.map((id) => ({ id, name: names.get(id) || "Student", content: words.get(id) || "" }))
    .sort((a, b) => (ordering.get(a.id) ?? Number.MAX_SAFE_INTEGER) - (ordering.get(b.id) ?? Number.MAX_SAFE_INTEGER));
  const segmentIds = (segments || []).map((s) => s.segment_id as string);
  const { data: feedbackRows, error: fe } = segmentIds.length ? await db.from("segment_feedback")
    .select("body,updated_at").in("segment_id", segmentIds)
    .order("updated_at", { ascending: false }).limit(1) : { data: [], error: null };
  if (fe) throw fe;
  const { data: lobby, error: le } = await db.from("lobbies")
    .select("starting_prompt").eq("lobby_id", room.lobby_id).single();
  if (le) throw le;
  return {
    id: story.story_id, lobbyId: room.lobby_id, groupKey: story.room_id,
    group: room.room_name, title: story.title,
    status: story.status === "approved" ? "approved" : "pending",
    feedback: feedbackRows?.[0]?.body || "", prompt: lobby?.starting_prompt || "",
    students, authors: students.map((s) => s.name).join(", "),
    text: students.map((s) => s.content).filter((s) => s.trim()),
  };
}
export function errorResponse(error: unknown) {
  if (error instanceof AccessError) return { status: error.status, error: error.message };
  console.error("Story API error", error);
  return { status: 500, error: "Unable to access the story" };
}
