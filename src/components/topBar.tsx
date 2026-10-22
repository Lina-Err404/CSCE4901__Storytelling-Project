"use client"

import React, {useCallback, useEffect, useMemo, useRef, useState } from "react"

//Top Bar with Prompt Box, Writing/Drawing Mode Button, Submit, (also a timer but i forgot -Belen)

// mode + onToggleMode come from the parent so the book and this button share one state
function TopBar({ mode = "writing", onToggleMode }: { mode?: "writing" | "drawing"; onToggleMode?: () => void }) {
    return (

        <header className="h-16 w-screen border-b bg-[#134790] items-center justify-center flex">

            {/*Prompt Box where the teachers prompts are displayed*/}
          <div className="w-85 h-10 opacity-0" aria-hidden="true" />
            <div className="p-4 max-w-200 max-h-10 mx-auto bg-white rounded-xl shadow-md border border-gray-200 items-center flex">
                <h1 className="text-black mx-auto">Prompt: Write a story about a super hero</h1>
            </div>

          <div className="items-center justify-end flex flex-row">
            {/*Writing/Drawing Mode Button: shows the mode you would switch to*/}
            <div className="mr-6 p-4 w-40 h-10 mx-auto bg-white rounded-xl border border-gray-200 flex items-center">
              <button className="text-black mx-auto" onClick={onToggleMode}>
                {mode === "writing" ? "Drawing Mode" : "Writing Mode"}
              </button>
            </div>
            {/*Submit Button*/}
            <div className="mr-12 p-4 w-20 h-10 mx-auto bg-white rounded-xl border border-gray-200 flex items-center">
              <button className="text-black mx-auto">Submit</button>
            </div>
          </div>
        </header>

    );
}

export default TopBar;