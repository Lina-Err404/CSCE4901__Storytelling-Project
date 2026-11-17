"use client"

import { useEffect, useLayoutEffect, useRef, useState, type RefObject } from "react"
import { drawingTools, normalizeDrawingPoint, renderDrawing, type DrawingStroke, type DrawingTool } from "./drawingModel"
import { shapeGeometry, type ShapeType } from "./drawingShapes"
import { loadedStamp, loadStamp, stampGeometry, type StampAsset } from "./drawingStamps"

import DrawingBackground from "./DrawingBackground"

type Props = {
  background?: StampAsset | null
  studentId: string; owned: boolean; tool: DrawingTool
  color?: string; width?: number; opacity?: number
  selectedShape?: ShapeType | null
  selectedStamp?: StampAsset | null
  strokes: readonly DrawingStroke[]; onCommit: (stroke: DrawingStroke) => void
  cancelStrokeRef?: RefObject<(() => void) | null>
}

export default function DrawingSurface({ studentId, owned, tool, strokes, onCommit, cancelStrokeRef, selectedShape = null, selectedStamp = null, background = null,
  color = drawingTools[tool].color, width: brushWidth = drawingTools[tool].width, opacity = drawingTools[tool].opacity }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const settings = useRef({ strokes, tool, color, width: brushWidth, opacity, selectedShape, selectedStamp })
  const repaint = useRef<(() => void) | null>(null)
  const [imageStatus, setImageStatus] = useState("")
  useEffect(() => {
    let cancelled = false
    const sources = new Set(strokes.flatMap(stroke => stroke.stamp ? [stroke.stamp.src] : []))
    if (selectedStamp) sources.add(selectedStamp.src)
    Promise.resolve().then(() => { if (!cancelled && sources.size) setImageStatus("Loading stamps...") })
    Promise.allSettled([...sources].map(loadStamp)).then(results => {
      if (!cancelled) { setImageStatus(results.some(result => result.status === "rejected") ? "A stamp could not load. Select it again to retry." : ""); repaint.current?.() }
    })
    return () => { cancelled = true }
  }, [strokes, selectedStamp])
  useLayoutEffect(() => {
    settings.current = { strokes, tool, color, width: brushWidth, opacity, selectedShape, selectedStamp }
    repaint.current?.()
  }, [strokes, tool, color, brushWidth, opacity, selectedShape, selectedStamp])

  useLayoutEffect(() => {
    const canvas = canvasRef.current
    const ctx = canvas?.getContext("2d")
    if (!canvas || !ctx) return
    let active: { pointerId: number; stroke: DrawingStroke; shapeType: ShapeType | null; stampAsset: StampAsset | null } | null = null
    let hover: { x: number; y: number } | null = null
    let frame: number | null = null
    let width = 0, height = 0

    function liveStroke(): DrawingStroke | undefined {
      if (!active) return
      if (active.stampAsset) {
        const image = loadedStamp(active.stampAsset.src)
        if (!image) return
        const points = active.stroke.points
        return { ...active.stroke, stamp: stampGeometry(active.stampAsset, image.naturalWidth / image.naturalHeight, points[0], points[points.length - 1], width, height) }
      }
      if (!active.shapeType) return active.stroke
      const points = active.stroke.points
      const shape = shapeGeometry(active.shapeType, points[0], points[points.length - 1], width, height)
      return shape ? { ...active.stroke, shape } : undefined
    }
    function paint(extra?: DrawingStroke) {
      if (!ctx) return
      let live = extra ?? liveStroke()
      const asset = settings.current.selectedStamp
      const image = asset && loadedStamp(asset.src)
      if (!active && !extra && hover && asset && image && owned) {
        live = { tool: "pencil", color: "#000000", width: 1, opacity: settings.current.opacity * .45, points: [hover], stamp: stampGeometry(asset, image.naturalWidth / image.naturalHeight, hover, hover, width, height, true) }
      } else if (active?.stampAsset && live && !extra) live = { ...live, opacity: live.opacity * .6 }
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
        if (point && (point.x !== last?.x || point.y !== last?.y)) {
          if (active.shapeType || active.stampAsset) active.stroke.points.splice(1, active.stroke.points.length, point)
          else active.stroke.points.push(point)
        }
      }
    }
    // Freehand partial strokes are retained; shape and stamp previews are discarded on interruption.
    function finish(showPreview = true) {
      if (!active || !canvas) return
      const completed = active
      const stroke = liveStroke()
      active = null // Release may dispatch lostpointercapture: commit exactly once.
      hover = null
      cancelPaint()
      if (showPreview) paint(stroke)
      if (stroke) onCommit(stroke)
      if (canvas.hasPointerCapture(completed.pointerId)) canvas.releasePointerCapture(completed.pointerId)
    }
    function down(event: PointerEvent) {
      if (!owned || active || !event.isPrimary || event.button !== 0 || !canvas) return
      if (settings.current.selectedStamp && !loadedStamp(settings.current.selectedStamp.src)) return
      const point = normalizeDrawingPoint(event.clientX, event.clientY, canvas.getBoundingClientRect())
      if (!point) return
      event.preventDefault()
      try { canvas.setPointerCapture(event.pointerId) } catch { return }
      const selected = settings.current.tool
      // Snapshot settings once: changing controls cannot alter an in-progress stroke.
      const { color, width, opacity } = settings.current
      hover = null
      active = { pointerId: event.pointerId, shapeType: settings.current.selectedShape, stampAsset: settings.current.selectedStamp, stroke: { tool: selected, color, width, opacity: selected === "eraser" ? 1 : opacity, points: [point] } }
      schedulePaint()
    }
    function move(event: PointerEvent) {
      if (!active && owned && settings.current.selectedStamp && canvas) {
        hover = normalizeDrawingPoint(event.clientX, event.clientY, canvas.getBoundingClientRect())
        schedulePaint(); return
      }
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
      if (event.pointerId === active?.pointerId) {
        if (active?.shapeType || active?.stampAsset) discard()
        else finish()
      }
    }

    function discard() {
      const pointerId = active?.pointerId
      active = null
      hover = null
      cancelPaint()
      paint()
      if (pointerId !== undefined && canvas?.hasPointerCapture(pointerId)) canvas.releasePointerCapture(pointerId)
    }

    repaint.current = paint
    function leave() { hover = null; if (!active) paint() }
    if (cancelStrokeRef) cancelStrokeRef.current = discard
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
    canvas.addEventListener("pointerleave", leave)
    return () => {
      canvas.removeEventListener("pointerdown", down)
      canvas.removeEventListener("pointermove", move)
      canvas.removeEventListener("pointerup", up)
      canvas.removeEventListener("pointercancel", cancel)
      canvas.removeEventListener("lostpointercapture", cancel)
      canvas.removeEventListener("pointerleave", leave)
      observer.disconnect()
      window.removeEventListener("resize", resize)
      resolution?.removeEventListener?.("change", ratioChanged)
      if (active?.shapeType || active?.stampAsset) discard()
      else finish(false)
      cancelPaint()
      repaint.current = null
      if (cancelStrokeRef) cancelStrokeRef.current = null
    }
  }, [studentId, owned, onCommit, cancelStrokeRef])

  return <div className="drawing-surface" data-readonly={!owned}>
    <DrawingBackground asset={background} />
    {selectedStamp && owned && <span className="drawing-placement-status" role="status">{imageStatus || `Stamp: ${selectedStamp.name}. Move onto the canvas; click or drag to place.`}</span>}
    <canvas ref={canvasRef} role="img" data-student={studentId} data-readonly={!owned}
      aria-label={`${owned ? "Your" : `${studentId}’s`} drawing page`}
      title={owned ? "Draw with your mouse, touch, or pen. Drawings are kept in memory only." : "You can view this drawing; only its student can edit it."}>
      Your browser needs Canvas support to display drawings.
    </canvas>
  </div>
}
