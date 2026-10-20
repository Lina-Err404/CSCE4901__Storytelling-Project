"use client"

import { useState } from "react"
import Image from "next/image"
import SetItem from "../components/SetItem"
import ListItems from "../components/ListItems"
import BookPage from "../components/bookPage"
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
    
    <div className="bg-white h-screen w-screen text-black flex flex-col justify-center item-center">
      <header className="sticky top-0 z-20 h-(--header-height) border-b bg-background" />
      
      
        <SidebarProvider
      style={
        {
          "--sidebar-width": "400px",
        } as React.CSSProperties
      }
    >
      <AppSidebar />
      <SidebarInset>
        <header className="sticky top-0 flex shrink-0 items-center gap-2 border-b bg-background p-4">
          <SidebarTrigger className="-ml-1" />
          <Separator
            orientation="vertical"
            className="mr-2 data-vertical:h-4 data-vertical:self-auto"
          />
          
        </header>
         <div className="flex flex-1 flex-col gap-4 p-1 items-center" style={{ margin: 50, }}>
           <BookPage/ >
          <select value={studentId} onChange={(e) => setStudentId(e.target.value)}>
        <option value="student-1">student-1</option>
        <option value="student-2">student-2</option>
        <option value="student-3">student-3</option>
      </select>
      <SetItem key={studentId} studentId={studentId} />
      <ListItems />
        </div>
      </SidebarInset>
    </SidebarProvider>
           <footer className="sticky bottom-0 z-20 h-(--footer-height) border-t bg-background" />
      
      </div>
    
  );
}