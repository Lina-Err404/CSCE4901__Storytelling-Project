"use client"
import { ToolbarFrame } from "./StoryDecorations"

export default function StoryToolbar({ mode, onToggleMode }: { mode: "writing" | "drawing"; onToggleMode: () => void }) {
  return <header className="story-toolbar" aria-label="Story toolbar">
    <ToolbarFrame />
    <div className="story-toolbar-left">
      <span className="story-toolbar-medallion" aria-hidden="true" />
      <span className="story-timer story-gold-control" aria-label="Time remaining">25:07</span>
    </div>
    <button type="button" className="story-mode story-gold-control" onClick={onToggleMode}
      aria-label={`${mode === "writing" ? "Writing" : "Drawing"} Mode; switch to ${mode === "writing" ? "Drawing" : "Writing"} Mode`}>
      {mode === "writing" ? "Writing Mode" : "Drawing Mode"}
    </button>
    {/* Same presentation-only Submit behavior as the existing toolbar. */}
    <button type="button" className="story-submit story-gold-control">Submit</button>
  </header>
}
