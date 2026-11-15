"use client";

import { createClient, type SupabaseClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
const supabaseAnonKey =
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ||
    "";

export const supabaseConfigurationMissing = !supabaseUrl || !supabaseAnonKey;
export const authConfigurationMissing = supabaseConfigurationMissing;

export const supabase: SupabaseClient | null = supabaseConfigurationMissing
    ? null
    : createClient(supabaseUrl, supabaseAnonKey);