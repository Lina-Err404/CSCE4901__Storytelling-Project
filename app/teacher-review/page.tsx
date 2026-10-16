"use client";

import { useState } from "react";

// Sample completed story for frontend development.
// Replace this with backend data when integrating with Shanti.
const sampleStory = {
  title: "The Secret Door",
  group: "Group 1",
  authors: "Heather, Marcus, and Sam",
  text: [
    "Maya found a tiny golden key beneath the library window. Attached to it was a note: Find the door that nobody sees.",
    "She asked her friends to help. Together, they discovered a door hidden behind a shelf of dusty books. The key fit perfectly.",
    "Inside was a garden filled with glowing flowers. They decided to protect its secret and return every afternoon for a new adventure.",
  ],
};

export default function TeacherReviewPage() {
  const [feedback, setFeedback] = useState("");
  const [savedFeedback, setSavedFeedback] = useState("");
  const [approved, setApproved] = useState(false);
  const [message, setMessage] = useState("");

  // Save feedback locally for this demo.
  function saveFeedback() {
    setSavedFeedback(feedback.trim());
    setMessage("Feedback saved for this demo session.");
  }

  // Approval is local until the backend is connected.
  function approveStory() {
    setApproved(true);
    setMessage("Story approved for this demo session.");
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
          <p className="mt-3 text-sm text-blue-100">
            Sample data — feedback and approval reset on refresh.
          </p>
        </header>

        <div className="grid gap-6 lg:grid-cols-[1fr_360px]">
          <article className="rounded-2xl bg-[#cad9eb] p-6 shadow-lg sm:p-8">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <p className="text-sm font-semibold">{sampleStory.group}</p>
              <span className="rounded-full bg-white px-3 py-1 text-sm font-semibold">
                {approved ? "Approved" : "Awaiting review"}
              </span>
            </div>

            <h2 className="mt-5 text-2xl font-bold">{sampleStory.title}</h2>
            <p className="mt-2 text-sm">
              Written by {sampleStory.authors}
            </p>

            <div className="mt-6 space-y-5 rounded-xl bg-white p-6 leading-8">
              {sampleStory.text.map((paragraph, index) => (
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
                !feedback.trim() || feedback.trim() === savedFeedback
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
                disabled={approved || feedback.trim() !== savedFeedback}
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