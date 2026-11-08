import { getSupabaseAdmin } from "@/lib/supabaseAdmin";

export const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
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
