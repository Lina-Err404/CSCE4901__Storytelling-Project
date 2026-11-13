"use client"

import { useState } from "react"
import SetItem from "./components/SetItem"
import TopBar from "./components/topBar"
import { AppSidebar } from "@/components/app-sidebar"
import {
  SidebarInset,
  SidebarProvider,
} from "@/components/ui/sidebar"

import '../creating-stories/creating-stories.css'

// 2 pages in the book per student (drawing page on the left, writing page on the right), in this order. TODO: change this in later sprint to use the assigned places / sections
// TESTING ONLY: the signed-in Supabase user must match one of these students.
const STUDENTS = ["96947d15-5338-4a61-8d17-834c1404018a", "04c62b9d-7620-4b76-8b88-66518b304f13", "34b572fe-53c3-44bd-a3bc-b1a8a76db7ee"]
// TESTING ONLY: Replace with the room's story later
const STORY_ID = "b06ff1ad-f383-4b77-be1f-7ed5192ef14d"

export default function Home() {
  // Writing mode shows the right (writing) page, drawing mode shows the left (drawing) page.
  // Shared by the top bar button and the book.
  const [mode, setMode] = useState<"writing" | "drawing">("writing")

  return (
    <main className="max-h-screen max-w-screen overflow-hidden">
      <div>
        {/*Component containing top bar and buttoms */}
        <TopBar
          mode={mode}
          onToggleMode={() => setMode((m) => (m === "writing" ? "drawing" : "writing"))}
        />
        <SidebarProvider
          className="h-[calc(100svh-4rem-var(--footer-height,0px))] min-h-0"
          style={
            {
              "--sidebar-width": "400px",
            } as React.CSSProperties
          }
        >

          {/*
      This contains the trigger for the sidebar that will be reworked in the next sprint
      To open and close the side bar: tap anywhere on the screen that isn't the sidebar and hit CTRL-B

         <SidebarInset>
            <header className="h-16 w-full border-b bg-[#134790]">
            <SidebarTrigger className="-ml-1" />
            <Separator
              orientation="vertical"
              className="mr-2 data-vertical:h-4 data-vertical:self-auto"
            />
            </header>
          </SidebarInset>*/}

          <AppSidebar />
          <SidebarInset className="min-h-0 overflow-hidden bg-[#C3D0E5]">
            <div className="flex min-h-0 flex-1 flex-col items-center">
              <div className="flex w-full items-center px-6 py-1">
                <h1 className="text-xl text-black">{mode === "writing" ? "Writing Page" : "Drawing Page"}</h1>
              </div>

              {/*The book. SetItem loads/saves the stories and renders the book (bookPage) */}
              <SetItem storyId={STORY_ID} studentId={STUDENTS[0]} students={STUDENTS} mode={mode} />

              {/* <ListItems storyId={STORY_ID} /> */}
            </div>
          </SidebarInset>
        </SidebarProvider>

      </div>
    </main>
  );
}