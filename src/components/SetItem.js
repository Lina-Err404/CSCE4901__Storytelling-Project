"use client"

import { useState, useEffect } from "react"
import db from '../utils/firestore'
import { doc, getDoc, setDoc } from "@firebase/firestore"

const SetItem = ({ studentId }) => {
    const [value, setValue] = useState("")
    const [loading, setLoading] = useState(true)
    const [saved, setSaved] = useState(false)

    // read on page load to show what the student submitted before, if anything
    useEffect(() => {
        const loadItem = async () => {
            const snap = await getDoc(doc(db, 'items', studentId))
            if (snap.exists()) {
                setValue(snap.data().name ?? '')
            }
            setLoading(false)
        }

        loadItem()
    }, [studentId])

    const handleSubmit = async (event) => {
        event.preventDefault()

        try {
            // creates the document the first time, overwrites name after that. merge keeps any other fields
            await setDoc(doc(db, 'items', studentId), { name: value }, { merge: true })
            console.log("Document written with ID: ", studentId)
            setSaved(true)
        } catch (error) {
            console.log('Error writing document: ', error)
        }
    }

    if (loading) return <p>Loading...</p>

    return (
        <form onSubmit={handleSubmit}>
            <textarea
                value={value}
                onChange={(e) => { setValue(e.target.value); setSaved(false) }} // typing to change state without writing to database
                placeholder="Write your story segment"
                rows={8}
            />
            <button type="submit">Submit</button>
            {saved && <span> Submitted!</span>}
        </form>
    )
}

export default SetItem