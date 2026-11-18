"use client"

//Top Bar with Prompt Box, Writing/Drawing Mode Button, Submit, (also a timer but i forgot -Belen)

// mode + onToggleMode come from the parent so the book and this button share one state
function TopBar({ mode = "writing", onToggleMode }: { mode?: "writing" | "drawing"; onToggleMode?: () => void }) {
  const prompt = "Prompt: Write a story about a super hero"

  return (
    <header className="flex h-auto w-full shrink-0 items-center gap-5 border-b bg-[#0F1E4B] p-2 px-5">

      {/*Placeholder timer wheel and container*/}
      <div className="flex shrink-0 items-center gap-3">
        <div className="size-10 shrink-0 rounded-full bg-[#F1EADF]"></div>
        <div className="flex h-10 w-20 items-center justify-center rounded-xl border border-gray-200 bg-[#F1EADF]">
          <span className="text-black">25:07</span>
        </div>
      </div>

      {/*Prompt Box where the teachers prompts are displayed.
*/}
      <div className="mx-auto flex h-10 min-w-0 max-w-200 flex-1 items-center rounded-xl border border-gray-200 bg-white px-4 shadow-md">
        <p className="w-full truncate text-center text-black" title={prompt}>{prompt}</p>
      </div>

      <div className="flex shrink-0 items-center gap-6">
        {/*Writing/Drawing Mode Button: shows the mode you would switch to*/}
        <button
          className="h-10 w-40 whitespace-nowrap rounded-xl border border-gray-200 bg-[#F1EADF] text-black"
          onClick={onToggleMode}
        >
          {mode === "writing" ? "Drawing Mode" : "Writing Mode"}
        </button>
        {/*Submit Button*/}
        <button className="h-10 w-20 rounded-xl border border-gray-200 bg-[#D85728] text-white">Submit</button>
      </div>
    </header>

  );
}

export default TopBar;