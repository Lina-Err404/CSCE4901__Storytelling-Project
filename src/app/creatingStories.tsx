"use client"

import { useState } from "react"
import Image from "next/image"
import SetItem from "../components/SetItem"
import ListItems from "../components/ListItems"
import BookPage from "../components/bookPage"
import TopBar from "../components/topBar"
import { AppSidebar } from "@/components/app-sidebar"
import { Separator } from "@/components/ui/separator"
import {
  SidebarInset,
  SidebarProvider,
  SidebarTrigger,
} from "@/components/ui/sidebar"
import fs from "node:fs/promises"
import path from "node:path"


export default function Home() {
  // TESTING ONLY: pick which student you are. Replace with the logged-in student's id later.
  const [studentId, setStudentId] = useState("student-1")
  
  return (
    <main className="bg-white max-h-screen max-w-screen">
      <div>
        {/*Component containing top bar and buttoms */}
        <TopBar/>
        <SidebarProvider
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
          <SidebarInset>
            {/*Title of the pages (could make it a component, unsure yet) */}
            <div className="flex flex-1 flex-col p-6 items-center text-xl">
            <div className="flex flex-row gap-145 p-4 items-stretch justify-between">
               <h1>Writing Page</h1>
                <h1>Drawing Page</h1>
             </div>

           {/*Double Stage Componet (Canvas) */}
            <BookPage/>

            {/* This is your part Carsen, it is currently not visible

            <select value={studentId} onChange={(e) => setStudentId(e.target.value)}>
             <option value="student-1">student-1</option>
              <option value="student-2">student-2</option>
              <option value="student-3">student-3</option>
            </select>
            <SetItem key={studentId} studentId={studentId} />
            <ListItems /> */}

          </div>
         </SidebarInset>
        </SidebarProvider>
        <footer className="sticky bottom-0 z-20 h-(--footer-height) border-t bg-background" />
      </div>
    </main>
  );
}