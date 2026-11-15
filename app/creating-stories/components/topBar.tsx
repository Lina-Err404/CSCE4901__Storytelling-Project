"use client";
import React from "react";

// The book has the functional Save action. Drawing, timer and submission workflows
// are not implemented; do not display a fake countdown or claim a story was submitted.
export default function TopBar({ mode, prompt, onToggleMode }: {
  mode: "writing" | "drawing"; prompt: string; onToggleMode: () => void;
}) {
  return (
    <header className="flex h-16 w-full items-center justify-between gap-3 border-b bg-[#0F1E4B] px-4">
      <p className="max-w-[65%] truncate rounded-xl bg-white px-5 py-2 text-sm text-black">
        {prompt ? `Prompt: ${prompt}` : "Collaborative Storytelling"}
      </p>
      <button type="button" className="rounded-xl bg-[#F1EADF] px-5 py-2 text-black" onClick={onToggleMode}>
        {mode === "writing" ? "Drawing view" : "Writing view"}
      </button>
    </header>
  );
}
