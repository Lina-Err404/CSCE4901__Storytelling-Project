"use client";

import { useState, type FormEvent } from "react";
import type { User } from "@supabase/supabase-js";
import { supabase } from "./supabase-client";

export function SupabaseAuthScreen({
  onAuthenticated,
}: {
  onAuthenticated: (user: User) => void;
}) {
  const [creatingAccount, setCreatingAccount] = useState(false);
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!supabase || busy) return;

    const formData = new FormData(event.currentTarget);
    const email = String(formData.get("email") || "").trim();
    const password = String(formData.get("password") || "");
    const displayName = String(formData.get("displayName") || "").trim();
    setBusy(true);
    setNotice("");

    try {
      if (creatingAccount) {
        const { data, error } = await supabase.auth.signUp({
          email,
          password,
          options: { data: { display_name: displayName } },
        });
        if (error) throw error;
        if (data.session && data.user) onAuthenticated(data.user);
        else setNotice("Check your email to confirm the new student account, then sign in.");
      } else {
        const { data, error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        onAuthenticated(data.user);
      }
    } catch (reason) {
      setNotice(reason instanceof Error ? reason.message : "Could not authenticate.");
    } finally {
      setBusy(false);
    }
  }

  if (!supabase) {
    return (
      <main className="mx-auto mt-16 max-w-md rounded-xl border bg-white p-6">
        <p role="alert">Supabase is not configured for this application.</p>
      </main>
    );
  }

  return (
    <main className="mx-auto mt-16 max-w-md rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
      <p className="text-sm font-semibold uppercase tracking-widest text-indigo-700">
        R13 Supabase lobby
      </p>
      <h1 className="mt-2 text-2xl font-bold">
        {creatingAccount ? "Create student account" : "Sign in"}
      </h1>
      <form onSubmit={submit} className="mt-6 space-y-4">
        {creatingAccount && (
          <label className="block text-sm font-medium">
            Display name
            <input name="displayName" required maxLength={50} className="mt-1 w-full rounded-lg border px-3 py-2" />
          </label>
        )}
        <label className="block text-sm font-medium">
          Email
          <input name="email" type="email" required autoComplete="email" className="mt-1 w-full rounded-lg border px-3 py-2" />
        </label>
        <label className="block text-sm font-medium">
          Password
          <input name="password" type="password" required minLength={8} autoComplete={creatingAccount ? "new-password" : "current-password"} className="mt-1 w-full rounded-lg border px-3 py-2" />
        </label>
        {notice && <p role="status" className="text-sm text-rose-700">{notice}</p>}
        <button type="submit" disabled={busy} className="w-full rounded-lg bg-indigo-700 px-4 py-3 font-semibold text-white disabled:opacity-60">
          {busy ? "Please wait..." : creatingAccount ? "Create account" : "Sign in"}
        </button>
      </form>
      <button
        type="button"
        onClick={() => {
          setCreatingAccount((current) => !current);
          setNotice("");
        }}
        className="mt-4 text-sm font-semibold text-indigo-700"
      >
        {creatingAccount ? "Already have an account? Sign in" : "Create a student account"}
      </button>
      <p className="mt-5 text-xs text-slate-500">
        Teacher accounts must be provisioned with the teacher role in Supabase.
      </p>
    </main>
  );
}
