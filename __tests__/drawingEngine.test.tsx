import React, { StrictMode, useCallback, useState } from "react"
import "@testing-library/jest-dom"
import { act, cleanup, fireEvent, render, screen, within } from "@testing-library/react"
import DrawingSurface from "../src/app/creating-stories/components/drawing/DrawingSurface"
import DrawingWorkspace from "../src/app/creating-stories/components/drawing/DrawingWorkspace"
import { DrawingSessionProvider, useDrawingSession } from "../src/app/creating-stories/components/drawing/DrawingSession"
import { drawingPageKey, drawingTools, normalizeDrawingPoint, renderDrawing, type DrawingStroke } from "../src/app/creating-stories/components/drawing/drawingModel"
import { installDrawingCanvas, makeDrawingContext } from "./helpers/drawingCanvas"
import { rainbowColor } from "../src/app/creating-stories/components/drawing/drawingColors"
import { emptyHistory, recordAction, replayHistory } from "../src/app/creating-stories/components/drawing/drawingHistory"
import { shapeGeometry, shapeTypes, shapePath } from "../src/app/creating-stories/components/drawing/drawingShapes"

let backend: ReturnType<typeof installDrawingCanvas>
beforeEach(() => {
  window.matchMedia = jest.fn().mockReturnValue({ matches: false, addEventListener: jest.fn(), removeEventListener: jest.fn() })
  backend = installDrawingCanvas()
})
afterEach(() => { cleanup(); backend.restore() })

const canvas = () => screen.getByRole("img", { name: /drawing page/ }) as HTMLCanvasElement
function draw(target: HTMLCanvasElement, pointerType = "mouse", id = 1) {
  const pointer = { pointerId: id, pointerType, isPrimary: true, button: 0 }
  fireEvent.pointerDown(target, { ...pointer, clientX: 140, clientY: 70 })
  fireEvent.pointerMove(target, { ...pointer, clientX: 300, clientY: 150 })
  fireEvent.pointerUp(target, { ...pointer, clientX: 460, clientY: 230 })
}

test("coordinates account for the actual canvas offset, clamp captured movement, and reject zero size", () => {
  const rect = { left: 100, top: 50, width: 400, height: 200 }
  expect(normalizeDrawingPoint(200, 100, rect)).toEqual({ x: .25, y: .25 })
  expect(normalizeDrawingPoint(900, -10, rect)).toEqual({ x: 1, y: 0 })
  expect(normalizeDrawingPoint(0, 0, { ...rect, width: 0 })).toBeNull()
})

test("renderer scales normalized positions, draws connected round curves and preserves dot taps", () => {
  const ctx = makeDrawingContext()
  const stroke: DrawingStroke = { tool: "paintbrush", ...drawingTools.paintbrush, points: [{ x: .1, y: .1 }, { x: .5, y: .5 }, { x: .9, y: .9 }] }
  renderDrawing(ctx as unknown as CanvasRenderingContext2D, [stroke], 800, 400)
  expect(ctx.moveTo).toHaveBeenCalledWith(80, 40)
  expect(ctx.quadraticCurveTo).toHaveBeenCalledWith(400, 200, 560, 280)
  expect(ctx.lineTo).toHaveBeenCalledWith(720, 360)
  expect(ctx.lineCap).toBe("round"); expect(ctx.lineJoin).toBe("round")
  expect(ctx.lineWidth).toBe(8); expect(ctx.strokeStyle).toBe("#30343b")
  renderDrawing(ctx as unknown as CanvasRenderingContext2D, [{ ...stroke, points: [stroke.points[0]] }], 400, 200)
  expect(ctx.arc).toHaveBeenCalledWith(40, 20, 4, 0, Math.PI * 2)
  expect(ctx.fill).toHaveBeenCalledTimes(1)
})

