"use client"

import { useLayoutEffect, useRef } from "react"
import { drawingTools, normalizeDrawingPoint, renderDrawing, type DrawingStroke, type DrawingTool } from "./drawingModel"

type Props = {
  studentId: string; owned: boolean; tool: DrawingTool
  color?: string; width?: number; opacity?: number
  strokes: readonly DrawingStroke[]; onCommit: (stroke: DrawingStroke) => void
}

export default function DrawingSurface({ studentId, owned, tool, strokes, onCommit,
  color = drawingTools[tool].color, width: brushWidth = drawingTools[tool].width, opacity = drawingTools[tool].opacity }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const settings = useRef({ strokes, tool, color, width: brushWidth, opacity })
  const repaint = useRef<(() => void) | null>(null)
  useLayoutEffect(() => {
    settings.current = { strokes, tool, color, width: brushWidth, opacity }
    repaint.current?.()
  }, [strokes, tool, color, brushWidth, opacity])

  useLayoutEffect(() => {
    const canvas = canvasRef.current
    const ctx = canvas?.getContext("2d")
    if (!canvas || !ctx) return
    let active: { pointerId: number; stroke: DrawingStroke } | null = null
    let frame: number | null = null
    let width = 0, height = 0

    function paint(extra?: DrawingStroke) {
      if (!ctx) return
      const live = extra ?? active?.stroke
      renderDrawing(ctx, live ? [...settings.current.strokes, live] : settings.current.strokes, width, height)
    }
    function schedulePaint() {
      if (frame === null) frame = requestAnimationFrame(() => { frame = null; paint() })
    }
    function cancelPaint() {
      if (frame !== null) cancelAnimationFrame(frame)
      frame = null
    }
    function resize() {
      if (!canvas || !ctx) return
      const rect = canvas.getBoundingClientRect()
      width = rect.width; height = rect.height
      if (width <= 0 || height <= 0) return
      const dpr = window.devicePixelRatio || 1
      const pixelWidth = Math.max(1, Math.round(width * dpr)), pixelHeight = Math.max(1, Math.round(height * dpr))
      if (canvas.width !== pixelWidth) canvas.width = pixelWidth
      if (canvas.height !== pixelHeight) canvas.height = pixelHeight
      ctx.setTransform(pixelWidth / width, 0, 0, pixelHeight / height, 0, 0)
      paint()
    }
    function appendPoints(event: PointerEvent) {
      if (!canvas || !active) return
      const samples = event.getCoalescedEvents?.() ?? []
      const rect = canvas.getBoundingClientRect()
      for (const sample of samples.length ? samples : [event]) {
        const point = normalizeDrawingPoint(sample.clientX, sample.clientY, rect)
        const last = active.stroke.points.at(-1)
        if (point && (point.x !== last?.x || point.y !== last?.y)) active.stroke.points.push(point)
      }
    }
    // Preserve valid partial strokes on cancellation, lost capture, navigation, or mode unmount.
    function finish(showPreview = true) {
      if (!active || !canvas) return
      const completed = active
      active = null // Release may dispatch lostpointercapture: commit exactly once.
      cancelPaint()
      if (showPreview) paint(completed.stroke)
      onCommit(completed.stroke)
      if (canvas.hasPointerCapture(completed.pointerId)) canvas.releasePointerCapture(completed.pointerId)
    }
    function down(event: PointerEvent) {
      if (!owned || active || !event.isPrimary || event.button !== 0 || !canvas) return
      const point = normalizeDrawingPoint(event.clientX, event.clientY, canvas.getBoundingClientRect())
      if (!point) return
      event.preventDefault()
      try { canvas.setPointerCapture(event.pointerId) } catch { return }
      const selected = settings.current.tool
      // Snapshot settings once: changing controls cannot alter an in-progress stroke.
      const { color, width, opacity } = settings.current
      active = { pointerId: event.pointerId, stroke: { tool: selected, color, width, opacity, points: [point] } }
      schedulePaint()
    }
    function move(event: PointerEvent) {
      if (event.pointerId !== active?.pointerId) return
      event.preventDefault()
      appendPoints(event)
      schedulePaint()
    }
    function up(event: PointerEvent) {
      if (event.pointerId !== active?.pointerId) return
      appendPoints(event)
      finish()
    }
    function cancel(event: PointerEvent) {
      if (event.pointerId === active?.pointerId) finish()
    }

    repaint.current = paint
    resize()
    const observer = new ResizeObserver(resize)
    observer.observe(canvas)
    window.addEventListener("resize", resize)
    // DPR can change without a CSS-size change when moving between displays or zooming.
    let resolution: MediaQueryList
    function watchResolution() {
      resolution?.removeEventListener?.("change", ratioChanged)
      resolution = window.matchMedia(`(resolution: ${window.devicePixelRatio || 1}dppx)`)
      resolution.addEventListener?.("change", ratioChanged)
    }
    function ratioChanged() { resize(); watchResolution() }
    watchResolution()
    canvas.addEventListener("pointerdown", down)
    canvas.addEventListener("pointermove", move)
    canvas.addEventListener("pointerup", up)
    canvas.addEventListener("pointercancel", cancel)
    canvas.addEventListener("lostpointercapture", cancel)
    return () => {
      canvas.removeEventListener("pointerdown", down)
      canvas.removeEventListener("pointermove", move)
      canvas.removeEventListener("pointerup", up)
      canvas.removeEventListener("pointercancel", cancel)
      canvas.removeEventListener("lostpointercapture", cancel)
      observer.disconnect()
      window.removeEventListener("resize", resize)
      resolution?.removeEventListener?.("change", ratioChanged)
      finish(false)
      cancelPaint()
      repaint.current = null
    }
  }, [studentId, owned, onCommit])

  return <div className="drawing-surface" data-readonly={!owned}>
    <canvas ref={canvasRef} role="img" data-student={studentId} data-readonly={!owned}
      aria-label={`${owned ? "Your" : `${studentId}’s`} drawing page`}
      title={owned ? "Draw with your mouse, touch, or pen. Drawings are kept in memory only." : "You can view this drawing; only its student can edit it."}>
      Your browser needs Canvas support to display drawings.
    </canvas>
  </div>
}
