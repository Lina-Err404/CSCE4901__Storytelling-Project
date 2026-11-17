"use client"

import { useCallback, useRef } from "react"
import DrawingAssetPanel from "./DrawingAssetPanel"
import DrawingControlsPanel from "./DrawingControlsPanel"
import DrawingSurface from "./DrawingSurface"
import { emptyDrawing, useDrawingSession } from "./DrawingSession"
import { drawingPageKey, type DrawingStroke } from "./drawingModel"
import "./drawing-workspace.css"

export default function DrawingWorkspace({ studentId, owned, permanent = false }: { studentId: string; owned: boolean; permanent?: boolean }) {
  const { backgrounds, selectBackground, selectedStamp, selectStamp, selectedShape, selectShape, drawings, histories, changeHistory, tool, setTool, color, setColor, opacity, setOpacity, sizes, changeSize, rainbowPosition, setRainbowPosition, appendStroke } = useDrawingSession()
  const commit = useCallback((stroke: DrawingStroke) => appendStroke(studentId, stroke), [studentId, appendStroke])
  const cancelStrokeRef = useRef<(() => void) | null>(null)
  const history = histories[drawingPageKey(studentId)]
  const historyCommand = (command: "undo" | "redo" | "clear") => {
    if (!owned) return
    cancelStrokeRef.current?.()
    changeHistory(studentId, command)
  }
  return <div className="story-drawing-layout">
    <DrawingAssetPanel selectedBackground={backgrounds[drawingPageKey(studentId)] ?? null} onSelectBackground={(asset) => { if (owned) selectBackground(studentId, asset) }} selectedStamp={selectedStamp} onSelectStamp={selectStamp} selectedShape={selectedShape} onSelectShape={selectShape} owned={owned} />
    <DrawingSurface background={backgrounds[drawingPageKey(studentId)] ?? null} selectedStamp={selectedStamp} selectedShape={selectedShape} cancelStrokeRef={cancelStrokeRef} studentId={studentId} owned={owned} tool={tool} color={color} width={sizes[tool]} opacity={opacity} strokes={drawings[drawingPageKey(studentId)] ?? emptyDrawing} onCommit={commit} />
    <DrawingControlsPanel shapeActive={Boolean(selectedShape || selectedStamp)} key={studentId} canUndo={Boolean(history?.cursor)} canRedo={Boolean(history && history.cursor < history.actions.length)} canClear={Boolean(drawings[drawingPageKey(studentId)]?.length)} onHistory={historyCommand} tool={tool} onSelectTool={setTool} owned={owned} color={color} onSelectColor={setColor} sizes={sizes} onChangeSize={changeSize} rainbowPosition={rainbowPosition} onRainbowPosition={setRainbowPosition} opacity={opacity} onOpacity={setOpacity} />
    {!permanent && <p className="drawing-sr-only">Drawings are kept in memory while this screen is open. Save and the save status refer to story text only; drawings are not saved and will be lost on refresh or leaving this screen.</p>}
  </div>
}
