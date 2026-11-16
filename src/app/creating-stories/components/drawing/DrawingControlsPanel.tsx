"use client"

import { useId } from "react"
import { Undo2, Redo2, PaintBucket, Minus, Plus } from "lucide-react"
import { PointedBanner } from "../StoryDecorations"
import { DrawingPanelFrame, DrawingToolArtwork } from "./DrawingDecorations"

const colors = [
  ["White", "#ffffff"], ["Black", "#000000"], ["Gray", "#888887"], ["Brown", "#583d27"],
  ["Red", "#ed2f18"], ["Orange", "#f17b21"], ["Yellow", "#fff23a"], ["Green", "#48a62c"],
  ["Turquoise", "#71e9df"], ["Blue", "#2457e9"], ["Purple", "#7600e8"], ["Magenta", "#e627d1"],
  ["Salmon", "#ec8b8b"], ["Peach", "#e9c270"], ["Pale yellow", "#fff89c"], ["Light green", "#a0e589"],
  ["Pale turquoise", "#bdeae6"], ["Periwinkle", "#7b82ec"], ["Lavender", "#be91df"], ["Pink", "#df80b0"],
]

export default function DrawingControlsPanel() {
  const pendingId = useId()
  const transparencyId = useId()
  return <aside className="drawing-panel drawing-controls" aria-label="Drawing controls">
    <DrawingPanelFrame right />
    <p className="drawing-sr-only" id={pendingId}>Drawing tools and drawing persistence are coming soon. These controls are unavailable.</p>
    <fieldset disabled aria-describedby={pendingId}>
      <legend className="drawing-sr-only">Drawing tools (coming soon)</legend>
      <div className="drawing-history">
        <div><button type="button" aria-label="Undo" title="Undo (coming soon)"><Undo2 aria-hidden="true" /></button><button type="button" aria-label="Redo" title="Redo (coming soon)"><Redo2 aria-hidden="true" /></button></div>
        <button type="button" className="drawing-delete" title="Delete All (coming soon)">Delete All</button>
      </div>
      <div className="drawing-palette" role="group" aria-label="Colour palette (coming soon)">
        <div className="drawing-colors">{colors.map(([name, color]) => <button type="button" key={name} aria-label={name} title={`${name} (coming soon)`} style={{ backgroundColor: color }} />)}</div>
        <button type="button" className="drawing-rainbow" aria-label="Custom colour" title="Custom colour (coming soon)" />
      </div>
      <div className="drawing-transparency">
        <div><label htmlFor={transparencyId}>Transparency</label><span>50%</span></div>
        <PointedBanner compact><input id={transparencyId} type="range" min={0} max={100} defaultValue={50} title="Transparency (coming soon)" /></PointedBanner>
      </div>
      <div className="drawing-brush-settings">
        <button type="button" aria-label="Paint bucket" title="Paint bucket (coming soon)"><PaintBucket aria-hidden="true" /></button>
        <div className="drawing-brush-size"><button type="button" aria-label="Decrease brush size" title="Brush size (coming soon)"><Minus aria-hidden="true" /></button><output aria-label="Brush size"><span aria-hidden="true" /><span className="drawing-sr-only">8 pixels</span></output><button type="button" aria-label="Increase brush size" title="Brush size (coming soon)"><Plus aria-hidden="true" /></button></div>
      </div>
      <div className="drawing-tools">{(["pencil", "paintbrush", "eraser"] as const).map((tool) => <button key={tool} type="button" aria-label={`Use ${tool}`} title={`${tool[0].toUpperCase()}${tool.slice(1)} (coming soon)`}><DrawingToolArtwork tool={tool} /></button>)}</div>
    </fieldset>
  </aside>
}
