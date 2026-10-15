"use client"

import { useState } from "react"
import Image from "next/image"
import SetItem from "../components/SetItem"
import ListItems from "../components/ListItems"

export default function Home() {
  // TESTING ONLY: pick which student you are. Replace with the logged-in student's id later.
  const [studentId, setStudentId] = useState("student-1")

  return (
    <div className="bg-white h-screen w-screen text-black flex flex-col justify-center items-center">
      <h1> Create Stories Page</h1>

      <select value={studentId} onChange={(e) => setStudentId(e.target.value)}>
        <option value="student-1">student-1</option>
        <option value="student-2">student-2</option>
        <option value="student-3">student-3</option>
      </select>

      <SetItem key={studentId} studentId={studentId} />
      <ListItems />
    </div>
  );
}