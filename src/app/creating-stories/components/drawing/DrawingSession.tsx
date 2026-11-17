"use client"

import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from "react"
import { drawingPageKey, drawingTools, type DrawingStroke, type DrawingTool } from "./drawingModel"

type DrawingSession = {
  drawings: Record<string, readonly DrawingStroke[]>
  tool: DrawingTool
  setTool: (tool: DrawingTool) => void
  color: string
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
  const [drawings, setDrawings] = useState<DrawingSession["drawings"]>({})
  const [tool, setTool] = useState<DrawingTool>("pencil")
  const [color, setColor] = useState(drawingTools.pencil.color)
  const [rainbowPosition, setRainbowPosition] = useState(0)
  const [sizes, setSizes] = useState({ pencil: drawingTools.pencil.width, paintbrush: drawingTools.paintbrush.width })
  const changeSize = useCallback((delta: number) => {
    setSizes((current) => ({ ...current, [tool]: Math.min(40, Math.max(1, current[tool] + delta)) }))
  }, [tool])
  const appendStroke = useCallback((studentId: string, stroke: DrawingStroke) => {
    const key = drawingPageKey(studentId)
    setDrawings((current) => ({ ...current, [key]: [...(current[key] ?? emptyDrawing), stroke] }))
  }, [])
  const value = useMemo(() => ({ drawings, tool, setTool, color, setColor, sizes, changeSize, rainbowPosition, setRainbowPosition, appendStroke }), [drawings, tool, color, sizes, changeSize, rainbowPosition, appendStroke])
  return <DrawingContext.Provider value={value}>{children}</DrawingContext.Provider>
}

export function useDrawingSession() {
  const session = useContext(DrawingContext)
  if (!session) throw new Error("DrawingWorkspace requires DrawingSessionProvider")
  return session
}
