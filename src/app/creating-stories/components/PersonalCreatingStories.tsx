"use client"

import { useEffect, useRef, useState } from "react"
import { onAuthStateChanged, type User } from "firebase/auth"
import { auth } from "../../firebase-client"
import { AuthScreen } from "../../auth-screen"
import { ReferenceCreatingStories } from "../creatingStories"
import StoryWorkspace from "./StoryWorkspace"
import { useDrawingSession } from "./drawing/DrawingSession"
import { drawingPageKey } from "./drawing/drawingModel"
import { emptyHistory } from "./drawing/drawingHistory"
import { createDrawingDocument, readDrawingDocument } from "./drawing/drawingDocument"

async function request(user: User, options: RequestInit = {}) {
  const token = await user.getIdToken()
  const response = await fetch("/api/personal-story", { ...options, cache: "no-store", headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" } })
  const body = await response.json()
  if (!response.ok) throw new Error(body.error || "Could not save your page.")
  return body
}

export function PersonalStory({ user, mode }: { user: User; mode: "writing" | "drawing" }) {
  const { histories, restoreHistory } = useDrawingSession()
  const identity = { studentId: user.uid, pageId: "drawing", storyId: null }
  const history = histories[drawingPageKey(user.uid)] ?? emptyHistory
  const [text, setText] = useState("")
  const [snapshot, setSnapshot] = useState<{ text: string; history: string; revision: number } | null>(null)
  const [error, setError] = useState("")
  const [attempt, retry] = useState(0)
  const [saving, setSaving] = useState(false)
  const flight = useRef(false)
  const mounted = useRef(false)
  useEffect(() => {
    mounted.current = true
    return () => { mounted.current = false }
  }, [])
  useEffect(() => {
    let cancelled = false
    const controller = new AbortController()
    request(user, { signal: controller.signal }).then(body => {
      if (cancelled) return
      if (typeof body.text !== "string" || !Number.isSafeInteger(body.revision) || body.revision < 0) throw new Error("Saved page data is invalid.")
      const restored = body.drawing === null ? emptyHistory : readDrawingDocument(body.drawing, { studentId: user.uid, pageId: "drawing", storyId: null }).history
      restoreHistory(user.uid, restored)
      setText(body.text); setSnapshot({ text: body.text, history: JSON.stringify(restored), revision: body.revision }); setError("")
    }).catch(error => { if (!cancelled) setError(error instanceof Error ? error.message : "Could not load your page.") })
    return () => { cancelled = true; controller.abort() }
  }, [user, restoreHistory, attempt])
  const dirty = Boolean(snapshot && (snapshot.text !== text || snapshot.history !== JSON.stringify(history)))
  useEffect(() => {
    if (!dirty && !saving) return
    const warn = (event: BeforeUnloadEvent) => { event.preventDefault(); event.returnValue = "" }
    window.addEventListener("beforeunload", warn)
    return () => window.removeEventListener("beforeunload", warn)
  }, [dirty, saving])
  async function save() {
    if (!snapshot || flight.current || !dirty) return
    flight.current = true; setSaving(true); setError("")
    try {
      const drawing = createDrawingDocument(identity, history)
      const result = await request(user, { method: "PUT", body: JSON.stringify({ text, drawing, revision: snapshot.revision }) })
      if (!Number.isSafeInteger(result.revision) || result.revision !== snapshot.revision + 1) throw new Error("Save response is invalid. Reload before retrying.")
      if (mounted.current) setSnapshot({ text, history: JSON.stringify(drawing.history), revision: result.revision })
    } catch (error) { if (mounted.current) setError(error instanceof Error ? error.message : "Could not save your page.") }
    finally { flight.current = false; if (mounted.current) setSaving(false) }
  }
  if (!snapshot) return <section className="story-workspace" role="status">{error || "Loading your saved page..."}{error && <button type="button" onClick={() => retry(value => value + 1)}>Retry loading</button>}</section>
  return <StoryWorkspace pages={[{ id: user.uid, label: "Your story", text, mine: true }]} index={0} myIndex={0}
    studentId={user.uid} students={[user.uid]} mode={mode} DrawingBook={() => null} permanent
    saved={!dirty} saving={saving} error={Boolean(error)} saveStatus={saving ? "Saving..." : error ? `Save failed: ${error}` : dirty ? "Unsaved changes" : "Saved"}
    onChangeText={setText} onSave={() => { void save() }} onJump={() => {}} onTurn={() => {}} />
}

export default function PersonalCreatingStories() {
  const [user, setUser] = useState<User | null | undefined>(undefined)
  useEffect(() => {
    if (!auth) return
    return onAuthStateChanged(auth, setUser)
  }, [])
  if (!auth) return <p>Firebase authentication is not configured. Configure NEXT_PUBLIC_FIREBASE_* and restart the app.</p>
  if (user === undefined) return <p role="status">Checking sign-in...</p>
  if (!user) return <AuthScreen />
  return <ReferenceCreatingStories key={user.uid} renderWorkspace={mode => <PersonalStory user={user} mode={mode} />} />
}
