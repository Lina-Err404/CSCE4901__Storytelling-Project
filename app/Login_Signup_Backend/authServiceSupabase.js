"use client";

import { supabase } from "../supabase-client";

export async function signUp(email, password, firstName = "", lastName = "") {
  if (!supabase) throw new Error("Supabase client is not configured");
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: { data: { first_name: firstName, last_name: lastName } },
  });
  if (error) throw error;
  if (!data.session || !data.user) {
    throw new Error("Check your email to confirm your account, then sign in. Teacher access must also be granted by an administrator.");
  }
  return data.user;
}

export async function logIn(email, password) {
  if (!supabase) throw new Error("Supabase client is not configured");
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) throw error;
  if (!data.user) throw new Error("Could not sign in");
  return data.user;
}