test.each(["mouse", "touch", "pen"])("%s creates one structured stroke, with no model commits during movement", (pointerType) => {
  const commit = jest.fn()
  render(<StrictMode><DrawingSurface studentId="student-1" owned tool="pencil" strokes={[]} onCommit={commit} /></StrictMode>)
  const target = canvas()
  fireEvent.pointerDown(target, { pointerId: 7, pointerType, button: 0, clientX: 140, clientY: 70 })
  fireEvent.pointerMove(target, { pointerId: 7, pointerType, clientX: 300, clientY: 150 })
  expect(commit).not.toHaveBeenCalled()
  expect(backend.frames.size).toBe(1)
  act(() => backend.flushFrame())
  expect(backend.context(target).stroke).toHaveBeenCalledTimes(1)
  fireEvent.pointerUp(target, { pointerId: 7, pointerType, clientX: 460, clientY: 230 })
  expect(commit).toHaveBeenCalledTimes(1)
  expect(commit).toHaveBeenCalledWith({ tool: "pencil", color: "#30343b", width: 2.5, opacity: 1, points: [{ x: .1, y: .1 }, { x: .5, y: .5 }, { x: .9, y: .9 }] })
  expect(target.setPointerCapture).toHaveBeenCalledWith(7)
  expect(target.releasePointerCapture).toHaveBeenCalledWith(7)
  expect(backend.frames.size).toBe(0)
})

test("coalesced samples stay connected, unrelated pointers and secondary buttons cannot alter a stroke", () => {
  const commit = jest.fn()
  render(<DrawingSurface studentId="student-1" owned tool="pencil" strokes={[]} onCommit={commit} />)
  const target = canvas()
  fireEvent.pointerDown(target, { pointerId: 9, isPrimary: false, button: 0, clientX: 140, clientY: 70 })
  fireEvent.pointerDown(target, { pointerId: 9, button: 2, clientX: 140, clientY: 70 })
  expect(target.setPointerCapture).not.toHaveBeenCalled()
  fireEvent.pointerDown(target, { pointerId: 1, button: 0, clientX: 140, clientY: 70 })
  fireEvent.pointerMove(target, { pointerId: 2, clientX: 1000, clientY: 1000 })
  fireEvent.pointerUp(target, { pointerId: 2 })
  const event = new PointerEvent("pointermove", { pointerId: 1, clientX: 300, clientY: 150 })
  Object.defineProperty(event, "getCoalescedEvents", { value: () => [{ clientX: 200, clientY: 100 }, { clientX: 300, clientY: 150 }] })
  fireEvent(target, event)
  fireEvent.pointerUp(target, { pointerId: 1, clientX: 900, clientY: 300 })
  expect(commit).toHaveBeenCalledTimes(1)
  expect(commit.mock.calls[0][0].points).toEqual([{ x: .1, y: .1 }, { x: .25, y: .25 }, { x: .5, y: .5 }, { x: 1, y: 1 }])
})

test.each(["pointercancel", "lostpointercapture"])("%s finishes the partial stroke once and allows a subsequent stroke", (type) => {
  const commit = jest.fn()
  render(<DrawingSurface studentId="student-1" owned tool="pencil" strokes={[]} onCommit={commit} />)
  fireEvent.pointerDown(canvas(), { pointerId: 1, button: 0, clientX: 140, clientY: 70 })
  fireEvent(canvas(), new PointerEvent(type, { pointerId: 1 }))
  fireEvent.pointerUp(canvas(), { pointerId: 1 })
  draw(canvas(), "mouse", 2)
  expect(commit).toHaveBeenCalledTimes(2)
  expect(commit.mock.calls[0][0].points).toHaveLength(1)
})

test("read-only student drawings cannot capture or commit any pointer input", () => {
  const commit = jest.fn()
  render(<DrawingSurface studentId="student-2" owned={false} tool="paintbrush" strokes={[]} onCommit={commit} />)
  draw(canvas())
  expect(canvas()).toHaveAttribute("data-readonly", "true")
  expect(commit).not.toHaveBeenCalled()
  expect(canvas().setPointerCapture).not.toHaveBeenCalled()
})

test("resize and DPR changes restore stored strokes using new dimensions", () => {
  const stroke: DrawingStroke = { tool: "pencil", ...drawingTools.pencil, points: [{ x: .25, y: .5 }, { x: .75, y: .5 }] }
  render(<DrawingSurface studentId="student-1" owned tool="pencil" strokes={[stroke]} onCommit={jest.fn()} />)
  const target = canvas(), ctx = backend.context(target)
  act(() => backend.resize({ left: 50, top: 20, width: 800, height: 400 }, 2))
  expect(target.width).toBe(1600); expect(target.height).toBe(800)
  expect(ctx.setTransform).toHaveBeenLastCalledWith(2, 0, 0, 2, 0, 0)
  expect(ctx.moveTo).toHaveBeenLastCalledWith(200, 200)
  expect(ctx.lineTo).toHaveBeenLastCalledWith(600, 200)
})

