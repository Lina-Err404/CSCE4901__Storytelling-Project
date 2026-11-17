import { drawingAssets } from "./drawingAssets"
import { shapeTypes } from "./drawingShapes"
import type { DrawingHistory } from "./drawingHistory"

export type DrawingIdentity = { studentId: string; pageId: string; storyId: string | null }
export type DrawingDocument = DrawingIdentity & { schemaVersion: 1; history: DrawingHistory }
export const MAX_DRAWING_BYTES = 512_000

type ObjectValue = Record<string, unknown>
const object = (value: unknown): value is ObjectValue => Boolean(value && typeof value === "object" && !Array.isArray(value))
const keys = (value: ObjectValue, allowed: string[]) => Object.keys(value).every(key => allowed.includes(key))
const number = (value: unknown, min: number, max: number): value is number => typeof value === "number" && Number.isFinite(value) && value >= min && value <= max
const id = (value: unknown) => typeof value === "string" && /^[A-Za-z0-9_-]{1,128}$/.test(value)
const point = (value: unknown) => object(value) && keys(value, ["x", "y"]) && number(value.x, 0, 1) && number(value.y, 0, 1)
const box = (value: ObjectValue) => number(value.x, 0, 1) && number(value.y, 0, 1) && number(value.width, Number.MIN_VALUE, 1) && number(value.height, Number.MIN_VALUE, 1) && value.x + value.width <= 1.000001 && value.y + value.height <= 1.000001
function asset(value: unknown, catalogue: typeof drawingAssets.stamps) {
  return object(value) && keys(value, ["src", "name"]) && catalogue.some(asset => asset.src === value.src && asset.name === value.name)
}

/** Pure validation boundary. A server must derive expected identity from authorized context. */
export function readDrawingDocument(value: unknown, expected: DrawingIdentity): DrawingDocument {
  const invalid = () => { throw new Error("Invalid or unsupported drawing document") }
  if (!id(expected.studentId) || !id(expected.pageId) || !(expected.storyId === null || id(expected.storyId))) invalid()
  if (!object(value) || !keys(value, ["schemaVersion", "studentId", "pageId", "storyId", "history"]) || value.schemaVersion !== 1 || value.studentId !== expected.studentId || value.pageId !== expected.pageId || value.storyId !== expected.storyId) return invalid()
  const history = value.history
  if (!object(history) || !keys(history, ["actions", "cursor"]) || !Array.isArray(history.actions) || history.actions.length > 10_000 || !Number.isInteger(history.cursor) || !number(history.cursor, 0, history.actions.length)) return invalid()
  let points = 0
  for (const action of history.actions) {
    if (!object(action)) return invalid()
    if (action.type === "clear") { if (!keys(action, ["type"])) invalid(); continue }
    if (action.type === "background") {
      if (!keys(action, ["type", "asset"]) || !(action.asset === null || asset(action.asset, drawingAssets.background))) invalid()
      continue
    }
    if (action.type !== "stroke" || !keys(action, ["type", "stroke"]) || !object(action.stroke)) return invalid()
    const stroke = action.stroke
    if (!keys(stroke, ["tool", "points", "color", "width", "opacity", "shape", "stamp"]) || !["pencil", "paintbrush", "eraser"].includes(String(stroke.tool)) || typeof stroke.color !== "string" || !/^#[a-f0-9]{6}$/i.test(stroke.color) || !number(stroke.width, 1, 40) || !number(stroke.opacity, 0, 1) || !Array.isArray(stroke.points) || !stroke.points.length || !stroke.points.every(point)) return invalid()
    points += stroke.points.length
    if (points > 100_000 || (stroke.shape && stroke.stamp) || (stroke.tool === "eraser" && (stroke.shape || stroke.stamp))) invalid()
    if (stroke.shape !== undefined) {
      const shape = stroke.shape
      if (!object(shape) || !keys(shape, ["type", "x", "y", "width", "height"]) || !shapeTypes.some(type => type === shape.type) || !(shape.type === "Line" ? number(shape.x, 0, 1) && number(shape.y, 0, 1) && number(shape.width, 0, 1) && number(shape.height, 0, 1) && (shape.width > 0 || shape.height > 0) : box(shape))) invalid()
    }
    if (stroke.stamp !== undefined) {
      const stamp = stroke.stamp
      if (!object(stamp) || !keys(stamp, ["assetId", "src", "x", "y", "width", "height", "aspectRatio"]) || !box(stamp) || !number(stamp.aspectRatio, Number.MIN_VALUE, 10_000) || stamp.assetId !== stamp.src || !drawingAssets.stamps.some(asset => asset.src === stamp.src)) invalid()
    }
  }
  const serialized = JSON.stringify(value)
  if (new TextEncoder().encode(serialized).byteLength > MAX_DRAWING_BYTES) throw new Error("Drawing exceeds the 512 KB save limit")
  return JSON.parse(serialized) as DrawingDocument
}

export function createDrawingDocument(identity: DrawingIdentity, history: DrawingHistory): DrawingDocument {
  return readDrawingDocument({ ...identity, schemaVersion: 1, history }, identity)
}
