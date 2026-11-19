"use client"

import { useEffect, useLayoutEffect, useRef, useState } from "react"

function isRemaining(value: unknown): value is number {
  return typeof value === "number" && Number.isInteger(value) && value >= 0 && value <= 3
}

// Extracted from feature/writing-suggestions app/page.tsx; R39 keeps its own editor.
export default function WritingSuggestions({ text, onUseIdea, getRequestHeaders }: {
  text: string
  onUseIdea: (idea: string) => void
  getRequestHeaders: () => Promise<Record<string, string>>
}) {
  const [result, setResult] = useState<{ ideas: string[]; demo: boolean } | null>(null)
  const [remaining, setRemaining] = useState<number | null>(null)
  const [usageError, setUsageError] = useState(false)
  const [usageAttempt, retryUsage] = useState(0)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState("")
  const request = useRef<{ controller: AbortController; stale: boolean } | null>(null)

  useEffect(() => {
    const controller = new AbortController()
    async function loadUsage() {
      try {
        const headers = await getRequestHeaders()
        const response = await fetch("/api/suggestions", { headers, cache: "no-store", signal: controller.signal })
        const data = await response.json()
        if (!response.ok || !isRemaining(data?.remainingGenerations)) throw new Error("Usage unavailable")
        if (!controller.signal.aborted) setRemaining(data.remainingGenerations)
      } catch {
        if (!controller.signal.aborted) setUsageError(true)
      }
    }
    void loadUsage()
    return () => controller.abort()
  }, [getRequestHeaders, usageAttempt])

  useEffect(() => () => request.current?.controller.abort(), [])
  useLayoutEffect(() => {
    // Finish the request so the usage count can update, even if the draft has moved on.
    if (request.current) request.current.stale = true
  }, [text])

  async function generateStoryIdeas() {
    if (remaining === null || remaining === 0 || request.current) return
    const current = { controller: new AbortController(), stale: false }
    request.current = current
    const { signal } = current.controller
    setBusy(true)
    setError("")
    try {
      const headers = await getRequestHeaders()
      const response = await fetch("/api/suggestions", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...headers },
        body: JSON.stringify({ text, mode: "generate" }),
        signal,
      })
      const data = await response.json()
      if (signal.aborted) return
      if (response.status === 429 && data?.remainingGenerations === 0) {
        setRemaining(0)
        return
      }
      if (!response.ok) throw new Error("Could not generate ideas. Please try again.")
      if (!isRemaining(data?.remainingGenerations) || !Array.isArray(data.ideas) || data.ideas.length !== 3 ||
        !data.ideas.every((idea: unknown) => typeof idea === "string" && idea.trim().length > 0)) {
        throw new Error("The ideas response was invalid. Please try again.")
      }
      setRemaining(data.remainingGenerations)
      if (current.stale) {
        setError("Your story changed while ideas were being generated.")
      } else {
        setResult({ ideas: data.ideas, demo: data.demo === true })
      }
    } catch (error) {
      if (!signal.aborted) setError(error instanceof Error ? error.message : "Could not generate ideas.")
    } finally {
      request.current = null
      if (!signal.aborted) setBusy(false)
    }
  }

  return <section aria-label="Story continuation ideas" aria-busy={busy} className="story-assistant">
    <p role="status">{remaining === null
      ? usageError ? "Could not check your idea allowance." : "Checking your idea allowance…"
      : `${remaining} of 3 generations remaining`}</p>
    {usageError && <button type="button" className="story-assistant-button" onClick={() => {
      setUsageError(false)
      retryUsage(attempt => attempt + 1)
    }}>Check again</button>}
    <button type="button" className="story-assistant-button" disabled={remaining === null || remaining === 0 || busy}
      onClick={() => { void generateStoryIdeas() }}>{result ? "Generate Again" : "Generate Ideas"}</button>
    <p role="status">{remaining === 0 ? "You’ve used your three idea generations. Keep going with your own ideas!"
      : busy ? "Thinking of ideas…" : error || (result ? "Choose an idea or keep writing your own story." : "Get three ideas for your story.")}</p>
    {result?.demo && <p role="note">Demo ideas: not AI generated.</p>}
    {result?.ideas.map((idea, index) => <article key={index} className="story-assistant-card">
      <p>{idea}</p>
      <button type="button" aria-label={`Use idea ${index + 1}`} className="story-assistant-button"
        onClick={() => onUseIdea(idea)}>Use Idea</button>
    </article>)}
  </section>
}
