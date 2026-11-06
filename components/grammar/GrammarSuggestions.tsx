"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";

interface GrammarItem {
  original: string;
  replacement: string;
  explanation?: string;
}

interface GrammarSuggestionsProps {
  text: string;
  onTextChange: (text: string) => void;
  showSuggestions?: boolean;
  onShowSuggestions?: () => void;
  toolbarAction?: ReactNode;
}

type Result = {
  text: string;
  status: "loading" | "success" | "error";
  items: GrammarItem[];
};

// Without offsets, only a unique, complete word/phrase is safe to replace.
function replacementIssue(text: string, item: GrammarItem): string | null {
  const start = text.indexOf(item.original);
  if (!item.original || start < 0) {
    return "I can't find this wording anymore. Try checking again.";
  }
  if (text.indexOf(item.original, start + 1) !== -1) {
    return "These words appear more than once. I can't tell which one to change. You can edit it in your story yourself.";
  }
  const wordCharacter = /[\p{L}\p{N}\p{M}_]/u;
  const before = Array.from(text.slice(0, start)).at(-1) ?? "";
  const after = Array.from(text.slice(start + item.original.length))[0] ?? "";
  const first = Array.from(item.original)[0];
  const last = Array.from(item.original).at(-1) ?? "";
  if (
    (wordCharacter.test(first) && wordCharacter.test(before)) ||
    (wordCharacter.test(last) && wordCharacter.test(after))
  ) {
    return "This looks like part of a longer word. You can edit it in your story yourself.";
  }
  if (item.original === item.replacement) {
    return "These words are already the same. No change is needed.";
  }
  return null;
}

function isGrammarItem(value: unknown): value is GrammarItem {
  if (!value || typeof value !== "object") return false;
  const item = value as Record<string, unknown>;
  return (
    typeof item.original === "string" &&
    item.original.trim().length > 0 &&
    typeof item.replacement === "string" &&
    (item.explanation === undefined || typeof item.explanation === "string")
  );
}

