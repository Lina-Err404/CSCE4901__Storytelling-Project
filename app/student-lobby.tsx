"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import { signOut, type User } from "firebase/auth";
import { io, type Socket } from "socket.io-client";
import { auth } from "./firebase-client";

type JoinResponse = { token: string; lobbyId: string; displayName: string };

export function StudentLobby({ user }: { user: User }) {
  const [code, setCode] = useState("");
  const [joined, setJoined] = useState<JoinResponse | null>(null);
  const [connection, setConnection] = useState("Not connected");
  const [sessionStatus, setSessionStatus] = useState("open");
  const [error, setError] = useState("");
  const socketRef = useRef<Socket | null>(null);

  useEffect(() => {
    return () => {
      socketRef.current?.disconnect();
    };
  }, []);

  async function joinLobby(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    socketRef.current?.disconnect();
    setConnection("Connecting...");

    try {
      const idToken = await user.getIdToken();
      const response = await fetch("/api/lobbies/join", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${idToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ code: code.trim().toUpperCase() }),
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error || "Could not join this lobby.");

      const result = payload as JoinResponse;
      setJoined(result);
      const socket = io(process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000", {
        auth: { token: result.token },
        transports: ["websocket"],
        reconnection: false,
      });
      socketRef.current = socket;
      socket.on("connect", () => setConnection("Connected"));
      socket.on("connect_error", () => {
        setConnection("Connection rejected");
        setError("Your seat was created, but the live connection failed. Rejoin to retry.");
      });
      socket.on("disconnect", () => setConnection("Disconnected"));
      socket.on("lobby:status", (event: { status: string }) => {
        setSessionStatus(event.status);
      });
    } catch (reason) {
      setConnection("Not connected");
      setError(reason instanceof Error ? reason.message : "Could not join this lobby.");
    }
  }

  return (
    <main className="min-h-screen bg-slate-50 px-5 py-8 text-slate-900">
      <div className="mx-auto max-w-xl">
        <header className="flex items-center justify-between border-b border-slate-200 pb-5">
          <div>
            <p className="text-sm font-semibold uppercase tracking-widest text-indigo-700">
              Collab Storytelling
            </p>
            <h1 className="mt-2 text-2xl font-bold">Student lobby</h1>
          </div>
          <button onClick={() => auth && void signOut(auth)} className="rounded-lg border border-slate-300 px-3 py-2 text-sm font-semibold">
            Sign out
          </button>
        </header>

        <section className="mt-8 rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
          <p className="text-sm text-slate-600">Signed in as {user.email || "student"}</p>
          <p className="mt-2 break-all font-mono text-xs text-slate-500">Student ID: {user.uid}</p>
          <p className="mt-1 text-xs text-slate-500">Enter the valid class code to join the live lobby.</p>

          {!joined ? (
            <form onSubmit={joinLobby} className="mt-6 space-y-4">
              <label className="block text-sm font-semibold">
                Lobby code
                <input
                  required
                  maxLength={6}
                  autoComplete="off"
                  value={code}
                  onChange={(event) => setCode(event.target.value.toUpperCase())}
                  className="mt-1 w-full rounded-lg border border-slate-300 px-4 py-3 font-mono uppercase"
                />
              </label>
              {error && <p role="alert" className="text-sm text-rose-700">{error}</p>}
              <button type="submit" className="w-full rounded-lg bg-indigo-700 px-4 py-3 font-semibold text-white hover:bg-indigo-800">
                Join class lobby
              </button>
            </form>
          ) : (
            <div className="mt-6 border-t border-slate-100 pt-5">
              <h2 className="text-xl font-bold">Welcome, {joined.displayName}</h2>
              <p className="mt-2 text-sm text-slate-600">Session: {sessionStatus}</p>
              <p className="mt-1 text-sm text-slate-600">Live connection: {connection}</p>
              {error && <p role="alert" className="mt-3 text-sm text-rose-700">{error}</p>}
              {sessionStatus === "locked" && (
                <p className="mt-4 rounded-lg bg-emerald-50 p-3 text-sm font-semibold text-emerald-900">
                  The teacher has started the session.
                </p>
              )}
              <button
                onClick={() => {
                  socketRef.current?.disconnect();
                  socketRef.current = null;
                  setJoined(null);
                  setConnection("Not connected");
                  setSessionStatus("open");
                  setError("");
                }}
                className="mt-5 rounded-lg border border-slate-300 px-4 py-2 text-sm font-semibold"
              >
                Leave lobby
              </button>
            </div>
          )}
        </section>
      </div>
    </main>
  );
}