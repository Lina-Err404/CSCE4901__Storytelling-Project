"use client"

type TopBarProps = {
  mode?: "writing" | "drawing"
  onToggleMode?: () => void
  prompt?: string
}

// Mode comes from the parent so the book and this button share one state.
function TopBar({
  mode = "writing",
  onToggleMode,
  prompt = "Write a story about a super hero",
}: TopBarProps) {
  return (
    <header className="grid min-h-16 w-full grid-cols-[auto_minmax(0,1fr)] items-center gap-x-3 gap-y-3 border-b border-white/10 bg-[#0F1E4B] px-3 py-3 md:grid-cols-[auto_minmax(0,1fr)_auto] md:gap-x-5 md:px-5">
      <div className="flex shrink-0 items-center gap-3">
        <div aria-hidden="true" className="size-10 shrink-0 rounded-full bg-[#F1EADF]" />
        <div aria-label="Time remaining" className="flex h-10 min-w-20 items-center justify-center rounded-xl border border-[#E2D8C8] bg-[#F1EADF] px-3 text-sm font-medium tabular-nums text-[#0F1E4B]">
          25:07
        </div>
      </div>

      <div className="col-span-2 col-start-1 row-start-2 flex min-w-0 justify-center md:col-span-1 md:col-start-2 md:row-start-1">
        <p className="w-fit min-w-0 max-w-full rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm leading-6 text-[#0F1E4B] [overflow-wrap:anywhere]">
          <span className="font-semibold">Prompt: </span>{prompt}
        </p>
      </div>

      <div className="col-start-2 row-start-1 flex min-w-0 flex-wrap items-center justify-end gap-2 md:col-start-3 md:flex-nowrap md:gap-3">
        {/* Shows the mode you would switch to. */}
        <button
          type="button"
          onClick={onToggleMode}
          className="min-h-10 rounded-xl border border-[#E2D8C8] bg-[#F1EADF] px-4 py-2 text-sm font-medium whitespace-nowrap text-[#0F1E4B] transition-colors hover:bg-[#E6DCCB] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#F1EADF] active:bg-[#DDD0BA] motion-reduce:transition-none"
        >
          {mode === "writing" ? "Drawing Mode" : "Writing Mode"}
        </button>
        <button
          type="button"
          className="min-h-10 rounded-xl border border-white/20 bg-[#D85728] px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-[#C14B22] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#F1EADF] active:bg-[#AC401C] motion-reduce:transition-none"
        >
          Submit
        </button>
      </div>
    </header>
  )
}

export default TopBar
