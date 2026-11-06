"use client"

import { useEffect, useState } from "react"
import Image from "next/image"
import SetItem from "./components/SetItem"
import ListItems from "./components/ListItems"
import TopBar from "./components/topBar"
import StampSidePanel from "./components/stampSidePanel"
import DrawingSidePanel from "./components/drawingSidePanel"
import WritingSidePanel from "./components/writingSidePanel"
import supabase from "@/src/utils/supabase"
import { AppSidebar } from "@/components/app-sidebar"
import { Separator } from "@/components/ui/separator"
import {
  SidebarInset,
  SidebarProvider,
  SidebarTrigger,
} from "@/components/ui/sidebar"

import '../creating-stories/creating-stories.css'

// 2 pages in the book per student (drawing page on the left, writing page on the right), in this order. TODO: change this in later sprint to use the assigned places / sections
// TESTING ONLY: temp 3 students in the same breakout room
const STUDENTS = ["96947d15-5338-4a61-8d17-834c1404018a", "04c62b9d-7620-4b76-8b88-66518b304f13", "34b572fe-53c3-44bd-a3bc-b1a8a76db7ee"]
// TESTING ONLY: Replace with the room's story later
const STORY_ID = "b06ff1ad-f383-4b77-be1f-7ed5192ef14d"

export default function Home() {
  // TESTING ONLY: pick which student you are. Replace with the logged-in student's id later.
  const [studentId, setStudentId] = useState(STUDENTS[0])
  // TESTING ONLY: display names for the picker (studentId -> display name)
  const [names, setNames] = useState<Record<string, string>>({})

  useEffect(() => {
    supabase.from("profiles").select("id, display_name").in("id", STUDENTS).then(({ data }: { data: { id: string; display_name: string }[] | null }) => {
      const next: Record<string, string> = {}
      data?.forEach((row) => { next[row.id] = row.display_name })
      setNames(next)
    })
  }, [])
  // Writing mode shows the right (writing) page, drawing mode shows the left (drawing) page.
  // Shared by the top bar button and the book.
  const [mode, setMode] = useState<"writing" | "drawing">("writing")

  return (
    <main className="max-h-screen max-w-screen overflow-hidden static">

      {/*Component containing top bar and buttoms */}
      <TopBar
        mode={mode}
        onToggleMode={() => setMode((m) => (m === "writing" ? "drawing" : "writing"))}
      />

      <div className="flex h-screen w-screen relative">

        {/*Component containing left side panel for writing mode (writing functions)
            Should only appear when in writing mode
            is currently a blank panel

            <WritingSidePanel/>
        */}


        {/*Component containing left side panel for drawing mode (stamps and shapes)
            Should only appear when in drawing mode
        */}
        <StampSidePanel />

        <div className="flex flex-1 flex-col items-center overflow-hidden bg-[#C3D0E5] pb-15 z-0 absolute h-screen w-screen">
          {/*Title of the page you are on, plus the (testing only) student picker */}
          <div className="flex w-full items-center justify-center px-6 py-1">
            <h1 className="text-xl text-black">{mode === "writing" ? "Writing Page" : "Drawing Page"}</h1>

            {/* TESTING ONLY: pick which student you are */}
            <select value={studentId} onChange={(e) => setStudentId(e.target.value)} className="text-black">
              {STUDENTS.map((id) => (
                <option key={id} value={id}>{id}</option>
              ))}
            </select>
          </div>

          {/*The book. SetItem loads/saves the stories and renders the book (bookPage) */}
          <SetItem key={studentId} storyId={STORY_ID} studentId={studentId} students={STUDENTS} mode={mode} />

          {/* <ListItems /> */}
        </div>

        {/*Component containing right side panel for drawing mode (drawing tools)
            Should only appear when in drawing mode
        */}
        <DrawingSidePanel />

      </div>
    </main>
  );
}