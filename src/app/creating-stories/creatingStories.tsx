"use client"

import { useEffect, useState } from "react"
import SetItem from "./components/SetItem"
import TopBar from "./components/topBar"
import StampSidePanel from "./components/stampSidePanel"
import DrawingSidePanel from "./components/drawingSidePanel"
import WritingSidePanel from "./components/writingSidePanel"
import { useHotkey } from '@tanstack/react-hotkeys'

import '../creating-stories/creating-stories.css'

// 2 pages in the book per student (drawing page on the left, writing page on the right), in this order. TODO: change this in later sprint to use the assigned places / sections
// TESTING ONLY: the signed-in Supabase user must match one of these students.
const STUDENTS = [
  "96947d15-5338-4a61-8d17-834c1404018a",
  "04c62b9d-7620-4b76-8b88-66518b304f13",
  "34b572fe-53c3-44bd-a3bc-b1a8a76db7ee",
  "ce89c365-eba1-4883-84a3-96667cd11657",
  "956e5c96-141b-4ee9-bf79-66a8a26e78ea",
]
// TESTING ONLY: Replace with the room's story later
const STORY_ID = "b06ff1ad-f383-4b77-be1f-7ed5192ef14d"

const DESIGN_W = 1600
const DESIGN_H = 900

export default function Home() {
  // Writing mode shows the right (writing) page, drawing mode shows the left (drawing) page.
  // Shared by the top bar button and the book.
  const [mode, setMode] = useState<"writing" | "drawing">("writing")

  const [view, setView] = useState<{ scale: number; w: number; h: number } | null>(null)
  useEffect(() => {
    const fit = () => {
      const scale = Math.min(window.innerWidth / DESIGN_W, window.innerHeight / DESIGN_H)
      setView({ scale, w: window.innerWidth / scale, h: window.innerHeight / scale })
    }
    fit()
    window.addEventListener("resize", fit)
    return () => window.removeEventListener("resize", fit)
  }, [])

  // Keyboard shortcut
  useHotkey("M", () => setMode((current) => current === "writing" ? "drawing" : "writing"))

  return (
    <main className="fixed inset-0 overflow-hidden bg-[#C3D0E5]">
      <div
        className="flex origin-top-left flex-col overflow-hidden"
        style={{
          width: view?.w ?? DESIGN_W,
          height: view?.h ?? DESIGN_H,
          transform: `scale(${view?.scale ?? 1})`,
          visibility: view ? "visible" : "hidden",
        }}
      >
        <TopBar
          mode={mode}
          onToggleMode={() => setMode((current) => current === "writing" ? "drawing" : "writing")}
        />

        <div className="relative min-h-0 flex-1">
          {/* Switch the left panel depending on mode. */}
          {mode === "drawing" ? <StampSidePanel /> : <WritingSidePanel />}

          <div className="absolute inset-0 z-0 flex flex-col items-center justify-center overflow-hidden bg-[#C3D0E5] pb-2">
            <div className="flex w-[1600px] shrink-0 flex-col items-center" style={{ height: DESIGN_H - 65 }}>
              <div className="flex w-full shrink-0 items-center justify-center gap-4 px-6 py-1">
                <h1 className="text-xl text-black">{mode === "writing" ? "Writing Page" : "Drawing Page"}</h1>
              </div>

              {/* SetItem authenticates the student and loads/saves the story and book pages. */}
              <SetItem storyId={STORY_ID} studentId={STUDENTS[0]} students={STUDENTS} mode={mode} />
            </div>
          </div>

          {/* Show the right drawing panel only in drawing mode. */}
          {mode === "drawing" ? <DrawingSidePanel /> : <div />}
        </div>
      </div>
    </main>
  )
}
