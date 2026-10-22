"use client"

import { useState, useEffect } from "react"
import db from '../utils/firestore'
import { collection, doc, onSnapshot, setDoc } from "@firebase/firestore"
import BookPage from "./bookPage"

// each student has 2 pages in the book, writing and drawing
// everyone's pages can be read, but a student can only edit their own
const SetItem = ({ studentId, students = [studentId], mode = "writing" }) => {
    const myIndex = students.indexOf(studentId)

    const [stories, setStories] = useState({}) // studentId -> saved story text, from Firestore
    const [draft, setDraft] = useState(null) // unsaved text (null = nothing typed since last save)
    const [index, setIndex] = useState(myIndex) // the page showing on the right, opens on owned page
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState(false)

    // listen to everyone's pages so other students' stories update as they save
    useEffect(() => {
        const unsubscribe = onSnapshot(
            collection(db, 'items'),
            (snapshot) => {
                const next = {}
                snapshot.docs.forEach((d) => { next[d.id] = d.data().name ?? "" })
                setStories(next)
                setLoading(false)
            },
            (err) => {
                console.log('Error reading stories: ', err)
                setError(true)
                setLoading(false)
            }
        )
        return () => unsubscribe()
    }, [])

    const pages = students.map((id) => ({
        id,
        label: id === studentId ? "Your story" : `${id}’s story`,
        text: id === studentId ? (draft ?? stories[id] ?? "") : (stories[id] ?? ""),
        mine: id === studentId,
        drawing: null, // this student's drawing for the left page, to be added later
    }))

    const saved = draft === null || draft === (stories[studentId] ?? "")

    const save = async () => {
        if (draft === null) return
        try {
            await setDoc(doc(db, 'items', studentId), { name: draft }, { merge: true })
            setDraft(null)
            setError(false)
        } catch (err) {
            console.log('Error writing document: ', err)
            setError(true)
        }
    }

    // turning a page away from owned page saves it
    const turn = (dir) => {
        if (index === myIndex) save()
        setIndex((i) => i + (dir === "next" ? 1 : -1))
    }

    if (loading) return <p className="ml-10 text-neutral-500">Opening the book…</p>

    return (
        <BookPage
            pages={pages}
            index={index}
            myIndex={myIndex}
            mode={mode}
            onTurn={turn}
            onJump={() => setIndex(myIndex)}
            onChangeText={setDraft}
            onSave={save}
            saved={saved}
            error={error}
        />
    )
}

export default SetItem