function Harness() {
  const [studentId, selectStudent] = useState("student-1")
  const [visible, show] = useState(true)
  const { drawings } = useDrawingSession()
  return <>
    <button onClick={() => show(!visible)}>Toggle mode</button>
    <button onClick={() => selectStudent(studentId === "student-1" ? "student-2" : "student-1")}>Select student</button>
    {/* Reproduce SetItem's keyed remount under the persistent provider. */}
    {visible && <DrawingWorkspace key={studentId} studentId={studentId} owned />}
    <output data-testid="model">{JSON.stringify(drawings)}</output>
  </>
}

test.each(shapeTypes)("%s places one styled outline operation, previews without committing, and supports history", (type) => {
  render(<DrawingSessionProvider><Harness /></DrawingSessionProvider>)
  fireEvent.click(screen.getByRole("button", { name: "Red" }))
  fireEvent.click(screen.getByRole("button", { name: `Draw ${type.toLowerCase()}` }))
  expect(screen.getByRole("button", { name: `Draw ${type.toLowerCase()}` })).toHaveAttribute("aria-pressed", "true")
  fireEvent.pointerDown(canvas(), { pointerId: 1, button: 0, clientX: 460, clientY: 230 })
  fireEvent.pointerMove(canvas(), { pointerId: 1, clientX: 140, clientY: 70 })
  act(() => backend.flushFrame())
  expect(screen.getByTestId("model")).toHaveTextContent("{}")
  expect(backend.context(canvas()).stroke).toHaveBeenCalled()
  fireEvent.pointerUp(canvas(), { pointerId: 1, clientX: 140, clientY: 70 })
  const read = () => JSON.parse(screen.getByTestId("model").textContent!)[drawingPageKey("student-1")]
  const original = read()
  expect(original).toHaveLength(1)
  expect(original[0]).toMatchObject({ color: "#ed2f18", width: 2.5, opacity: 1, shape: { type } })
  fireEvent.click(screen.getByRole("button", { name: "Undo" })); expect(read()).toEqual([])
  fireEvent.click(screen.getByRole("button", { name: "Redo" })); expect(read()).toEqual(original)
  for (const name of ["Toggle mode", "Toggle mode", "Select student", "Select student"]) fireEvent.click(screen.getByText(name))
  expect(read()).toEqual(original)
  fireEvent.click(screen.getByRole("button", { name: "Use eraser" }))
  draw(canvas()); expect(read()[1].tool).toBe("eraser")
  fireEvent.click(screen.getByRole("button", { name: "Delete All" }))
  fireEvent.click(within(screen.getByRole("dialog")).getByRole("button", { name: "Delete All" }))
  expect(read()).toEqual([])
  fireEvent.click(screen.getByRole("button", { name: "Undo" })); expect(read()[0]).toEqual(original[0])
})

test("shape geometry handles all directions, equal pixel squares, and invalid dimensions", () => {
  for (const end of [{ x: .8, y: .9 }, { x: .2, y: .1 }, { x: .8, y: .1 }, { x: .2, y: .9 }]) {
    const square = shapeGeometry("Square", { x: .5, y: .5 }, end, 800, 400)!
    expect(square.width * 800).toBeCloseTo(square.height * 400)
    expect(square.x).toBeLessThanOrEqual(.5); expect(square.y).toBeLessThanOrEqual(.5)
  }
  expect(shapeGeometry("Rectangle", { x: .5, y: .5 }, { x: .5, y: .9 }, 400, 200)).toBeNull()
  expect(shapeGeometry("Line", { x: .5, y: .5 }, { x: .5, y: .9 }, 400, 200)).not.toBeNull()
  expect(shapePath("Star").match(/L/g)).toHaveLength(9)
})

