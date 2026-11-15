"use client";

import { useEffect, useState } from "react";
import { approveStory, listStories, loadStory, saveFeedback, type Story, type ReviewStatus } from "@/lib/storyReview";

type QueueItem = { id: string; title: string; group: string; status: ReviewStatus };

export default function TeacherReviewPage() {
  const [storyId, setStoryId] = useState("");
  const [lobbyId, setLobbyId] = useState("");
  const [queue, setQueue] = useState<QueueItem[]>([]);
  const [story, setStory] = useState<Story | null>(null);
  const [feedback, setFeedback] = useState("");
  const [savedFeedback, setSavedFeedback] = useState("");
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [saving, setSaving] = useState(false);
  const [reload, setReload] = useState(0);

  useEffect(() => {
    const search = new URLSearchParams(window.location.search);
    setStoryId(search.get("id") || "");
    setLobbyId(search.get("lobbyId") || "");
  }, []);

  useEffect(() => {
    if (!storyId && !lobbyId) return;
    let active = true;
    setError("");
    async function refresh() {
      try {
        if (storyId) {
          const loaded = await loadStory(storyId);
          if (!active) return;
          setStory(loaded);
          setFeedback(loaded.feedback);
          setSavedFeedback(loaded.feedback);
        } else if (lobbyId) {
          const result = await listStories(lobbyId);
          if (active) setQueue(result);
        }
      } catch (reason) {
        if (active) setError(reason instanceof Error ? reason.message : "Could not load stories.");
      }
    }
    void refresh();
    return () => { active = false; };
  }, [storyId, lobbyId, reload]);

  async function storeFeedback() {
    if (!story) return;
    setSaving(true); setMessage("");
    try {
      await saveFeedback(story.id, feedback.trim());
      setSavedFeedback(feedback.trim());
      setMessage("Feedback saved.");
    } catch (reason) { setError(reason instanceof Error ? reason.message : "Could not save feedback."); }
    finally { setSaving(false); }
  }

  async function approve() {
    if (!story) return;
    setSaving(true); setMessage("");
    try {
      await approveStory(story.id);
      setStory((prev) => prev ? { ...prev, status: "approved" } : prev);
      setMessage("Story approved. Student sections are now read-only.");
    } catch (reason) { setError(reason instanceof Error ? reason.message : "Could not approve story."); }
    finally { setSaving(false); }
  }

  return (
    <main className="min-h-screen bg-[#1e4d85] px-4 py-8 text-white sm:px-8">
      <div className="mx-auto max-w-6xl">
        <a className="text-sm underline" href="/">Back to teacher dashboard</a>
        <header className="mb-8 mt-5">
          <p className="text-sm">Collab Storytelling</p>
          <h1 className="mt-2 text-3xl font-bold">Teacher Review</h1>
          <p className="mt-2">Review group stories, provide feedback, and approve finished work.</p>
        </header>
        {error && <p role="alert" className="mb-4 rounded-lg bg-rose-100 p-4 text-rose-900">{error} <button className="ml-3 underline" onClick={() => setReload((n) => n + 1)}>Retry</button></p>}
        {!storyId && !lobbyId && <p>Open the review queue from a classroom lobby. No sample story is loaded automatically.</p>}
        {!storyId && !!lobbyId && <div className="rounded-2xl bg-white p-6 text-slate-900">
          <h2 className="mb-4 text-xl font-bold">Stories in this lobby</h2>
          {!queue.length ? <p>No stories yet. Students create a story when they open the editor.</p> : (
            <ul className="space-y-3">{queue.map((s) => <li key={s.id} className="flex items-center justify-between gap-3 border-b py-3">
              <span>{s.title} — {s.group} ({s.status})</span>
              <a className="rounded-lg bg-indigo-700 px-4 py-2 text-white" href={`/teacher-review?id=${encodeURIComponent(s.id)}&lobbyId=${encodeURIComponent(lobbyId)}`}>Review</a>
            </li>)}</ul>
          )}
        </div>}
        {!!storyId && !story && !error && <p role="status">Loading story...</p>}
        {story && <div className="grid gap-6 lg:grid-cols-[1fr_360px]">
          <article className="rounded-2xl bg-[#cad9eb] p-6 text-slate-900 shadow-lg sm:p-8">
            <div className="flex items-center justify-between gap-3 text-sm font-semibold">
              <p>{story.group}</p><span className="rounded-full bg-white px-3 py-1">{story.status === "approved" ? "Approved" : "Awaiting review"}</span>
            </div>
            <h2 className="mt-5 text-2xl font-bold">{story.title}</h2>
            <p className="mt-2 text-sm">Written by {story.authors || "Students"}</p>
            <div className="mt-6 space-y-5 whitespace-pre-wrap rounded-xl bg-white p-6 leading-8">
              {story.text.length ? story.text.map((paragraph, i) => <p key={i}>{paragraph}</p>) : <p>No writing has been saved yet.</p>}
            </div>
          </article>
          <aside className="self-start rounded-2xl bg-white p-6 text-slate-900 shadow-lg">
            <h2 className="text-xl font-bold">Teacher Feedback</h2>
            <label htmlFor="feedback" className="mb-2 mt-5 block text-sm font-medium">Feedback for this group</label>
            <textarea id="feedback" rows={7} value={feedback} onChange={(e) => setFeedback(e.target.value)}
              maxLength={10000} placeholder="Share what worked well and what could improve..."
              className="w-full rounded-lg border border-slate-400 p-3" />
            <button type="button" onClick={() => void storeFeedback()} disabled={saving || feedback.trim() === savedFeedback}
              className="mt-3 w-full rounded-lg bg-[#00566b] px-4 py-3 font-semibold text-white disabled:opacity-50">Save Feedback</button>
            <button type="button" onClick={() => void approve()} disabled={saving || story.status === "approved"}
              className="mt-3 w-full rounded-lg bg-indigo-700 px-4 py-3 font-semibold text-white disabled:opacity-50">Approve Story</button>
            {message && <p role="status" className="mt-4 text-sm text-green-800">{message}</p>}
            {!!lobbyId && <a className="mt-5 block text-sm underline" href={`/teacher-review?lobbyId=${encodeURIComponent(lobbyId)}`}>Back to review queue</a>}
          </aside>
        </div>}
      </div>
    </main>
  );
}
