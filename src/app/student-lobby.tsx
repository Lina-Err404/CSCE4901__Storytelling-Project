"use client";

import { useEffect, useRef, useState, type ClipboardEvent, type KeyboardEvent } from "react";
import { signOut, type User } from "firebase/auth";
import { io, type Socket } from "socket.io-client";
import Image from "next/image";
import { Lexend } from "next/font/google";
import { auth } from "./firebase-client";
import styles from "./join/join.module.css";

const lexend = Lexend({ subsets: ["latin"], weight: ["600", "800"] });
const CODE_LENGTH = 6;

type JoinResponse = { token: string; lobbyId: string; displayName: string };

export function StudentLobby({ user }: { user: User }) {
  const [chars, setChars] = useState<string[]>(Array(CODE_LENGTH).fill(""));
  const inputs = useRef<(HTMLInputElement | null)[]>([]);
  const code = chars.join("");
  const isComplete = code.length === CODE_LENGTH;

  const [joined, setJoined] = useState<JoinResponse | null>(null);
  const [connection, setConnection] = useState("Not connected");
  const [sessionStatus, setSessionStatus] = useState("open");
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const socketRef = useRef<Socket | null>(null);

  useEffect(() => {
    return () => {
      socketRef.current?.disconnect();
    };
  }, []);

  // Handle Sign out
  async function handleSignOut() {
    socketRef.current?.disconnect();
    socketRef.current = null;
    if (auth) await signOut(auth);
  }

  // Tile input handling
  const clean = (value: string) => value.replace(/[^a-zA-Z0-9]/g, "").toUpperCase();

  const handleChange = (index: number, value: string) => {
    const cleaned = clean(value);
    const next =
      cleaned.length > 1 && cleaned[0] !== chars[index] ? cleaned[0] : cleaned.slice(-1);
    setChars((prev) => prev.map((c, i) => (i === index ? next : c)));
    if (next && index < CODE_LENGTH - 1) inputs.current[index + 1]?.focus();
  };

  const handleKeyDown = (index: number, e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Backspace" && !chars[index] && index > 0) {
      inputs.current[index - 1]?.focus();
    } else if (e.key === "ArrowLeft" && index > 0) {
      e.preventDefault();
      inputs.current[index - 1]?.focus();
    } else if (e.key === "ArrowRight" && index < CODE_LENGTH - 1) {
      e.preventDefault();
      inputs.current[index + 1]?.focus();
    }
    if (e.key === "Enter" && isComplete) void joinLobby();
  };

  const handlePaste = (e: ClipboardEvent<HTMLInputElement>) => {
    e.preventDefault();
    const pasted = clean(e.clipboardData.getData("text")).slice(0, CODE_LENGTH);
    if (!pasted) return;
    setChars(Array.from({ length: CODE_LENGTH }, (_, i) => pasted[i] ?? ""));
    inputs.current[Math.min(pasted.length, CODE_LENGTH - 1)]?.focus();
  };

  // Join logic
  async function joinLobby() {
    if (!isComplete || isLoading) return;
    setError("");
    setIsLoading(true);
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
    } finally {
      setIsLoading(false);
    }
  }

  // Before joining
  if (!joined) {
    return (
      <main className={`${styles.page} ${lexend.className}`}>
        <p className={styles.account}>Signed in as {user.email || "student"}</p>

        <button type="button" className={styles.signOut} onClick={() => void handleSignOut()}>
          Sign out
        </button>

        <Image src="/assets/Sun_Element.svg" alt="" width={72} height={72} />

        <div className={styles.codeRow}>
          {chars.map((char, i) => (
            <input
              key={i}
              ref={(el) => {
                inputs.current[i] = el;
              }}
              className={styles.tile}
              value={char}
              onChange={(e) => handleChange(i, e.target.value)}
              onKeyDown={(e) => handleKeyDown(i, e)}
              onPaste={handlePaste}
              onFocus={(e) => e.target.select()}
              maxLength={2}
              autoComplete="off"
              aria-label={`Lobby code character ${i + 1} of ${CODE_LENGTH}`}
            />
          ))}
        </div>

        <div className={styles.joinRow}>
          <Image className={styles.side} src="/assets/Moon_1.svg" alt="" width={62} height={47} />
          <button
            type="button"
            className={styles.joinButton}
            onClick={() => void joinLobby()}
            disabled={!isComplete || isLoading}
          >
            <span>{isLoading ? "Joining..." : "Join"}</span>
          </button>
          <Image className={styles.side} src="/assets/Moon_2.svg" alt="" width={69} height={47} />
        </div>

        {error && (
          <p role="alert" className={styles.tagline}>
            {error}
          </p>
        )}
        <p className={styles.tagline}>Ready for your next story?</p>
        <Image src="/assets/Stars_Element.svg" alt="" width={90} height={34} />
      </main>
    );
  }

  // After joining
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
          <button
            onClick={() => void handleSignOut()}
            className="rounded-lg border border-slate-300 px-3 py-2 text-sm font-semibold"
          >
            Sign out
          </button>
        </header>

        <section className="mt-8 rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
          <p className="text-sm text-slate-600">Signed in as {user.email || "student"}</p>
          <p className="mt-2 break-all font-mono text-xs text-slate-500">Student ID: {user.uid}</p>

          <div className="mt-6 border-t border-slate-100 pt-5">
            <h2 className="text-xl font-bold">Welcome, {joined.displayName}</h2>
            <p className="mt-2 text-sm text-slate-600">Session: {sessionStatus}</p>
            <p className="mt-1 text-sm text-slate-600">Live connection: {connection}</p>
            {error && (
              <p role="alert" className="mt-3 text-sm text-rose-700">
                {error}
              </p>
            )}
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
                setChars(Array(CODE_LENGTH).fill(""));
                setConnection("Not connected");
                setSessionStatus("open");
                setError("");
              }}
              className="mt-5 rounded-lg border border-slate-300 px-4 py-2 text-sm font-semibold"
            >
              Leave lobby
            </button>
          </div>
        </section>
      </div>
    </main>
  );
}
