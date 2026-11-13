"use client"

import { useState, useEffect } from "react"
import supabase from '@/src/utils/supabase'
import BookPage from "./bookPage"

const EMPTY_DOCUMENT = { version: 1, runs: [] }

function documentText(document) {
    return document.runs.map(({ text }) => text).join("")
}

function toWritingDocument(document, text = "") {
    return document?.version === 1 && Array.isArray(document.runs)
        ? document
        : { version: 1, runs: text ? [{ text, marks: {} }] : [] }
}

async function storyApi(path, options = {}) {
    const { data: { session }, error } = await supabase.auth.getSession()
    if (error) throw error
    if (!session) throw new Error("Sign in with your Supabase account to load or save your story.")
    const headers = new Headers(options.headers)
    if (options.body && !headers.has("Content-Type")) {
        headers.set("Content-Type", "application/json")
    }
    headers.set("Authorization", `Bearer ${session.access_token}`)

    const response = await fetch(`/api${path}`, {
        ...options,
        headers,
    })
    const payload = await response.json().catch(() => ({}))
    if (!response.ok) throw new Error(payload.error || `Story request failed (${response.status})`)
    return payload
}

function StorySignIn({ initialError, onSignedIn }) {
    const [email, setEmail] = useState("")
    const [password, setPassword] = useState("")
    const [error, setError] = useState(initialError ?? "")
    const [submitting, setSubmitting] = useState(false)

    const signIn = async (event) => {
        event.preventDefault()
        setSubmitting(true)
        setError("")
        try {
            const { data, error: signInError } = await supabase.auth.signInWithPassword({ email, password })
            if (signInError) throw signInError
            if (!data.session) throw new Error("Supabase did not return an authenticated session.")
            onSignedIn(data.session)
        } catch (reason) {
            setError(reason instanceof Error ? reason.message : String(reason))
        } finally {
            setSubmitting(false)
        }
    }

    return (
        <div className="flex min-h-0 w-full flex-1 items-center justify-center p-6">
            <form onSubmit={signIn} className="w-full max-w-sm space-y-4 rounded-lg border bg-white p-6 shadow-sm">
                <div>
                    <h2 className="text-lg font-semibold text-neutral-900">Sign in to your story</h2>
                    <p className="mt-1 text-sm text-neutral-600">Use your Supabase account.</p>
                </div>
                <label className="block space-y-1 text-sm text-neutral-700">
                    <span>Email</span>
                    <input
                        type="email"
                        autoComplete="email"
                        required
                        value={email}
                        onChange={(event) => setEmail(event.target.value)}
                        className="w-full rounded border border-neutral-300 px-3 py-2"
                    />
                </label>
                <label className="block space-y-1 text-sm text-neutral-700">
                    <span>Password</span>
                    <input
                        type="password"
                        autoComplete="current-password"
                        required
                        value={password}
                        onChange={(event) => setPassword(event.target.value)}
                        className="w-full rounded border border-neutral-300 px-3 py-2"
                    />
                </label>
                {error && <p role="alert" className="text-sm text-red-600">{error}</p>}
                <button
                    type="submit"
                    disabled={submitting}
                    className="w-full rounded bg-neutral-900 px-4 py-2 font-medium text-white disabled:opacity-50"
                >
                    {submitting ? "Signing in…" : "Sign in"}
                </button>
            </form>
        </div>
    )
}

