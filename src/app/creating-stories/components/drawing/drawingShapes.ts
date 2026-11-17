import type { DrawingPoint } from "./drawingModel"

export const shapeTypes = ["Circle", "Square", "Rectangle", "Triangle", "Star", "Heart", "Arrow", "Line"] as const
export type ShapeType = typeof shapeTypes[number]
export type ShapeGeometry = { type: ShapeType; x: number; y: number; width: number; height: number }

export function shapeGeometry(type: ShapeType, start: DrawingPoint, end: DrawingPoint, width: number, height: number): ShapeGeometry | null {
  let dx = end.x - start.x, dy = end.y - start.y
  if (type === "Square") {
    const side = Math.min(Math.abs(dx * width), Math.abs(dy * height))
    dx = Math.sign(dx) * side / width; dy = Math.sign(dy) * side / height
  }
  if (type === "Line" ? Math.hypot(dx * width, dy * height) < 2 : Math.abs(dx * width) < 2 || Math.abs(dy * height) < 2) return null
  return { type, x: Math.min(start.x, start.x + dx), y: Math.min(start.y, start.y + dy), width: Math.abs(dx), height: Math.abs(dy) }
}

// Shared vector paths power both the gallery and the Canvas renderer through Path2D.
export function shapePath(type: ShapeType): string {
  switch (type) {
    case "Circle": return "M100 50 A50 50 0 1 1 0 50 A50 50 0 1 1 100 50 Z"
    case "Square": case "Rectangle": return "M0 0H100V100H0Z"
    case "Triangle": return "M50 0 100 100 0 100Z"
    case "Heart": return "M50 100 C35 85 0 62 0 30 C0 -5 40 -10 50 20 C60 -10 100 -5 100 30 C100 62 65 85 50 100Z"
    case "Arrow": return "M0 30H60V0L100 50 60 100V70H0Z"
    case "Line": return "M0 100L100 0"
    case "Star": {
      return Array.from({ length: 10 }, (_, i) => {
        const angle = -Math.PI / 2 + i * Math.PI / 5, radius = i % 2 ? 20 : 50
        return `${i ? "L" : "M"}${50 + Math.cos(angle) * radius} ${50 + Math.sin(angle) * radius}`
      }).join(" ") + "Z"
    }
  }
}

export function renderShape(ctx: CanvasRenderingContext2D, shape: ShapeGeometry, points: readonly DrawingPoint[], width: number, height: number) {
  // Transform the path itself, preserving uniform CSS-pixel stroke width.
  const matrix = new DOMMatrix()
  if (shape.type === "Line") {
    ctx.moveTo(points[0].x * width, points[0].y * height)
    ctx.lineTo(points[points.length - 1].x * width, points[points.length - 1].y * height)
    ctx.stroke()
    return
  }
  let w = shape.width * width, h = shape.height * height
  if (shape.type === "Square") w = h = Math.min(w, h)
  matrix.translateSelf(shape.x * width, shape.y * height).scaleSelf(w / 100, h / 100)
  const path = new Path2D()
  path.addPath(new Path2D(shapePath(shape.type)), matrix)
  ctx.stroke(path)
}
