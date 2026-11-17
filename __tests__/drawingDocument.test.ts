import { TextEncoder } from "node:util"
import { createDrawingDocument, readDrawingDocument } from "../src/app/creating-stories/components/drawing/drawingDocument"
import { drawingAssets } from "../src/app/creating-stories/components/drawing/drawingAssets"
import type { DrawingHistory } from "../src/app/creating-stories/components/drawing/drawingHistory"

Object.assign(globalThis, { TextEncoder })
const identity = { studentId: "authenticated-uid", pageId: "drawing", storyId: null }
const stroke = { tool: "pencil" as const, points: [{ x: .1, y: .2 }, { x: .8, y: .8 }], color: "#30343b", width: 2.5, opacity: .5 }
const history: DrawingHistory = { cursor: 6, actions: [
  { type: "stroke", stroke },
  { type: "stroke", stroke: { ...stroke, tool: "paintbrush", width: 8 } },
  { type: "stroke", stroke: { ...stroke, shape: { type: "Star", x: .1, y: .1, width: .5, height: .5 } } },
  { type: "stroke", stroke: { ...stroke, stamp: { assetId: drawingAssets.stamps[0].src, src: drawingAssets.stamps[0].src, x: .1, y: .1, width: .5, height: .5, aspectRatio: 430 / 377 } } },
  { type: "stroke", stroke: { ...stroke, tool: "eraser", opacity: 1 } },
  { type: "background", asset: drawingAssets.background[0] },
  { type: "clear" },
] }

test("versioned documents round trip every element, chronological order and redo cursor without mutating history", () => {
  const saved = createDrawingDocument(identity, history)
  expect(readDrawingDocument(JSON.parse(JSON.stringify(saved)), identity)).toEqual(saved)
  expect(saved.history).toEqual(history)
  expect(saved.history).not.toBe(history)
})
test("empty drawings and white background actions serialize", () => {
  expect(createDrawingDocument(identity, { actions: [], cursor: 0 }).history.actions).toEqual([])
  expect(createDrawingDocument(identity, { actions: [{ type: "background", asset: null }], cursor: 1 }).history.cursor).toBe(1)
})
test.each(["studentId", "storyId", "pageId"])("rejects mismatched %s", field => {
  const saved = createDrawingDocument(identity, history)
  expect(() => readDrawingDocument({ ...saved, [field]: "another-record" }, identity)).toThrow()
})
test.each([
  { ...stroke, points: [{ x: NaN, y: .2 }] }, { ...stroke, width: 0 }, { ...stroke, opacity: 2 },
  { ...stroke, stamp: { assetId: "bad", src: "https://external.invalid/image.png", x: 0, y: 0, width: 1, height: 1, aspectRatio: 1 } },
  { ...stroke, image: "data:image/png;base64,anything" },
])("rejects malformed or external drawing data", bad => {
  expect(() => createDrawingDocument(identity, { actions: [{ type: "stroke", stroke: bad as typeof stroke }], cursor: 1 })).toThrow()
})
test("rejects unsupported versions, invalid cursors and oversized data without truncation", () => {
  const saved = createDrawingDocument(identity, history)
  expect(() => readDrawingDocument({ ...saved, schemaVersion: 2 }, identity)).toThrow()
  expect(() => createDrawingDocument(identity, { ...history, cursor: 100 })).toThrow()
  expect(() => createDrawingDocument(identity, { actions: [{ type: "stroke", stroke: { ...stroke, points: Array.from({ length: 40_000 }, () => ({ x: .123456789, y: .987654321 })) } }], cursor: 1 })).toThrow(/limit/)
})