test.each(["touch", "pen"])("%s shape placement captures starting properties and returns to freehand", (pointerType) => {
  render(<DrawingSessionProvider><Harness /></DrawingSessionProvider>)
  fireEvent.click(screen.getByRole("button", { name: "Use paintbrush" }))
  fireEvent.click(screen.getByRole("button", { name: "Increase brush size" }))
  fireEvent.change(screen.getByRole("slider", { name: "Transparency" }), { target: { value: 50 } })
  fireEvent.click(screen.getByRole("button", { name: "Red" }))
  fireEvent.click(screen.getByRole("button", { name: "Draw rectangle" }))
  fireEvent.pointerDown(canvas(), { pointerId: 7, pointerType, button: 0, clientX: 140, clientY: 70 })
  fireEvent.click(screen.getByRole("button", { name: "Blue" }))
  fireEvent.click(screen.getByRole("button", { name: "Increase brush size" }))
  fireEvent.change(screen.getByRole("slider", { name: "Transparency" }), { target: { value: 25 } })
  fireEvent.pointerMove(canvas(), { pointerId: 7, pointerType, clientX: 460, clientY: 230 })
  fireEvent.pointerUp(canvas(), { pointerId: 7, pointerType, clientX: 460, clientY: 230 })
  const read = () => JSON.parse(screen.getByTestId("model").textContent!)[drawingPageKey("student-1")]
  expect(read()[0]).toMatchObject({ width: 9, color: "#ed2f18", opacity: .5, shape: { type: "Rectangle", x: .1, y: .1, width: .8, height: .8 } })
  fireEvent.click(screen.getByRole("button", { name: "Use paintbrush" }))
  draw(canvas(), pointerType)
  expect(read()[1]).toMatchObject({ width: 10, color: "#2457e9", opacity: .25 })
  expect(read()[1].shape).toBeUndefined()
  expect(read()[0].opacity).toBe(.5)
})

test.each(["pointercancel", "lostpointercapture"])("%s discards a shape preview; tiny shapes also create no history", (event) => {
  const commit = jest.fn()
  const { unmount } = render(<DrawingSurface selectedShape="Circle" studentId="student-1" owned tool="pencil" strokes={[]} onCommit={commit} />)
  fireEvent.pointerDown(canvas(), { pointerId: 1, button: 0, clientX: 140, clientY: 70 })
  fireEvent.pointerMove(canvas(), { pointerId: 1, clientX: 300, clientY: 150 })
  fireEvent(canvas(), new PointerEvent(event, { pointerId: 1 }))
  fireEvent.pointerUp(canvas(), { pointerId: 1, clientX: 300, clientY: 150 })
  fireEvent.pointerDown(canvas(), { pointerId: 2, button: 0, clientX: 140, clientY: 70 })
  fireEvent.pointerUp(canvas(), { pointerId: 2, clientX: 140, clientY: 70 })
  fireEvent.pointerDown(canvas(), { pointerId: 3, button: 0, clientX: 140, clientY: 70 })
  unmount()
  expect(commit).not.toHaveBeenCalled()
  expect(backend.frames.size).toBe(0)
})

test("history replays erasing and clearing in order and discards obsolete redo actions", () => {
  const stroke: DrawingStroke = { tool: "pencil", ...drawingTools.pencil, points: [{ x: .5, y: .5 }] }
  let history = recordAction(emptyHistory, { type: "stroke", stroke })
  history = recordAction(history, { type: "stroke", stroke: { ...stroke, tool: "eraser" } })
  const drawing = replayHistory(history)
  history = recordAction(history, { type: "clear" })
  expect(replayHistory(history)).toEqual([])
  expect(replayHistory({ ...history, cursor: 2 })).toEqual(drawing)
  const branched = recordAction({ ...history, cursor: 1 }, { type: "stroke", stroke })
  expect(branched.actions).toHaveLength(2)
  expect(replayHistory(branched)).toEqual([stroke, stroke])
})

test("undo/redo supports each tool, invalidates redo on new strokes, and cancels unfinished input", () => {
  render(<DrawingSessionProvider><Harness /></DrawingSessionProvider>)
  const model = () => JSON.parse(screen.getByTestId("model").textContent!)[drawingPageKey("student-1")] ?? []
  const undo = () => fireEvent.click(screen.getByRole("button", { name: "Undo" }))
  const redo = () => fireEvent.click(screen.getByRole("button", { name: "Redo" }))
  for (const tool of ["pencil", "paintbrush", "eraser"]) {
    fireEvent.click(screen.getByRole("button", { name: `Use ${tool}` }))
    const before = model()
    draw(canvas()); const after = model()
    undo(); expect(model()).toEqual(before)
    redo(); expect(model()).toEqual(after)
  }
  undo(); undo(); expect(model()).toHaveLength(1)
  draw(canvas()); expect(screen.getByRole("button", { name: "Redo" })).toBeDisabled()
  expect(model()).toHaveLength(2)
  fireEvent.pointerDown(canvas(), { pointerId: 20, button: 0, clientX: 200, clientY: 100 })
  undo()
  fireEvent.pointerUp(canvas(), { pointerId: 20, clientX: 300, clientY: 150 })
  expect(model()).toHaveLength(1)
  expect(backend.frames.size).toBe(0)
})

