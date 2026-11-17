"use client"

import { useCallback } from "react"
import DrawingAssetPanel from "./DrawingAssetPanel"
import DrawingControlsPanel from "./DrawingControlsPanel"
import DrawingSurface from "./DrawingSurface"
import { emptyDrawing, useDrawingSession } from "./DrawingSession"
import { drawingPageKey, type DrawingStroke } from "./drawingModel"
import "./drawing-workspace.css"

export default function DrawingWorkspace({ studentId, owned }: { studentId: string; owned: boolean }) {
  const { drawings, tool, setTool, color, setColor, sizes, changeSize, rainbowPosition, setRainbowPosition, appendStroke } = useDrawingSession()
  const commit = useCallback((stroke: DrawingStroke) => appendStroke(studentId, stroke), [studentId, appendStroke])
  return <div className="story-drawing-layout">
    <DrawingAssetPanel />
    <DrawingSurface studentId={studentId} owned={owned} tool={tool} color={color} width={sizes[tool]} strokes={drawings[drawingPageKey(studentId)] ?? emptyDrawing} onCommit={commit} />
    <DrawingControlsPanel tool={tool} onSelectTool={setTool} owned={owned} color={color} onSelectColor={setColor} sizes={sizes} onChangeSize={changeSize} rainbowPosition={rainbowPosition} onRainbowPosition={setRainbowPosition} />
    <p className="drawing-sr-only">Drawings are kept in memory while this screen is open. Save and the save status refer to story text only; drawings are not saved and will be lost on refresh or leaving this screen.</p>
  </div>
}
