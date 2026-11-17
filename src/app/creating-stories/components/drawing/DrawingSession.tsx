"use client"

import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from "react"
import { drawingPageKey, drawingTools, type DrawingStroke, type DrawingTool } from "./drawingModel"
import { emptyHistory, recordAction, replayHistory, type DrawingHistory, type DrawingAction } from "./drawingHistory"

import type { ShapeType } from "./drawingShapes"

type DrawingSession = {
  selectedShape: ShapeType | null
  selectShape: (shape: ShapeType) => void
  drawings: Record<string, readonly DrawingStroke[]>
  histories: Record<string, DrawingHistory>
  changeHistory: (studentId: string, command: "undo" | "redo" | "clear") => void
  tool: DrawingTool
  setTool: (tool: DrawingTool) => void
  color: string
  opacity: number
  setOpacity: (opacity: number) => void
  setColor: (color: string) => void
  sizes: Record<DrawingTool, number>
  changeSize: (delta: number) => void
  rainbowPosition: number
  setRainbowPosition: (position: number) => void
  appendStroke: (studentId: string, stroke: DrawingStroke) => void
}
const DrawingContext = createContext<DrawingSession | null>(null)
export const emptyDrawing: readonly DrawingStroke[] = []

/** Lives above mode rendering AND the keyed student component. No persistence side effects. */
export function DrawingSessionProvider({ children }: { children: ReactNode }) {
  const [histories, setHistories] = useState<DrawingSession["histories"]>({})
  const drawings = useMemo(() => Object.fromEntries(Object.entries(histories).map(([key, history]) => [key, replayHistory(history)])), [histories])
  const changeHistory = useCallback((studentId: string, command: "undo" | "redo" | "clear") => {
    const key = drawingPageKey(studentId)
    setHistories((current) => {
      const history = current[key] ?? emptyHistory
      if (command === "clear") {
        if (!replayHistory(history).length) return current
        return { ...current, [key]: recordAction(history, { type: "clear" }) }
      }
      const cursor = Math.min(history.actions.length, Math.max(0, history.cursor + (command === "undo" ? -1 : 1)))
      return cursor === history.cursor ? current : { ...current, [key]: { ...history, cursor } }
    })
  }, [])
  const [tool, selectTool] = useState<DrawingTool>("pencil")
  const [selectedShape, setSelectedShape] = useState<ShapeType | null>(null)
  const setTool = useCallback((next: DrawingTool) => { selectTool(next); setSelectedShape(null) }, [])
  const selectShape = useCallback((shape: ShapeType) => { setSelectedShape(shape); selectTool(current => current === "eraser" ? "pencil" : current) }, [])
  const [color, setColor] = useState(drawingTools.pencil.color)
  const [opacity, setOpacity] = useState(1)
  const [rainbowPosition, setRainbowPosition] = useState(0)
  const [sizes, setSizes] = useState({ pencil: drawingTools.pencil.width, paintbrush: drawingTools.paintbrush.width, eraser: drawingTools.eraser.width })
  const changeSize = useCallback((delta: number) => {
    setSizes((current) => ({ ...current, [tool]: Math.min(40, Math.max(1, current[tool] + delta)) }))
  }, [tool])
  const appendStroke = useCallback((studentId: string, stroke: DrawingStroke) => {
    const key = drawingPageKey(studentId)
    const action: DrawingAction = { type: "stroke", stroke }
    setHistories((current) => ({ ...current, [key]: recordAction(current[key] ?? emptyHistory, action) }))
  }, [])
  const value = useMemo(() => ({ selectedShape, selectShape, drawings, histories, changeHistory, tool, setTool, color, setColor, opacity, setOpacity, sizes, changeSize, rainbowPosition, setRainbowPosition, appendStroke }), [selectedShape, selectShape, setTool, drawings, histories, changeHistory, tool, color, opacity, sizes, changeSize, rainbowPosition, appendStroke])
  return <DrawingContext.Provider value={value}>{children}</DrawingContext.Provider>
}

export function useDrawingSession() {
  const session = useContext(DrawingContext)
  if (!session) throw new Error("DrawingWorkspace requires DrawingSessionProvider")
  return session
}
