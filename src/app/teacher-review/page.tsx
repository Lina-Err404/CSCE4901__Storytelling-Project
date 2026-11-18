"use client";

import { use, useEffect, useState } from "react";
import {
  approveSegment,
  loadSegments,
  saveFeedback,
  type Segment,
} from "@/lib/storyReview";

// The story to review comes from the URL, e.g. /teacher-review?id=<story uuid>.
// Until login (Supabase Auth) is in, the teacher id comes from .env.local.
const DEV_TEACHER_ID = process.env.NEXT_PUBLIC_DEV_TEACHER_ID ?? "";

export default function TeacherReviewPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const { id } = use(searchParams);
  const storyId = typeof id === "string" ? id : "";

  const [segments, setSegments] = useState<Segment[] | null>(null);
  const [loadError, setLoadError] = useState("");
  const [reloadKey, setReloadKey] = useState(0);

  // Load the story's segments and their saved feedback/approval.
  useEffect(() => {
    if (!storyId) {
      setLoadError("No story selected. Add ?id=<story id> to the URL.");
      return;
    }
    let active = true;
    loadSegments(storyId)
      .then((loaded) => {
        if (!active) return;
        if (loaded.length === 0) {
          setLoadError("This story has no segments yet.");
          return;
        }
        setSegments(loaded);
      })
      .catch((error) => {
        if (!active) return;
        console.error("Failed to load story:", error?.message, error?.details, error?.hint, error?.code);
        setLoadError("Could not load this story. Please try again.");
      });
    return () => {
      active = false;
    };
  }, [storyId, reloadKey]);

  function retryLoad() {
    setLoadError("");
    setReloadKey((key) => key + 1);
  }

  if (loadError || !segments) {
    return (
      <main className="min-h-screen bg-[#1e4d85] px-4 py-8 text-white sm:px-8">
        <div role="status" className="mx-auto max-w-6xl">
          <p>{loadError || "Loading story..."}</p>
          {loadError && storyId && (
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

  const approvedCount = segments.filter(
    (segment) => segment.status === "approved"
  ).length;

  return (
    <main className="min-h-screen bg-gradient-to-b from-[#0e102a] via-[#13204a] to-[#134780] p-3 text-slate-900 outline outline-4 -outline-offset-[12px] outline-[#d5def0] sm:p-5">
      <header className="grid grid-cols-[2.5rem_minmax(0,1fr)_2.5rem] items-center gap-2 px-6 pt-5 text-white sm:px-10">
        <button
          type="button"
          aria-label="Go back"
          onClick={() => window.history.back()}
          className="rounded-lg bg-[#cad9eb] px-3 py-1 text-2xl leading-none text-[#19477f] hover:bg-white"
        >
          ←
        </button>
        <h1 className="text-center text-2xl font-bold sm:text-3xl">Teacher Review</h1>
      </header>

      <div className="mx-auto max-w-6xl px-4 py-6 sm:px-8">
        <div className="mb-5 flex flex-wrap justify-between gap-2 text-sm text-white">
          <p>Read each student&apos;s part, leave feedback, and approve it.</p>
          <p role="status" className="font-semibold">
            {approvedCount} of {segments.length} parts approved
          </p>
        </div>

        <div className="space-y-6">
          {segments.map((segment) => (
            <SegmentCard
              key={segment.id}
              segment={segment}
              onApproved={() =>
                setSegments((current) =>
                  current
                    ? current.map((part) =>
                        part.id === segment.id
                          ? { ...part, status: "approved" }
                          : part
                      )
                    : current
                )
              }
            />
          ))}
        </div>
      </div>
    </main>
  );
}
// Turn a database section name like "rising_action" into "Rising Action".
function formatSection(section: string) {
  return section
    .split("_")
    .filter(Boolean)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}

// One student's segment with its own feedback box and approve button.
function SegmentCard({
  segment,
  onApproved,
}: {
  segment: Segment;
  onApproved: () => void;
}) {
  const [feedback, setFeedback] = useState(segment.feedback);
  const [savedFeedback, setSavedFeedback] = useState(segment.feedback);
  const [approved, setApproved] = useState(segment.status === "approved");
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");

  const unsaved = feedback.trim() !== savedFeedback;
  const fieldId = `feedback-${segment.id}`;

  async function handleSave() {
    const trimmed = feedback.trim();
    setSaving(true);
    try {
      await saveFeedback(segment.id, DEV_TEACHER_ID, trimmed);
      setSavedFeedback(trimmed);
      setFeedback(trimmed);
      setMessage("Feedback saved.");
    } catch (error) {
      console.error("Failed to save feedback:", (error as { message?: string })?.message, (error as { details?: string })?.details, (error as { hint?: string })?.hint, (error as { code?: string })?.code);
      setMessage("Could not save feedback. Please try again.");
    } finally {
      setSaving(false);
    }
  }

  async function handleApprove() {
    setSaving(true);
    try {
      await approveSegment(segment.id, DEV_TEACHER_ID);
      setApproved(true);
      onApproved();
      setMessage("Part approved.");
    } catch (error) {
      console.error("Failed to approve segment:", (error as { message?: string })?.message, (error as { details?: string })?.details, (error as { hint?: string })?.hint, (error as { code?: string })?.code);
      setMessage("Could not approve this part. Please try again.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <section className="grid gap-4 md:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
      <article className="min-w-0 rounded-xl border-[3px] border-[#7898bd] bg-[#f0e8db] p-5 text-[#134780] shadow-lg sm:p-6">
        <div className="mt-4 whitespace-pre-wrap break-words border border-[#134780] bg-[#f5f2ec] p-5 leading-relaxed text-slate-900">
          <p className="text-sm font-semibold">
            {formatSection(segment.section) || `Part ${segment.order}`}
          </p>
          <span className="rounded-full bg-white px-3 py-1 text-xs font-semibold">
            {approved ? "Approved" : "Awaiting review"}
          </span>
        </div>
        {segment.title && (
          <h2 className="mt-4 text-xl font-bold">{segment.title}</h2>
        )}
        <div className="mt-4 whitespace-pre-wrap break-words rounded-xl bg-white p-5 leading-relaxed">
          {segment.content}
        </div>
      </article>

      <aside className="min-w-0 self-start rounded-xl border-[3px] border-[#f4b657] bg-[#f0e8db] p-5 text-[#134780] shadow-lg">
        <h3 className="mb-3 font-bold">Teacher Feedback</h3>
        <label htmlFor={fieldId} className="mb-2 block text-sm font-medium">
          Feedback for this part
        </label>
        <textarea
          id={fieldId}
          rows={5}
          value={feedback}
          readOnly={saving}
          onChange={(event) => {
            setFeedback(event.target.value);
            setMessage("");
          }}
          placeholder="Share what worked well and what could improve..."
          className="w-full rounded-lg border border-slate-400 p-3 focus:outline-2 focus:outline-offset-2 focus:outline-blue-700"
        />
        <button
          type="button"
          onClick={handleSave}
          disabled={saving || !unsaved || !feedback.trim()}
          className="mt-3 w-full rounded-lg bg-[#00566b] px-4 py-2.5 font-semibold text-white hover:bg-[#004353] disabled:cursor-not-allowed disabled:opacity-50"
        >
          Save Feedback
        </button>

        <div className="mt-5 border-t border-slate-200 pt-4">
          <h3 className="text-sm font-semibold">Part approval</h3>
          {!approved && (unsaved || !savedFeedback) && (
            <p className="mt-2 text-sm text-slate-600">
              Write and save feedback before approving.
            </p>
          )}
          <button
            type="button"
            onClick={handleApprove}
            disabled={saving || approved || unsaved || !savedFeedback}
            className="mt-3 w-full rounded-lg bg-green-700 px-4 py-2.5 font-semibold text-white hover:bg-green-800 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {approved ? "Approved" : "Approve Part"}
          </button>
        </div>
        <p role="status" className="mt-3 text-sm font-medium">
          {message}
        </p>
      </aside>
    </section>
  );
}