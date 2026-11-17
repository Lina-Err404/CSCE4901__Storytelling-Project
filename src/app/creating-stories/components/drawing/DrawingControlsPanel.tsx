"use client"

import { useId, useRef, useState } from "react"
import ClearDrawingDialog from "./ClearDrawingDialog"
import { Undo2, Redo2, PaintBucket, Minus, Plus } from "lucide-react"
import { PointedBanner } from "../StoryDecorations"
import { DrawingPanelFrame, DrawingToolArtwork } from "./DrawingDecorations"
import { type DrawingTool } from "./drawingModel"
import { rainbowColor } from "./drawingColors"

const colors = [
  ["White", "#ffffff"], ["Black", "#000000"], ["Gray", "#888887"], ["Brown", "#583d27"],
  ["Red", "#ed2f18"], ["Orange", "#f17b21"], ["Yellow", "#fff23a"], ["Green", "#48a62c"],
  ["Turquoise", "#71e9df"], ["Blue", "#2457e9"], ["Purple", "#7600e8"], ["Magenta", "#e627d1"],
  ["Salmon", "#ec8b8b"], ["Peach", "#e9c270"], ["Pale yellow", "#fff89c"], ["Light green", "#a0e589"],
  ["Pale turquoise", "#bdeae6"], ["Periwinkle", "#7b82ec"], ["Lavender", "#be91df"], ["Pink", "#df80b0"],
]

export default function DrawingControlsPanel({ tool, onSelectTool, owned, color, onSelectColor, sizes, onChangeSize, rainbowPosition, onRainbowPosition, opacity, onOpacity, canUndo, canRedo, canClear, onHistory, shapeActive }: {
  shapeActive?: boolean
  canUndo: boolean; canRedo: boolean; canClear: boolean
  onHistory: (command: "undo" | "redo" | "clear") => void
  tool: DrawingTool; onSelectTool: (tool: DrawingTool) => void; owned: boolean
  opacity: number; onOpacity: (opacity: number) => void
  color: string; onSelectColor: (color: string) => void
  sizes: Record<DrawingTool, number>; onChangeSize: (delta: number) => void
  rainbowPosition: number; onRainbowPosition: (position: number) => void
}) {
  const pendingId = useId()
  const transparencyId = useId()
  const opacityDescriptionId = useId()
  const size = sizes[tool]
  const [confirming, setConfirming] = useState(false)
  const deleteButton = useRef<HTMLButtonElement>(null)
  function closeDialog() { setConfirming(false); deleteButton.current?.focus() }
  return <aside className="drawing-panel drawing-controls" aria-label="Drawing controls">
    <DrawingPanelFrame right />
    <p className="drawing-sr-only" id={pendingId}>Pencil, paintbrush, eraser, transparency, colours and brush sizes are available. Other drawing controls and drawing persistence are coming soon.</p>
    <fieldset disabled={!owned} aria-describedby={pendingId}>
      <legend className="drawing-sr-only">Drawing settings</legend>
      <div className="drawing-history">
        <div><button disabled={!canUndo} type="button" aria-label="Undo" title="Undo last drawing operation" onClick={() => onHistory("undo")}><Undo2 aria-hidden="true" /></button><button disabled={!canRedo} type="button" aria-label="Redo" title="Redo drawing operation" onClick={() => onHistory("redo")}><Redo2 aria-hidden="true" /></button></div>
        <button ref={deleteButton} disabled={!canClear} type="button" className="drawing-delete" title="Clear this drawing page" onClick={() => setConfirming(true)}>Delete All</button>
      </div>
      <div className="drawing-palette" role="group" aria-label="Colour palette">
        <div className="drawing-colors">{colors.map(([name, swatch]) => <button type="button" key={name} aria-label={name} title={name}
          aria-pressed={color === swatch} onClick={() => onSelectColor(swatch)} style={{ backgroundColor: swatch }} />)}</div>
        <input type="range" className="drawing-rainbow" aria-label="Rainbow colour" min={0} max={100} step={1}
          value={rainbowPosition} aria-valuetext={rainbowColor(rainbowPosition)} title={`Rainbow colour: ${rainbowColor(rainbowPosition)}`}
          onPointerDown={() => { if (owned) onSelectColor(rainbowColor(rainbowPosition)) }}
          onChange={(event) => { const position = Number(event.target.value); onRainbowPosition(position); onSelectColor(rainbowColor(position)) }} />
      </div>
      <p className="drawing-sr-only" id={opacityDescriptionId}>Stroke opacity: 100% is fully opaque; 0% is invisible. Eraser always erases fully.</p>
      <div className="drawing-transparency">
        <div><label htmlFor={transparencyId}>Transparency</label><span>{Math.round(opacity * 100)}%</span></div>
        <PointedBanner compact><input id={transparencyId} type="range" min={0} max={100} value={Math.round(opacity * 100)} onChange={(event) => onOpacity(Number(event.target.value) / 100)} aria-describedby={opacityDescriptionId} style={{ background: `linear-gradient(to right, #d0a347 ${opacity * 100}%, #837046 ${opacity * 100}%)` }} /></PointedBanner>
      </div>
      <div className="drawing-brush-settings">
        <button disabled type="button" aria-label="Paint bucket" title="Paint bucket (coming soon)"><PaintBucket aria-hidden="true" /></button>
        <div className="drawing-brush-size"><button disabled={size <= 1} type="button" aria-label="Decrease brush size" onClick={() => onChangeSize(-1)}><Minus aria-hidden="true" /></button><output aria-label="Brush size" aria-live="polite">{size}<span className="drawing-size-unit">px</span></output><button disabled={size >= 40} type="button" aria-label="Increase brush size" onClick={() => onChangeSize(1)}><Plus aria-hidden="true" /></button></div>
      </div>
    </fieldset>
    <div className="drawing-tools" role="group" aria-label="Drawing tool">
      {(["pencil", "paintbrush", "eraser"] as const).map((option) => <button key={option} type="button" aria-label={`Use ${option}`}
        aria-pressed={!shapeActive && tool === option} disabled={!owned} onClick={() => onSelectTool(option)}
        title={owned ? `${option === "pencil" ? "Pencil" : option === "eraser" ? "Eraser" : "Paintbrush"} (${sizes[option]}px)` : "Only the owner can draw on this page"}>
        <DrawingToolArtwork tool={option} />
      </button>)}
    </div>
    {confirming && owned && <ClearDrawingDialog onCancel={closeDialog} onConfirm={() => { onHistory("clear"); closeDialog() }} />}
  </aside>
}
