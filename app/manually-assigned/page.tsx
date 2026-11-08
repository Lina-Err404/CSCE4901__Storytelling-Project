"use client";

import { useEffect, useState } from "react";
import BreakoutManager from "../components/breakoutManager";
import { getAccessToken } from "@/app/supabase-client";
import type { Lobby } from "@/lib/breakoutRooms";

export default function Page() {
  const [lobby, setLobby] = useState<Lobby | null>(null);
  const [error, setError] = useState("");
  useEffect(() => {
    const lobbyId = new URLSearchParams(window.location.search).get("lobbyId");
    if (!lobbyId) { setError("Open a lobby from the teacher dashboard first."); return; }
    let cancelled = false;
    async function load() {
      try {
        const token = await getAccessToken();
        const res = await fetch(`/api/lobbies/${encodeURIComponent(lobbyId!)}/breakout-rooms`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || "Could not load lobby");
        if (!cancelled) setLobby({ lobbyId: lobbyId!, teacherId: "", students: data.students, breakoutRooms: data.rooms });
      } catch (err) { if (!cancelled) setError(err instanceof Error ? err.message : "Could not load lobby"); }
    }
    void load();
    return () => { cancelled = true; };
  }, []);
  return <main className="mx-auto max-w-5xl p-8">
    <a href="/" className="text-indigo-700 underline">Back to teacher dashboard</a>
    <h1 className="my-6 text-2xl font-bold">Assign breakout rooms</h1>
    {error && <p role="alert" className="my-4 text-rose-700">{error}</p>}
    {lobby && <BreakoutManager lobby={lobby} />}
  </main>;
}
