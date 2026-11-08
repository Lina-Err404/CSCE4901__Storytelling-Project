import { createClient, type User } from "@supabase/supabase-js";
import type { NextRequest } from "next/server";

const url = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
const publishableKey = process.env.SUPABASE_PUBLISHABLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

export function getSupabaseAdmin() {
  if (!url || !serviceKey) throw new Error("Supabase server credentials are not configured");
  return createClient(url, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });
}
export async function authenticateRequest(request: NextRequest): Promise<User | null> {
  const match = request.headers.get("authorization")?.match(/^Bearer\s+(\S+)$/i);
  if (!match || !url || !publishableKey) return null;
  const client = createClient(url, publishableKey, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });
  const { data, error } = await client.auth.getUser(match[1]);
  return error ? null : data.user;
}

// The supplied project stores roles in public.profiles, not Auth app_metadata.
// Never accept a role from the browser or Auth user_metadata.
export async function getUserRole(user: User): Promise<"teacher" | "student"> {
  const db = getSupabaseAdmin();
  const { data, error } = await db.from("profiles").select("role")
    .eq("id", user.id).maybeSingle();
  if (error) throw error;
  if (data) return data.role === "teacher" ? "teacher" : "student";
  const fallback = [user.user_metadata?.first_name, user.user_metadata?.last_name]
    .filter((value: unknown) => typeof value === "string" && value.trim()).join(" ").trim();
  const displayName = [...(fallback || user.email?.split("@")[0] || "Student")].slice(0, 50).join("");
  const { error: insertError } = await db.from("profiles").insert({
    id: user.id, display_name: displayName, role: "student",
  });
  if (insertError && insertError.code !== "23505") throw insertError;
  // Re-read to avoid misclassifying an account promoted concurrently.
  const { data: current, error: lookupError } = await db.from("profiles")
    .select("role").eq("id", user.id).single();
  if (lookupError) throw lookupError;
  return current.role === "teacher" ? "teacher" : "student";
}
export async function isTeacher(user: User): Promise<boolean> {
  return (await getUserRole(user)) === "teacher";
}
