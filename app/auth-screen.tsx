"use client";

import { useState, type FormEvent } from "react";
import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
} from "firebase/auth";
import { auth, authConfigurationMissing } from "./firebase-client";

export function AuthScreen() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [creatingAccount, setCreatingAccount] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!auth) {
      setError("Firebase is not configured. Set the NEXT_PUBLIC_FIREBASE_* values and restart the app.");
      return;
    }
    setBusy(true);
    setError("");
    try {
      if (creatingAccount) {
        await createUserWithEmailAndPassword(auth, email, password);
      } else {
        await signInWithEmailAndPassword(auth, email, password);
      }
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Authentication failed.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-50 px-5 py-12 text-slate-900">
      <section className="w-full max-w-md rounded-xl border border-slate-200 bg-white p-7 shadow-sm">
        <p className="text-sm font-semibold uppercase tracking-widest text-indigo-700">
          Collab Storytelling
        </p>
        <h1 className="mt-3 text-2xl font-bold">
          {creatingAccount ? "Create a student account" : "Sign in"}
        </h1>
        <form onSubmit={submit} className="mt-6 space-y-4">
          {authConfigurationMissing && (
            <p role="alert" className="rounded-lg bg-amber-50 p-3 text-sm text-amber-900">
              Set the public Firebase configuration before signing in.
            </p>
          )}
          <label className="block text-sm font-medium">
            Email
            <input
              type="email"
              autoComplete="email"
              required
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2.5"
            />
          </label>
          <label className="block text-sm font-medium">
            Password
            <input
              type="password"
              autoComplete={creatingAccount ? "new-password" : "current-password"}
              minLength={6}
              required
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2.5"
            />
          </label>
          {error && <p role="alert" className="text-sm text-rose-700">{error}</p>}
          <button
            type="submit"
            disabled={busy}
            className="w-full rounded-lg bg-indigo-700 px-4 py-3 font-semibold text-white hover:bg-indigo-800 disabled:opacity-60"
          >
            {busy ? "Please wait..." : creatingAccount ? "Create student account" : "Sign in"}
          </button>
        </form>
        <button
          type="button"
          onClick={() => {
            setCreatingAccount(!creatingAccount);
            setError("");
          }}
          className="mt-4 w-full py-2 text-sm font-semibold text-indigo-700 hover:underline"
        >
          {creatingAccount ? "Already have an account? Sign in" : "Register as a student"}
        </button>
      </section>
    </main>
  );
}