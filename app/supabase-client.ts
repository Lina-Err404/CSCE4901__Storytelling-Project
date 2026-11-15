"use client";

import { createClient, type SupabaseClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
export const authConfigurationMissing = !url || !key;
export const supabase: SupabaseClient | null = url && key
  ? createClient(url, key)
  : null;

export async function getAccessToken(): Promise<string> {
  if (!supabase) throw new Error("Supabase client is not configured");
  const { data, error } = await supabase.auth.getSession();
  if (error || !data.session?.access_token) throw new Error("Sign in is required");
  return data.session.access_token;
}

export async function getCurrentRole(): Promise<"teacher" | "student"> {
  const response = await fetch("/api/account/role", {
    headers: { Authorization: `Bearer ${await getAccessToken()}` },
    cache: "no-store",
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(payload.error || "Could not load permissions");
  return payload.role === "teacher" ? "teacher" : "student";
}
