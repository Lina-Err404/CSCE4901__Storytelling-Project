"use client"

import { useState } from "react"
import Image from "next/image"
import SetItem from "../components/SetItem"
import ListItems from "../components/ListItems"
import TopBar from "../components/topBar"
import { AppSidebar } from "@/components/app-sidebar"
import { Separator } from "@/components/ui/separator"
import {
  SidebarInset,
  SidebarProvider,
  SidebarTrigger,
} from "@/components/ui/sidebar"

// 2 pages in the book per student (drawing page on the left, writing page on the right), in this order. TODO: change this in later sprint to use the assigned places / sections
const STUDENTS = ["student-1", "student-2", "student-3"]

export default function Home() {
  // TESTING ONLY: pick which student you are. Replace with the logged-in student's id later.
  const [studentId, setStudentId] = useState("student-1")
  // Writing mode shows the right (writing) page, drawing mode shows the left (drawing) page.
  // Shared by the top bar button and the book.
  const [mode, setMode] = useState<"writing" | "drawing">("writing")

  return (
    <main className="bg-white max-h-screen max-w-screen overflow-hidden">
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
          <SidebarInset className="min-h-0 overflow-hidden">
            <div className="flex min-h-0 flex-1 flex-col items-center">
              {/*Title of the page you are on, plus the (testing only) student picker */}
              <div className="flex w-full items-center justify-between px-6 py-1">
                <h1 className="text-xl">{mode === "writing" ? "Writing Page" : "Drawing Page"}</h1>

                {/* TESTING ONLY: pick which student you are */}
                <select value={studentId} onChange={(e) => setStudentId(e.target.value)}>
                  {STUDENTS.map((id) => (
                    <option key={id} value={id}>{id}</option>
                  ))}
                </select>
              </div>

              {/*The book. SetItem loads/saves the stories and renders the book (bookPage) */}
              <SetItem key={studentId} studentId={studentId} students={STUDENTS} mode={mode} />

              {/* <ListItems /> */}
            </div>
          </SidebarInset>
        </SidebarProvider>
        <footer className="sticky bottom-0 z-20 h-(--footer-height) border-t bg-background" />
      </div>
    </main>
  );
}