// each student has 2 pages in the book, writing and drawing
// everyone's pages can be read, but a student can only edit their own
const SetItem = ({ storyId, studentId, students = [studentId], mode = "writing" }) => {
    const selectedIndex = students.indexOf(studentId)
    const studentsKey = students.join(",")

    const [stories, setStories] = useState({}) // studentId -> saved story segment, from Supabase
    const [names, setNames] = useState({}) // studentId -> display name, from Supabase
    const [draft, setDraft] = useState(null) // unsaved rich-text document
    const [index, setIndex] = useState(Math.max(0, selectedIndex)) // the page showing on the right
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState(false)
    const [authLoading, setAuthLoading] = useState(true)
    const [session, setSession] = useState(null)
    const [authError, setAuthError] = useState("")

    const myIndex = students.findIndex((id) => stories[id]?.assignedToYou)
    const ownedStudentId = myIndex >= 0 ? students[myIndex] : studentId

    useEffect(() => {
        let mounted = true
        const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, nextSession) => {
            if (!mounted) return
            setSession(nextSession)
            setAuthError("")
            setAuthLoading(false)
        })

        supabase.auth.getSession().then(({ data, error: sessionError }) => {
            if (!mounted) return
            if (sessionError) setAuthError(sessionError.message)
            setSession(data.session)
            setAuthLoading(false)
        }).catch((reason) => {
            if (!mounted) return
            setAuthError(reason instanceof Error ? reason.message : String(reason))
            setAuthLoading(false)
        })

        return () => {
            mounted = false
            subscription.unsubscribe()
        }
    }, [])

    // Load stories through the API; Realtime only triggers a fresh authorized API read.
    useEffect(() => {
        if (authLoading || !session) return
        const load = async () => {
            setLoading(true)
            try {
                const result = await storyApi(`/stories/${storyId}`)
                const next = {}
                result.segments.forEach((segment) => {
                    next[segment.studentId] = {
                        segmentId: segment.segmentId,
                        assignedToYou: segment.assignedToYou,
                        writingDocument: toWritingDocument(segment.writingDocument, segment.writingContent ?? ""),
                    }
                })
                setStories(next)
                const assignedIndex = studentsKey.split(",").indexOf(
                    result.segments.find((segment) => segment.assignedToYou)?.studentId,
                )
                if (assignedIndex >= 0) setIndex(assignedIndex)
                setError(false)
            } catch (reason) {
                console.error('Error reading stories:', reason)
                setError(true)
            } finally {
                setLoading(false)
            }
        }

        void load()
        const channel = supabase
            .channel(`story-${storyId}`)
            .on('postgres_changes', { event: '*', schema: 'public', table: 'story_segments', filter: `story_id=eq.${storyId}` }, load)
            .subscribe()

        return () => { supabase.removeChannel(channel) }
    }, [authLoading, session, storyId, studentsKey])

    // get the display name of every student in the book
    useEffect(() => {
        if (!session) return
        const loadNames = async () => {
            const { data, error: err } = await supabase
                .from('profiles')
                .select('id, display_name')
                .in('id', studentsKey.split(","))
            if (err) {
                console.log('Error reading names: ', err)
                return
            }
            const next = {}
            data.forEach((row) => { next[row.id] = row.display_name })
            setNames(next)
        }
        loadNames()
    }, [session, studentsKey])

    const pages = students.map((id) => {
        const writingDocument = id === ownedStudentId && draft !== null
            ? draft
            : stories[id]?.writingDocument ?? EMPTY_DOCUMENT
        const isMine = Boolean(stories[id]?.assignedToYou)
        return {
            id,
            name: names[id] ?? "A student",
            label: isMine ? "Your story" : `${names[id] ?? "A student"}’s story`,
            text: documentText(writingDocument),
            writingDocument,
            mine: isMine,
            drawing: null, // this student's drawing for the left page, to be added later
        }
    })

    const savedDocument = stories[ownedStudentId]?.writingDocument ?? EMPTY_DOCUMENT
    const saved = draft === null || JSON.stringify(draft) === JSON.stringify(savedDocument)

    const save = async () => {
        if (draft === null || !stories[ownedStudentId]) return
        const writingContent = documentText(draft)
        try {
            const savedSegment = await storyApi(`/story-segments/${stories[ownedStudentId].segmentId}`, {
                method: "PUT",
                body: JSON.stringify({ writingContent, writingDocument: draft }),
            })
            setStories((previous) => ({
                ...previous,
                [ownedStudentId]: {
                    ...previous[ownedStudentId],
                    writingDocument: savedSegment.writingDocument,
                },
            }))
            setDraft(null)
            setError(false)
        } catch (reason) {
            console.error('Error saving story:', reason)
            setError(true)
        }
    }

    // turning a page away from owned page saves it
    const turn = (dir) => {
        if (index === myIndex) void save()
        setIndex((i) => i + (dir === "next" ? 1 : -1))
    }

    const signOut = async () => {
        try {
            const { error: signOutError } = await supabase.auth.signOut()
            if (signOutError) throw signOutError
        } catch (reason) {
            console.error('Error signing out of story account:', reason)
            setAuthError(reason instanceof Error ? reason.message : String(reason))
        }
    }

    if (authLoading) return <p className="ml-10 text-neutral-500">Checking Supabase session…</p>
    if (!session) return <StorySignIn initialError={authError} onSignedIn={setSession} />
    if (loading) return <p className="ml-10 text-neutral-500">Opening the book…</p>

    return (
        <div className="relative flex min-h-0 w-full flex-1 flex-col">
            <div className="flex shrink-0 items-center justify-end gap-3 px-6 py-1 text-sm">
                <span className="text-neutral-700">{session.user.email}</span>
                <button type="button" onClick={signOut} className="text-neutral-700 underline">
                    Sign out
                </button>
                {authError && <span role="alert" className="text-red-600">{authError}</span>}
            </div>
            <BookPage
                pages={pages}
                index={index}
                myIndex={myIndex >= 0 ? myIndex : selectedIndex}
                mode={mode}
                onTurn={turn}
                onJump={() => setIndex(myIndex)}
                onChangeDocument={setDraft}
                onSave={save}
                saved={saved}
                error={error}
            />
        </div>
    )
}

export default SetItem