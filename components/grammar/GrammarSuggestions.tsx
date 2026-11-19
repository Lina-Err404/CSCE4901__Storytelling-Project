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
  getRequestHeaders?: () => Promise<Record<string, string>>;
}

type Result = {
  text: string;
  status: "loading" | "success" | "error";
  items: GrammarItem[];
  demo?: boolean;
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
  getRequestHeaders,
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
          headers: { "Content-Type": "application/json", ...await getRequestHeaders?.() },
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
          setResult({ text, status: "success", items: data.grammar, demo: "demo" in data && data.demo === true });
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
  }, [text, refresh, getRequestHeaders]);

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
      <div className="story-assistant-actions">
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
          className="story-assistant-button"
        >
          Check Grammar
        </button>
        {toolbarAction}
      </div>
      {showSuggestions && (
        <section className="story-assistant" aria-label="Grammar suggestions" aria-busy={loading}>
          {current?.demo && <p role="note">Demo suggestions: not AI feedback.</p>}
          {current?.status === "success" && <p>{current.items.length} to review</p>}
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
              <article key={index} aria-label={`Suggestion ${index + 1}`} className="story-assistant-card">
                <p><strong>Original</strong><br /><del>{item.original}</del></p>
                <p><strong>Suggested correction</strong><br />{item.replacement || "(remove this text)"}</p>
                <p>{item.explanation || "Here's another way to write this part. You choose whether to change it!"}</p>
                {issue && <p id={`grammar-issue-${index}`}>{issue}</p>}
                <div className="story-assistant-actions">
                  <button type="button" onClick={() => accept(item)} disabled={!!issue} aria-label={`Accept suggestion ${index + 1}`} aria-describedby={issue ? `grammar-issue-${index}` : undefined} className="story-assistant-button">Accept</button>
                  <button type="button" onClick={() => dismiss(index)} aria-label={`Dismiss suggestion ${index + 1}`} className="story-assistant-button story-assistant-secondary">Dismiss</button>
                </div>
              </article>
            );
          })}
        </section>
      )}
    </>
  );
}
