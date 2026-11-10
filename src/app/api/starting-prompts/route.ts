import { createClient } from "@supabase/supabase-js";
import { NextRequest, NextResponse } from "next/server";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const PROMPT_TYPES = ["custom", "random", "none"];
const ASSIGNMENT_TYPES = ["entire-class", "different-groups", "randomized"];

function failure(error: string, status: number) {
  return NextResponse.json({ error }, { status });
}

async function authorize(request: NextRequest) {
  const token = request.headers.get("authorization")?.match(/^Bearer\s+(\S+)$/i)?.[1];
  if (!token) return { error: failure("Sign in to Supabase first.", 401) };

  const url = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
  const publicKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !publicKey || !serviceKey) {
    return { error: failure("Supabase is not configured on the server.", 500) };
  }

  const options = { auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false } };
  const { data: { user }, error: authError } = await createClient(url, publicKey, options).auth.getUser(token);
  if (authError || !user) return { error: failure("Sign in to Supabase again.", 401) };

  const db = createClient(url, serviceKey, options);
  const { data: profile, error } = await db.from("profiles").select("role").eq("id", user.id).maybeSingle();
  if (error) throw error;
  if (profile?.role !== "teacher") return { error: failure("Teacher access required.", 403) };
  return { db, teacherId: user.id };
}

export async function GET(request: NextRequest) {
  try {
    const auth = await authorize(request);
    if (auth.error) return auth.error;

    const { data, error } = await auth.db.from("lobbies")
      .select("lobby_id, lobby_name, join_code, classes!inner(teacher_id)")
      .eq("classes.teacher_id", auth.teacherId)
      .in("status", ["waiting", "active"])
      .order("created_at", { ascending: false });
    if (error) throw error;

    const lobbies = data.map(({ lobby_id, lobby_name, join_code }) => ({
      id: lobby_id, name: lobby_name, code: join_code,
    }));
    return NextResponse.json({ lobbies }, { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) {
    console.error("Could not load R12 lobbies:", error);
    return failure("Could not load your Supabase lobbies.", 500);
  }
}

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => null);
  if (!body || typeof body !== "object" || Array.isArray(body)) return failure("Invalid request.", 400);
  const { lobbyId, promptType, promptText, assignmentType } = body;
  if (typeof lobbyId !== "string" || !UUID.test(lobbyId)) return failure("Select a valid lobby.", 400);
  if (!PROMPT_TYPES.includes(promptType)) return failure("Invalid prompt mode.", 400);
  if (!ASSIGNMENT_TYPES.includes(assignmentType)) return failure("Invalid assignment type.", 400);
  const text = promptType === "custom" && typeof promptText === "string" ? promptText.trim() : "";
  if (promptType === "custom" && (!text || [...text].length > 10000)) {
    return failure("Enter a custom prompt of 1 to 10,000 characters.", 400);
  }

  try {
    const auth = await authorize(request);
    if (auth.error) return auth.error;

    const { data: saved, error } = await auth.db.rpc("r12_save_starting_prompt", {
      p_teacher_id: auth.teacherId,
      p_lobby_id: lobbyId,
      p_prompt_type: promptType,
      p_prompt_text: text,
      p_assignment_type: assignmentType,
    });
    if (error) throw error;
    if (!saved) return failure("No open lobby found for this teacher.", 404);
    return NextResponse.json({ message: "Starting prompt settings saved." });
  } catch (error) {
    console.error("Could not save starting prompt:", error);
    return failure("Could not save starting prompt.", 500);
  }
}
