"use client"

import { useState, useEffect } from "react"
import supabase from '@/src/utils/supabase'
import { auth } from "@/src/app/firebase-client"
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
    const devBypassEnabled = process.env.NODE_ENV !== "production" &&
        process.env.NEXT_PUBLIC_ALLOW_DEV_MODE === "true"
    const devStudentUid = process.env.NEXT_PUBLIC_TEST_STUDENT_UID?.trim()
    let user = null
    if (auth) {
        await auth.authStateReady()
        user = auth.currentUser
    }

    const headers = new Headers(options.headers)
    if (options.body && !headers.has("Content-Type")) {
        headers.set("Content-Type", "application/json")
    }
    if (user) {
        headers.set("Authorization", `Bearer ${await user.getIdToken()}`)
    } else if (devBypassEnabled && devStudentUid) {
        headers.set("x-test-student-uid", devStudentUid)
    } else if (devBypassEnabled) {
        throw new Error("Set NEXT_PUBLIC_TEST_STUDENT_UID to use the local story auth bypass.")
    } else if (!auth) {
        throw new Error("Firebase authentication is not configured.")
    } else {
        throw new Error("Sign in to load or save your story.")
    }

    const response = await fetch(`/api${path}`, {
        ...options,
        headers,
    })
    const payload = await response.json().catch(() => ({}))
    if (!response.ok) throw new Error(payload.error || `Story request failed (${response.status})`)
    return payload
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

    const myIndex = students.findIndex((id) => stories[id]?.assignedToYou)
    const ownedStudentId = myIndex >= 0 ? students[myIndex] : studentId

    // Load stories through the API; Realtime only triggers a fresh authorized API read.
    useEffect(() => {
        const load = async () => {
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
    }, [storyId, studentsKey])

    // get the display name of every student in the book
    useEffect(() => {
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
    }, [studentsKey])

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

    if (loading) return <p className="ml-10 text-neutral-500">Opening the book…</p>

    return (
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
    )
}

export default SetItem