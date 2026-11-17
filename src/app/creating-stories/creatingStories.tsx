"use client"

import { useState, type ReactNode, type CSSProperties } from "react"
import SetItem from "./components/SetItem"
import StoryToolbar from "./components/StoryToolbar"
import StoryPromptPanel from "./components/StoryPromptPanel"
import { DEFAULT_STORY_PROMPT } from "./components/storyPrompt"
import LegacyCreatingStories from "./LegacyCreatingStories"
import { DrawingSessionProvider } from "./components/drawing/DrawingSession"
import { SidebarProvider } from "@/components/ui/sidebar"
import "./creating-stories.css"
import "./story-workspace.css"

import dynamic from "next/dynamic"
const PersonalCreatingStories = dynamic(() => import("./components/PersonalCreatingStories"), { ssr: false })

const STUDENTS = ["student-1", "student-2", "student-3"]

export function ReferenceCreatingStories({ renderWorkspace }: { renderWorkspace?: (mode: "writing" | "drawing") => ReactNode } = {}) {
  const [studentId, setStudentId] = useState("student-1")
  const [mode, setMode] = useState<"writing" | "drawing">("writing")
  return <main className="story-screen" data-mode={mode}>
    <StoryToolbar mode={mode} onToggleMode={() => setMode((current) => current === "writing" ? "drawing" : "writing")} />
    <DrawingSessionProvider>
      <SidebarProvider defaultOpen={false} className="story-scene" style={{
        "--sidebar-width": "400px", "--header-height": "var(--story-toolbar-height)",
      } as CSSProperties}>
        {mode === "writing" ? <StoryPromptPanel prompt={DEFAULT_STORY_PROMPT} /> : null}
        {/* Keep this owner at the same tree position when switching modes. */}
        {renderWorkspace ? renderWorkspace(mode) : <SetItem key={studentId} studentId={studentId} students={STUDENTS} mode={mode} workspace onSelectStudent={setStudentId} />}
      </SidebarProvider>
    </DrawingSessionProvider>
  </main>
}

export default function CreatingStories() {
  return process.env.NEXT_PUBLIC_CREATING_STORIES_LAYOUT === "legacy" ? <LegacyCreatingStories /> : <PersonalCreatingStories />
}