test("clear confirmation is cancellable and undoable, with isolated persistent page history and settings", () => {
  render(<DrawingSessionProvider><Harness /></DrawingSessionProvider>)
  const read = (student: string) => JSON.parse(screen.getByTestId("model").textContent!)[drawingPageKey(student)] ?? []
  const click = (name: string) => fireEvent.click(screen.getByRole("button", { name }))
  expect(screen.getByRole("button", { name: "Delete All" })).toBeDisabled()
  draw(canvas()); draw(canvas())
  const original = read("student-1")
  click("Delete All"); expect(screen.getByRole("dialog", { name: "Clear this page?" })).toBeInTheDocument()
  click("Cancel"); expect(read("student-1")).toEqual(original)
  click("Select student"); draw(canvas()); const other = read("student-2")
  click("Select student")
  click("Red"); click("Increase brush size")
  click("Delete All")
  fireEvent.click(within(screen.getByRole("dialog")).getByRole("button", { name: "Delete All" }))
  expect(read("student-1")).toEqual([])
  expect(read("student-2")).toEqual(other)
  expect(screen.getByRole("button", { name: "Delete All" })).toBeDisabled()
  expect(screen.getByRole("button", { name: "Red" })).toHaveAttribute("aria-pressed", "true")
  expect(screen.getByLabelText("Brush size")).toHaveTextContent("3.5px")
  for (const name of ["Toggle mode", "Toggle mode", "Select student", "Select student"]) click(name)
  click("Undo"); expect(read("student-1")).toEqual(original)
  act(() => backend.resize({ left: 100, top: 50, width: 800, height: 400 }, 2))
  expect(backend.context(canvas()).lineTo).toHaveBeenLastCalledWith(720, 360)
  click("Redo"); expect(read("student-1")).toEqual([])
  expect(read("student-2")).toEqual(other)
})

test("all swatches and rainbow positions affect only subsequent strokes", () => {
  render(<DrawingSessionProvider><Harness /></DrawingSessionProvider>)
  draw(canvas())
  const swatches = screen.getByRole("group", { name: "Colour palette" }).querySelectorAll<HTMLButtonElement>(".drawing-colors button")
  expect(swatches).toHaveLength(20)
  for (const swatch of swatches) {
    fireEvent.click(swatch)
    expect(swatch).toHaveAttribute("aria-pressed", "true")
    expect([...swatches].filter((button) => button.getAttribute("aria-pressed") === "true")).toHaveLength(1)
    draw(canvas())
  }
  const rainbow = screen.getByRole("slider", { name: "Rainbow colour" })
  for (const value of [0, 25, 60, 100]) {
    fireEvent.change(rainbow, { target: { value } })
    // The initial endpoint may already be selected: clicking still selects its colour.
    fireEvent.pointerDown(rainbow)
    draw(canvas())
  }
  const strokes: DrawingStroke[] = JSON.parse(screen.getByTestId("model").textContent!)[drawingPageKey("student-1")]
  expect(strokes[0].color).toBe("#30343b")
  expect(strokes.slice(1, 21).map((stroke) => stroke.color)).toEqual(["#ffffff", "#000000", "#888887", "#583d27", "#ed2f18", "#f17b21", "#fff23a", "#48a62c", "#71e9df", "#2457e9", "#7600e8", "#e627d1", "#ec8b8b", "#e9c270", "#fff89c", "#a0e589", "#bdeae6", "#7b82ec", "#be91df", "#df80b0"])
  expect(strokes.slice(21).map((stroke) => stroke.color)).toEqual([0, 25, 60, 100].map(rainbowColor))
})

