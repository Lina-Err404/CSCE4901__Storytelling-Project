export function DrawingPanelFrame({ right = false }: { right?: boolean }) {
  return <svg className={`story-frame drawing-panel-frame${right ? " drawing-panel-frame-right" : ""}`} viewBox="0 0 300 748" preserveAspectRatio="none" aria-hidden="true">
    <path d="M2 2H263C263 25 280 42 298 42V706C280 706 263 724 263 746H2Z" />
  </svg>
}

export function DrawingToolArtwork({ tool }: { tool: "pencil" | "paintbrush" | "eraser" }) {
  return <svg viewBox="0 0 60 100" aria-hidden="true">
    {tool === "pencil" ? <>
      <path d="M30 1 12 43H48Z" fill="#f4dfad" /><path d="M30 1 23 18H37Z" fill="#111" />
      <path d="M12 43H48V100H12Z" fill="#e3b53a" /><path d="M30 43H48V100H30Z" fill="#f8d96a" />
    </> : tool === "paintbrush" ? <>
      <path d="M24 53 17 100H39L32 53Z" fill="#b9d6e1" stroke="#668ba2" strokeWidth="1.5" />
      <path d="M23 64H33M21 75H35M19 87H37" fill="none" stroke="#668ba2" strokeWidth="1.5" />
      <path d="M24 58C4 45 23 27 44 7 35 32 49 43 32 58Z" fill="#987849" />
      <path d="M15 43C12 26 27 12 47 1 35 20 43 26 32 40 24 25 25 35 15 43Z" fill="#eb3c34" />
    </> : <path d="M12 10Q12 4 19 4H54Q59 4 59 11L54 100H4Z" fill="#bd90a3" />}
  </svg>
}
