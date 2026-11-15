"use client";
import { useEffect, useState } from "react";
import StartingPrompt from "@/components/StartingPrompt";

export default function StartingPromptsPage() {
  const [lobbyId, setLobbyId] = useState("");
  useEffect(() => { setLobbyId(new URLSearchParams(window.location.search).get("lobbyId") || ""); }, []);
  return <main className="mx-auto max-w-3xl p-8 text-slate-900">
    <a href="/" className="text-indigo-700 underline">Back to teacher dashboard</a>
    <h1 className="my-6 text-2xl font-bold">Starting Prompts</h1>
    {lobbyId ? <StartingPrompt lobbyId={lobbyId} /> : <p>Open this page from a classroom lobby to configure its starting prompt.</p>}
  </main>;
}
