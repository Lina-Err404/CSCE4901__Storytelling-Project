"use client";

import { use, useEffect, useState } from "react";
import {
  approveStory as approveStoryInDb,
  loadStory,
  saveFeedback as saveFeedbackInDb,
  type Story,
} from "@/lib/storyReview";

// The story to review comes from the URL, e.g. /teacher-review?id=story-1.
// Falls back to "story-1" until a review queue links to each story.
const DEFAULT_STORY_ID = "story-1";

export default function TeacherReviewPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const { id } = use(searchParams);
  const storyId = typeof id === "string" && id ? id : DEFAULT_STORY_ID;

  const [story, setStory] = useState<Story | null>(null);
  const [loadError, setLoadError] = useState("");
  const [feedback, setFeedback] = useState("");
  const [savedFeedback, setSavedFeedback] = useState("");
  const [approved, setApproved] = useState(false);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [reloadKey, setReloadKey] = useState(0);

  // Load the story and its saved feedback/approval from Firestore.
  useEffect(() => {
    // Ignore results that arrive after the page has unmounted or changed story.
    let active = true;
    loadStory(storyId)
      .then((loaded) => {
        if (!active) return;
        if (!loaded) {
          setLoadError(`Story "${storyId}" was not found.`);
          return;
        }
        setStory(loaded);
        setFeedback(loaded.feedback);
        setSavedFeedback(loaded.feedback);
        setApproved(loaded.status === "approved");
      })
      .catch((error) => {
        if (!active) return;
        console.error("Failed to load story", error);
        setLoadError("Could not load this story. Please try again.");
      });
    return () => {
      active = false;
    };
  }, [storyId, reloadKey]);

  // Try loading again after an error, without reloading the browser tab.
  function retryLoad() {
    setLoadError("");
    setReloadKey((key) => key + 1);
  }

  // Save feedback to Firestore so it stays after a refresh.
  async function saveFeedback() {
    const trimmed = feedback.trim();
    setSaving(true);
    try {
      await saveFeedbackInDb(storyId, trimmed);
      setSavedFeedback(trimmed);
      setFeedback(trimmed);
      setMessage(trimmed ? "Feedback saved." : "Feedback cleared.");
    } catch (error) {
      console.error("Failed to save feedback", error);
      setMessage("Could not save feedback. Please try again.");
    } finally {
      setSaving(false);
    }
  }

  // Save approval to Firestore.
  async function approveStory() {
    setSaving(true);
    try {
      await approveStoryInDb(storyId);
      setApproved(true);
      setMessage("Story approved.");
    } catch (error) {
      console.error("Failed to approve story", error);
      setMessage("Could not approve the story. Please try again.");
    } finally {
      setSaving(false);
    }
  }

  if (loadError || !story) {
    return (
      <main className="min-h-screen bg-[#1e4d85] px-4 py-8 text-white sm:px-8">
        <div role="status" className="mx-auto max-w-6xl">
          <p>{loadError || "Loading story..."}</p>
          {loadError && (
            <button
              type="button"
              onClick={retryLoad}
              className="mt-4 rounded-lg bg-white px-4 py-2 font-semibold text-slate-900 hover:bg-blue-50"
            >
              Try Again
            </button>
          )}
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-[#1e4d85] px-4 py-8 text-slate-900 sm:px-8">
      <div className="mx-auto max-w-6xl">
        <header className="mb-6 text-white">
          <p className="text-sm">Collab Storytelling</p>
          <h1 className="mt-2 text-3xl font-bold">Teacher Review</h1>
          <p className="mt-2">
            Read completed stories, leave feedback, and approve them.
          </p>
        </header>

        <div className="grid gap-6 lg:grid-cols-[1fr_360px]">
          <article className="rounded-2xl bg-[#cad9eb] p-6 shadow-lg sm:p-8">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <p className="text-sm font-semibold">{story.group}</p>
              <span className="rounded-full bg-white px-3 py-1 text-sm font-semibold">
                {approved ? "Approved" : "Awaiting review"}
              </span>
            </div>

            <h2 className="mt-5 text-2xl font-bold">{story.title}</h2>
            <p className="mt-2 text-sm">
              Written by {story.authors}
            </p>

            <div className="mt-6 space-y-5 rounded-xl bg-white p-6 leading-8">
              {story.text.map((paragraph, index) => (
                <p key={index}>{paragraph}</p>
              ))}
            </div>
          </article>

          <aside
            aria-labelledby="feedback-heading"
            className="self-start rounded-2xl bg-white p-6 shadow-lg"
          >
            <h2 id="feedback-heading" className="text-xl font-bold">
              Teacher Feedback
            </h2>

            <label
              htmlFor="feedback"
              className="mb-2 mt-5 block text-sm font-medium"
            >
              Feedback for this group
            </label>
            <textarea
              id="feedback"
              rows={7}
              value={feedback}
              onChange={(event) => {
                setFeedback(event.target.value);
                setMessage("");
              }}
              placeholder="Share what worked well and what could improve..."
              className="w-full rounded-lg border border-slate-400 p-3 focus:outline-2 focus:outline-offset-2 focus:outline-blue-700"
            />

            <button
              type="button"
              onClick={saveFeedback}
              disabled={
                saving ||
                (!feedback.trim() && !savedFeedback) ||
                feedback.trim() === savedFeedback
              }
              className="mt-3 w-full rounded-lg bg-[#00566b] px-4 py-3 font-semibold text-white hover:bg-[#004353] disabled:cursor-not-allowed disabled:opacity-50"
            >
              Save Feedback
            </button>

            {savedFeedback && (
              <div className="mt-5">
                <h3 className="text-sm font-semibold">Saved feedback</h3>
                <p className="mt-2 whitespace-pre-wrap break-words text-sm">
                  {savedFeedback}
                </p>
              </div>
            )}

            <div className="mt-6 border-t border-slate-200 pt-6">
              <h3 className="font-semibold">Story approval</h3>
              <p className="mt-2 text-sm text-slate-600">
                Approve this completed story after reviewing it.
              </p>
              <button
                type="button"
                onClick={approveStory}
                disabled={
                  saving || approved || feedback.trim() !== savedFeedback
                }
                className="mt-4 w-full rounded-lg bg-green-700 px-4 py-3 font-semibold text-white hover:bg-green-800 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {approved ? "Approved" : "Approve Story"}
              </button>
              {feedback.trim() !== savedFeedback && (
                <p className="mt-2 text-sm text-slate-600">
                  Save your feedback before approving.
                </p>
              )}
            </div>

            <p role="status" className="mt-4 text-sm font-medium">
              {message}
            </p>
          </aside>
        </div>
      </div>
    </main>
  );
}