test("sizes clamp at 1–40, remain independent, and settings survive modes and student remounts", () => {
  render(<DrawingSessionProvider><Harness /></DrawingSessionProvider>)
  const size = () => screen.getByLabelText("Brush size")
  const plus = () => fireEvent.click(screen.getByRole("button", { name: "Increase brush size" }))
  const minus = () => fireEvent.click(screen.getByRole("button", { name: "Decrease brush size" }))
  expect(size()).toHaveTextContent("2.5px")
  plus(); expect(size()).toHaveTextContent("3.5px")
  fireEvent.click(screen.getByRole("button", { name: "Use paintbrush" }))
  expect(size()).toHaveTextContent("8px")
  minus(); expect(size()).toHaveTextContent("7px")
  fireEvent.change(screen.getByRole("slider", { name: "Rainbow colour" }), { target: { value: 35 } })
  for (const name of ["Toggle mode", "Toggle mode", "Select student", "Select student"]) fireEvent.click(screen.getByText(name))
  expect(size()).toHaveTextContent("7px")
  expect(screen.getByRole("slider", { name: "Rainbow colour" })).toHaveValue("35")
  draw(canvas())
  const model = JSON.parse(screen.getByTestId("model").textContent!)
  expect(model[drawingPageKey("student-1")][0]).toMatchObject({ color: rainbowColor(35), width: 7, tool: "paintbrush", opacity: 1 })
  fireEvent.click(screen.getByRole("button", { name: "Use pencil" }))
  expect(size()).toHaveTextContent("3.5px")
  for (let i = 0; i < 45; i++) plus()
  expect(size()).toHaveTextContent("40px")
  expect(screen.getByRole("button", { name: "Increase brush size" })).toBeDisabled()
  for (let i = 0; i < 45; i++) minus()
  expect(size()).toHaveTextContent("1px")
  expect(screen.getByRole("button", { name: "Decrease brush size" })).toBeDisabled()
})

test("changing settings during an active stroke preserves its starting properties", () => {
  const commit = jest.fn()
  const props = { studentId: "student-1", owned: true, tool: "pencil" as const, strokes: [], onCommit: commit }
  const { rerender } = render(<DrawingSurface {...props} color="#ed2f18" width={4.5} opacity={.8} />)
  fireEvent.pointerDown(canvas(), { pointerId: 1, button: 0, clientX: 140, clientY: 70 })
  rerender(<DrawingSurface {...props} color="#2457e9" width={20} opacity={1} />)
  fireEvent.pointerMove(canvas(), { pointerId: 1, clientX: 300, clientY: 150 })
  expect(commit).not.toHaveBeenCalled()
  fireEvent.pointerUp(canvas(), { pointerId: 1, clientX: 460, clientY: 230 })
  draw(canvas())
  expect(commit.mock.calls[0][0]).toMatchObject({ color: "#ed2f18", width: 4.5, opacity: .8 })
  expect(commit.mock.calls[1][0]).toMatchObject({ color: "#2457e9", width: 20, opacity: 1 })
})

test("eraser uses ordered destination-out compositing, ignores opacity, and resets drawing properties", () => {
  const ctx = makeDrawingContext() as ReturnType<typeof makeDrawingContext> & { globalCompositeOperation: string }
  const operations: unknown[] = []
  ctx.stroke.mockImplementation(() => { operations.push([ctx.globalCompositeOperation, ctx.globalAlpha, ctx.lineWidth]) })
  const points = [{ x: .2, y: .5 }, { x: .8, y: .5 }]
  const strokes: DrawingStroke[] = [
    { tool: "pencil", ...drawingTools.pencil, opacity: .5, points },
    { tool: "eraser", ...drawingTools.eraser, opacity: .1, points },
    { tool: "paintbrush", ...drawingTools.paintbrush, opacity: .25, points },
  ]
  for (const width of [400, 800]) renderDrawing(ctx as unknown as CanvasRenderingContext2D, strokes, width, 200)
  expect(operations).toEqual(Array(2).fill([["source-over", .5, 2.5], ["destination-out", 1, 16], ["source-over", .25, 8]]).flat())
  expect(strokes[0].opacity).toBe(.5)
})

