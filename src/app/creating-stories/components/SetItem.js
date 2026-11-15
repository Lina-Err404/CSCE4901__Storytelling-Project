"use client"

import { useState, useEffect } from "react"
import supabase from '@/src/utils/supabase'
import BookPage from "./bookPage"

// each student writes one section of the story, in book order. TODO: change this later to use the assigned sections
const SECTIONS = ["exposition", "rising_action", "climax", "falling_action", "resolution"]

// each student has 2 pages in the book, writing and drawing
// everyone's pages can be read, but a student can only edit their own
const SetItem = ({ storyId, studentId, students = [studentId], mode = "writing" }) => {
    const myIndex = students.indexOf(studentId)
    const section = SECTIONS[myIndex] // the section of the story this student writes

    const [stories, setStories] = useState({}) // studentId -> saved story text, from Supabase
    const [names, setNames] = useState({}) // studentId -> display name, from Supabase
    const [draft, setDraft] = useState(null) // unsaved text (null = nothing typed since last save)
    const [index, setIndex] = useState(myIndex) // the page showing on the right, opens on owned page
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState(false)

    // listen to everyone's pages so other students' stories update as they save
    useEffect(() => {
        const load = async () => {
            const { data, error: err } = await supabase
                .from('story_segments')
                .select('student_id, writing_content')
                .eq('story_id', storyId)
            if (err) {
                console.log('Error reading stories: ', err)
                setError(true)
            } else {
                const next = {}
                data.forEach((row) => { next[row.student_id] = row.writing_content ?? "" })
                setStories(next)
            }
            setLoading(false)
        }

        load()
        const channel = supabase
            .channel(`story-${storyId}`)
            .on('postgres_changes', { event: '*', schema: 'public', table: 'story_segments', filter: `story_id=eq.${storyId}` }, load)
            .subscribe()

        return () => { supabase.removeChannel(channel) }
    }, [storyId])

    // get the display name of every student in the book
    useEffect(() => {
        const loadNames = async () => {
            const { data, error: err } = await supabase
                .from('profiles')
                .select('id, display_name')
                .in('id', students)
            if (err) {
                console.log('Error reading names: ', err)
                return
            }
            const next = {}
            data.forEach((row) => { next[row.id] = row.display_name })
            setNames(next)
        }
        loadNames()
    }, [students.join(",")])

    const pages = students.map((id) => ({
        id,
        name: names[id] ?? "A student",
        label: id === studentId ? "Your story" : `${names[id] ?? "A student"}’s story`,
        text: id === studentId ? (draft ?? stories[id] ?? "") : (stories[id] ?? ""),
        mine: id === studentId,
        drawing: null, // this student's drawing for the left page, to be added later
    }))

    const saved = draft === null || draft === (stories[studentId] ?? "")

    const save = async () => {
        if (draft === null) return
        const { error: err } = await supabase
            .from('story_segments')
            .upsert(
                { story_id: storyId, student_id: studentId, section, writing_content: draft },
                { onConflict: 'story_id,section,section_order' }
            )
        if (err) {
            console.log('Error writing document: ', err)
            setError(true)
            return
        }
        setStories((prev) => ({ ...prev, [studentId]: draft })) // keep the saved text showing
        setDraft(null)
        setError(false)
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