// Mount only while the Suggestions panel is open; unmounting cancels all work.
export default function GrammarSuggestions({
  text,
  onTextChange,
  showSuggestions = true,
  onShowSuggestions,
  toolbarAction,
}: GrammarSuggestionsProps) {
  const [result, setResult] = useState<Result | null>(null);
  const [refresh, setRefresh] = useState(0);
  const previousText = useRef(text);
  const checkButton = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    const delay = previousText.current === text ? 0 : 1500;
    previousText.current = text;
    if (!text.trim()) return;

    const controller = new AbortController();
    // Also guard responses from fetch implementations that ignore abort.
    let active = true;
    const timer = setTimeout(async () => {
      setResult({ text, status: "loading", items: [] });
      try {
        const response = await fetch("/api/suggestions", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ text, mode: "grammar" }),
          signal: controller.signal,
        });
        if (!response.ok) throw new Error("Grammar request failed");
        const data: unknown = await response.json();
        if (
          !data ||
          typeof data !== "object" ||
          !("grammar" in data) ||
          !Array.isArray(data.grammar) ||
          !data.grammar.every(isGrammarItem)
        ) {
          throw new Error("Invalid grammar response");
        }
        if (active) {
          setResult({ text, status: "success", items: data.grammar });
        }
      } catch {
        if (active) setResult({ text, status: "error", items: [] });
      }
    }, delay);

    return () => {
      active = false;
      clearTimeout(timer);
      controller.abort();
    };
  }, [text, refresh]);

  const current = result?.text === text ? result : null;
  const loading = current?.status === "loading";

  function accept(item: GrammarItem) {
    if (current?.status !== "success" || replacementIssue(text, item)) return;
    const start = text.indexOf(item.original);
    // Slicing treats replacement text literally (including $ characters).
    checkButton.current?.focus({ preventScroll: true });
    setResult(null);
    onTextChange(
      text.slice(0, start) + item.replacement + text.slice(start + item.original.length),
    );
  }

  function dismiss(index: number) {
    checkButton.current?.focus({ preventScroll: true });
    setResult((previous) =>
      previous?.text === text && previous.status === "success"
        ? { ...previous, items: previous.items.filter((_, i) => i !== index) }
        : previous,
    );
  }

  return (
    <>
      <div className="mb-3 flex shrink-0 gap-2">
        <button
          ref={checkButton}
          type="button"
          onClick={() => {
            onShowSuggestions?.();
            // Selecting grammar again reuses the current result. Errors can retry.
            if (current?.status === "error") {
              setResult(null);
              setRefresh((value) => value + 1);
            }
          }}
          aria-pressed={showSuggestions}
          className="min-h-11 flex-1 rounded-xl border border-[#b8afd0] bg-[#e3dff0] px-3 py-2 text-sm font-semibold text-[#40345b] hover:bg-[#d4cef0] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#0a4d68]"
        >
          Check Grammar
        </button>
        {toolbarAction}
      </div>
      {showSuggestions && (
        <section className="min-h-0 flex-1 space-y-3 overflow-y-auto overscroll-contain p-1 text-sm text-slate-800" aria-label="Grammar suggestions" aria-busy={loading}>
          <div className="flex items-start justify-between gap-3">
            <div>
              <h3 className="font-serif text-xl font-bold text-[#284b58]">A little story polish</h3>
              <p className="mt-1 text-xs leading-5 text-slate-600">Your story, your choices. Only Accept changes your words.</p>
            </div>
            {current?.status === "success" && <span className="shrink-0 rounded-full bg-[#eee8f6] px-2.5 py-1 text-xs font-semibold text-[#514267]">{current.items.length} to review</span>}
          </div>
          <div role="status" aria-live="polite" aria-atomic="true" className="empty:hidden">
            {!text.trim() ? (
              <div className="rounded-2xl border border-[#d7cce7] bg-[#f5f0fa] p-5"><p className="font-semibold text-[#514267]">Every story starts with a few words</p><p className="mt-2 leading-6">Start writing, and suggestions will appear here when you pause.</p></div>
            ) : !current ? (
              <p className="rounded-2xl border border-[#c8dce2] bg-white/70 p-5 leading-6">Keep creating! I&apos;ll check your writing when you pause.</p>
            ) : loading ? (
              <div className="flex items-center gap-3 rounded-2xl border border-[#c8dce2] bg-white/70 p-5 font-medium"><span aria-hidden="true" className="h-4 w-4 shrink-0 rounded-full border-2 border-[#bed2da] border-t-[#0a4d68] motion-safe:animate-spin" />Checking your words...</div>
            ) : current.status === "error" ? (
              <div className="rounded-2xl border border-[#e2c7b1] bg-[#fff5e9] p-5"><p className="font-semibold text-[#754521]">Let&apos;s try that again</p><p className="mt-2 leading-6">We couldn&apos;t check your story. Your words are still here. Select Check Grammar to retry.</p></div>
            ) : current.items.length === 0 ? (
              <div className="rounded-2xl border border-[#bcd8ca] bg-[#edf7f0] p-5"><p className="font-semibold text-[#28563f]">All caught up!</p><p className="mt-2 leading-6">No suggestions left to review. Keep your story growing.</p></div>
            ) : <p className="sr-only">{current.items.length} grammar suggestions to review.</p>}
          </div>
          {current?.status === "success" && current.items.map((item, index) => {
            const issue = replacementIssue(text, item);
            return (
              <article key={index} aria-label={`Suggestion ${index + 1}`} className="rounded-2xl border border-[#ccd9df] bg-[#fcfdfb] p-4 shadow-sm [overflow-wrap:anywhere]">
                <p className="mb-2 text-xs font-semibold text-slate-500">Suggestion {index + 1}</p>
                <div className="rounded-xl border border-[#ecd3d2] bg-[#fcf0ef] px-3 py-2.5">
                  <p className="mb-1 text-xs font-semibold text-[#89423e]">Original · needs a look</p>
                  <p className="whitespace-pre-wrap text-base leading-6 text-[#743b38]"><del>{item.original}</del></p>
                </div>
                <div className="mt-2 rounded-xl border border-[#c6ddd1] bg-[#eef7f1] px-3 py-2.5">
                  <p className="mb-1 text-xs font-semibold text-[#326047]">Suggested correction</p>
                  <p className="whitespace-pre-wrap text-base font-semibold leading-6 text-[#28563f]">{item.replacement || "(remove this text)"}</p>
                </div>
                <p className="mt-3 whitespace-pre-wrap leading-6 text-slate-600">{item.explanation || "Here's another way to write this part. You choose whether to change it!"}</p>
                {issue && <p id={`grammar-issue-${index}`} className="mt-3 rounded-lg bg-[#fff5e9] p-3 text-xs leading-5 text-[#754521]">{issue}</p>}
                <div className="mt-3 flex gap-2">
                  <button type="button" onClick={() => accept(item)} disabled={!!issue} aria-label={`Accept suggestion ${index + 1}`} aria-describedby={issue ? `grammar-issue-${index}` : undefined} className="min-h-11 flex-1 rounded-xl bg-[#0a4d68] px-3 py-2 font-semibold text-white hover:bg-[#083d53] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#0a4d68] disabled:cursor-not-allowed disabled:bg-slate-200 disabled:text-slate-500">Accept</button>
                  <button type="button" onClick={() => dismiss(index)} aria-label={`Dismiss suggestion ${index + 1}`} className="min-h-11 flex-1 rounded-xl border border-slate-300 bg-white px-3 py-2 font-semibold text-slate-600 hover:bg-slate-100 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#0a4d68]">Dismiss</button>
                </div>
              </article>
            );
          })}
        </section>
      )}
    </>
  );
}