test("eraser size and opacity survive modes and students; eraser captures full opacity", () => {
  render(<DrawingSessionProvider><Harness /></DrawingSessionProvider>)
  const opacity = () => screen.getByRole("slider", { name: "Transparency" })
  for (const percent of [100, 50, 25]) {
    fireEvent.change(opacity(), { target: { value: percent } }); draw(canvas())
  }
  fireEvent.click(screen.getByRole("button", { name: "Use eraser" }))
  expect(screen.getByLabelText("Brush size")).toHaveTextContent("16px")
  fireEvent.click(screen.getByRole("button", { name: "Increase brush size" }))
  draw(canvas(), "touch")
  for (const name of ["Toggle mode", "Toggle mode", "Select student", "Select student"]) fireEvent.click(screen.getByText(name))
  expect(screen.getByRole("button", { name: "Use eraser" })).toHaveAttribute("aria-pressed", "true")
  expect(screen.getByLabelText("Brush size")).toHaveTextContent("17px")
  expect(opacity()).toHaveValue("25")
  fireEvent.click(screen.getByRole("button", { name: "Use pencil" }))
  expect(screen.getByLabelText("Brush size")).toHaveTextContent("2.5px")
  draw(canvas())
  const strokes: DrawingStroke[] = JSON.parse(screen.getByTestId("model").textContent!)[drawingPageKey("student-1")]
  expect(strokes.map(s => s.opacity)).toEqual([1, .5, .25, 1, .25])
  expect(strokes[3]).toMatchObject({ tool: "eraser", width: 17 })
})

test("tool switching and per-student strokes survive mode changes and keyed student remounts", () => {
  render(<StrictMode><DrawingSessionProvider><Harness /></DrawingSessionProvider></StrictMode>)
  draw(canvas())
  fireEvent.click(screen.getByRole("button", { name: "Use paintbrush" }))
  expect(screen.getByRole("button", { name: "Use paintbrush" })).toHaveAttribute("aria-pressed", "true")
  draw(canvas())
  for (let i = 0; i < 3; i++) {
    fireEvent.click(screen.getByRole("button", { name: "Use pencil" }))
    fireEvent.click(screen.getByRole("button", { name: "Use paintbrush" }))
  }
  fireEvent.click(screen.getByText("Toggle mode"))
  fireEvent.click(screen.getByText("Toggle mode"))
  backend.context(canvas()).stroke.mockClear()
  act(() => backend.resize({ left: 100, top: 50, width: 400, height: 200 }))
  expect(backend.context(canvas()).stroke).toHaveBeenCalledTimes(2)
  fireEvent.click(screen.getByText("Select student"))
  expect(backend.context(canvas()).stroke).not.toHaveBeenCalled()
  draw(canvas(), "pen")
  fireEvent.click(screen.getByText("Select student"))
  backend.context(canvas()).stroke.mockClear()
  act(() => backend.resize({ left: 100, top: 50, width: 400, height: 200 }))
  expect(backend.context(canvas()).stroke).toHaveBeenCalledTimes(2)
  const model = JSON.parse(screen.getByTestId("model").textContent!)
  expect(model[drawingPageKey("student-1")].map((stroke: DrawingStroke) => [stroke.tool, stroke.width])).toEqual([["pencil", 2.5], ["paintbrush", 8]])
  expect(model[drawingPageKey("student-2")]).toHaveLength(1)
  expect(model[drawingPageKey("student-2")][0].tool).toBe("paintbrush")
})

test("active stroke unmount commits to its original student and cancels scheduled rendering/listeners", () => {
  const committed = jest.fn()
  function Owner({ studentId }: { studentId: string }) {
    const commit = useCallback((stroke: DrawingStroke) => committed(studentId, stroke), [studentId])
    return <DrawingSurface studentId={studentId} owned tool="pencil" strokes={[]} onCommit={commit} />
  }
  const { rerender, unmount } = render(<StrictMode><Owner studentId="student-1" /></StrictMode>)
  const oldCanvas = canvas()
  fireEvent.pointerDown(oldCanvas, { pointerId: 1, button: 0, clientX: 200, clientY: 100 })
  rerender(<StrictMode><Owner studentId="student-2" /></StrictMode>)
  expect(committed).toHaveBeenCalledTimes(1)
  expect(committed).toHaveBeenCalledWith("student-1", expect.objectContaining({ points: [{ x: .25, y: .25 }] }))
  fireEvent.pointerDown(canvas(), { pointerId: 2, button: 0, clientX: 200, clientY: 100 })
  unmount()
  expect(committed).toHaveBeenCalledTimes(2)
  expect(committed.mock.calls[1][0]).toBe("student-2")
  expect(backend.frames.size).toBe(0)
  expect(backend.observers.every(({ disconnect }) => disconnect.mock.calls.length === 1)).toBe(true)
  fireEvent.pointerDown(oldCanvas, { pointerId: 3, button: 0, clientX: 200, clientY: 100 })
  expect(backend.frames.size).toBe(0)
})
