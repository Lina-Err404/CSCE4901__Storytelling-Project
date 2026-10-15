"use client"

import Image from "next/image"
import AddItem from "../components/AddItem"
import ListItems from "../components/ListItems"

export default function Home() {
  return (
    <div className="bg-white h-screen w-screen text-black flex flex-col justify-center items-center">
      <h1> Create Stories Page</h1>
      <AddItem />
      <ListItems />
    </div>
  );
}
