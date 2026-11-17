export type DrawingTool = "pencil" | "paintbrush"
export type DrawingPoint = { x: number; y: number }
export type DrawingStroke = {
  tool: DrawingTool
  points: DrawingPoint[]
  color: string
  /** CSS pixels; positions scale with the canvas, while tool widths stay readable. */
  width: number
  opacity: number
}

export const drawingTools = {
  pencil: { color: "#30343b", width: 2.5, opacity: 1 },
  paintbrush: { color: "#30343b", width: 8, opacity: 1 },
} satisfies Record<DrawingTool, Omit<DrawingStroke, "tool" | "points">>

// Each existing student has one drawing page. Use identity, never the navigation index.
export const drawingPageKey = (studentId: string) => JSON.stringify([studentId, "drawing"])

export function normalizeDrawingPoint(clientX: number, clientY: number, rect: Pick<DOMRect, "left" | "top" | "width" | "height">): DrawingPoint | null {
  if (rect.width <= 0 || rect.height <= 0) return null
  const clamp = (value: number) => Math.min(1, Math.max(0, value))
  return { x: clamp((clientX - rect.left) / rect.width), y: clamp((clientY - rect.top) / rect.height) }
}

/** A single renderer for stored data, resize restoration, and the live stroke preview. */
export function renderDrawing(ctx: CanvasRenderingContext2D, strokes: readonly DrawingStroke[], width: number, height: number) {
  ctx.clearRect(0, 0, width, height)
  for (const stroke of strokes) {
    if (!stroke.points.length) continue
    const points = stroke.points.map((point) => ({ x: point.x * width, y: point.y * height }))
    ctx.save()
    ctx.lineCap = "round"
    ctx.lineJoin = "round"
    ctx.lineWidth = stroke.width
    ctx.strokeStyle = stroke.color
    ctx.fillStyle = stroke.color
    ctx.globalAlpha = stroke.opacity
    ctx.beginPath()
    if (points.length === 1) {
      ctx.arc(points[0].x, points[0].y, stroke.width / 2, 0, Math.PI * 2)
      ctx.fill()
    } else {
      ctx.moveTo(points[0].x, points[0].y)
      for (let i = 1; i < points.length - 1; i++) {
        ctx.quadraticCurveTo(points[i].x, points[i].y, (points[i].x + points[i + 1].x) / 2, (points[i].y + points[i + 1].y) / 2)
      }
      ctx.lineTo(points[points.length - 1].x, points[points.length - 1].y)
      ctx.stroke()
    }
    ctx.restore()
  }
}
