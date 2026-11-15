"use client";

import { useState, useEffect } from "react";
import { getAccessToken } from "@/app/supabase-client";
import BookPage from "./bookPage";

/**
 * @typedef {{ id: string, name: string, content: string }} StoryStudent
 */
/**
 * @param {{ storyId: string, studentId: string, students: StoryStudent[], mode?: "writing" | "drawing" }} props
 */
const SetItem = ({ storyId, studentId, students: initialStudents = [], mode = "writing" }) => {
  const [students, setStudents] = useState(initialStudents);
  const [draft, setDraft] = useState(null);
  const [index, setIndex] = useState(Math.max(0, initialStudents.findIndex((s) => s.id === studentId)));
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [approved, setApproved] = useState(false);

  useEffect(() => {
    let alive = true;
    const refresh = async () => {
      try {
        const response = await fetch(`/api/stories/${encodeURIComponent(storyId)}`, {
          headers: { Authorization: `Bearer ${await getAccessToken()}` }, cache: "no-store",
        });
        const result = await response.json();
        if (!response.ok) throw new Error(result.error || "Cannot read story");
        if (alive) {
          setStudents(result.story.students);
          setApproved(result.story.status === "approved");
          setError(false);
          setLoading(false);
        }
      } catch (err) {
        console.error("Could not refresh group story", err);
        if (alive) { setError(true); setLoading(false); }
      }
    };
    void refresh();
    const interval = window.setInterval(refresh, 5000); // server-validated polling; no direct database access
    return () => { alive = false; window.clearInterval(interval); };
  }, [storyId]);

  const myIndex = students.findIndex((s) => s.id === studentId);
  const myContent = students.find((s) => s.id === studentId)?.content ?? "";
  const pages = students.map((student) => ({
    id: student.id,
    label: student.id === studentId ? "Your story" : `${student.name}’s story`,
    text: student.id === studentId ? (draft ?? student.content) : student.content,
    mine: student.id === studentId && !approved,
    drawing: null,
  }));
  const saved = draft === null || draft === myContent || approved;
  const save = async () => {
    if (draft === null || approved) return;
    try {
      const response = await fetch(`/api/stories/${encodeURIComponent(storyId)}/sections`, {
        method: "PUT",
        headers: { Authorization: `Bearer ${await getAccessToken()}`, "Content-Type": "application/json" },
        body: JSON.stringify({ content: draft }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Could not save");
      setStudents((current) => current.map((s) => s.id === studentId ? { ...s, content: draft } : s));
      setDraft(null);
      setError(false);
    } catch (err) {
      console.error("Could not save story section", err);
      setError(true);
    }
  };
  const turn = (dir) => {
    if (index === myIndex && draft !== null) void save();
    setIndex((i) => Math.min(Math.max(i + (dir === "next" ? 1 : -1), 0), pages.length - 1));
  };

  if (loading) return <p className="ml-10 text-neutral-700">Opening the book…</p>;
  if (myIndex < 0) return <p role="alert" className="p-6 text-red-700">You are not currently assigned to this story.</p>;
  return <>
    {approved && <p role="status" className="text-sm font-semibold text-green-900">Your teacher approved this story. Editing is closed.</p>}
    <BookPage pages={pages} index={Math.min(index, pages.length - 1)} myIndex={myIndex} mode={mode}
      onTurn={turn} onJump={() => setIndex(myIndex)} onChangeText={setDraft} onSave={save}
      saved={saved} error={error} />
  </>;
};
export default SetItem;
