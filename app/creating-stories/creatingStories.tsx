"use client";

import { useEffect, useState } from "react";
import SetItem from "./components/SetItem";
import TopBar from "./components/topBar";
import { AppSidebar } from "@/components/app-sidebar";
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar";
import { getAccessToken, supabase } from "@/app/supabase-client";
import "./creating-stories.css";

type Student = { id: string; name: string; content: string };
type Story = {
  id: string; lobbyId: string; group: string; status: "pending" | "approved";
  students: Student[]; prompt?: string;
};

async function storyRequest(path: string, method = "GET", body?: object) {
  const response = await fetch(`/api/stories${path}`, {
    method,
    headers: { Authorization: `Bearer ${await getAccessToken()}`, ...(body ? { "Content-Type": "application/json" } : {}) },
    ...(body ? { body: JSON.stringify(body) } : {}),
    cache: "no-store",
  });
  const data = await response.json();
  if (!response.ok) throw new Error(data.error || "Could not open the story.");
  return data;
}

export default function CreatingStories() {
  const [studentId, setStudentId] = useState("");
  const [story, setStory] = useState<Story | null>(null);
  const [error, setError] = useState("");
  const [mode, setMode] = useState<"writing" | "drawing">("writing");
  const [retry, setRetry] = useState(0);

  useEffect(() => {
    let cancelled = false;
    async function openStory() {
      try {
        const lobbyId = new URLSearchParams(window.location.search).get("lobbyId");
        if (!lobbyId) throw new Error("Open this story from a classroom lobby first.");
        if (!supabase) throw new Error("Supabase is not configured.");
        const { data: { user }, error: authError } = await supabase.auth.getUser();
        if (authError || !user) throw new Error("Sign in to open your story.");
        // Server validates the real authenticated student, seat and group; the browser cannot choose a student ID.
        const result = await storyRequest("", "POST", { lobbyId });
        if (!cancelled) { setStudentId(user.id); setStory(result.story); setError(""); }
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : "Could not load story.");
      }
    }
    void openStory();
    return () => { cancelled = true; };
  }, [retry]);

  if (!story || !studentId) return (
    <main className="min-h-screen bg-slate-100 p-8 text-slate-900">
      <a className="underline" href="/">Back to lobby</a>
      <p className="mt-6" role="status">{error || "Opening your group's story..."}</p>
      {error && <button className="mt-3 rounded bg-indigo-700 px-4 py-2 text-white" onClick={() => setRetry((n) => n + 1)}>Retry</button>}
    </main>
  );

  return (
    <main className="max-h-screen max-w-screen overflow-hidden">
      <TopBar mode={mode} prompt={story.prompt || ""} onToggleMode={() => setMode((m) => m === "writing" ? "drawing" : "writing")} />
      <SidebarProvider className="h-[calc(100svh-4rem)] min-h-0" style={{ "--sidebar-width": "400px" } as React.CSSProperties}>
        <AppSidebar />
        <SidebarInset className="min-h-0 overflow-hidden bg-[#C3D0E5]">
          <div className="flex min-h-0 flex-1 flex-col items-center">
            <div className="flex w-full items-center justify-between gap-3 px-6 py-2 text-black">
              <h1 className="text-xl">{mode === "writing" ? "Writing Page" : "Drawing Page"} — {story.group}</h1>
              <a className="text-sm underline" href="/">Back to lobby</a>
            </div>
            <SetItem key={story.id} storyId={story.id} studentId={studentId} students={story.students} mode={mode} />
          </div>
        </SidebarInset>
      </SidebarProvider>
    </main>
  );
}
