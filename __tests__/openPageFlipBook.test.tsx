import React, { StrictMode } from "react"
import { act, cleanup, fireEvent, render, screen, within } from "@testing-library/react"
import "@testing-library/jest-dom"
import { doc, onSnapshot, setDoc } from "@firebase/firestore"
import SetItem from "../src/app/creating-stories/components/SetItem"
import OpenPageFlipBook from "../src/app/creating-stories/components/OpenPageFlipBook"

jest.mock("@/src/utils/firestore", () => ({ __esModule: true, default: {} }))
jest.mock("@firebase/firestore", () => ({
  collection: jest.fn(() => "items"),
  doc: jest.fn((_db, collection, id) => ({ collection, id })),
  onSnapshot: jest.fn(),
  setDoc: jest.fn(),
}))

const students = ["student-1", "student-2", "student-3"]
let now: number
let nextFrame: number
let frames: Map<number, FrameRequestCallback>
let viewportWidth: number
let viewportHeight: number
const observers = new Map<ResizeObserver, ResizeObserverCallback>()
const unsubscribe = jest.fn()
let snapshot: (data: { docs: { id: string; data: () => { name: string } }[] }) => void

function publish(text = "Student one’s saved story") {
  snapshot({ docs: students.map((id, index) => ({ id, data: () => ({ name: index === 0 ? text : `Story from ${id}` }) })) })
}

beforeEach(() => {
  jest.clearAllMocks()
  now = 0
  nextFrame = 1
  frames = new Map()
  viewportWidth = 1000
  viewportHeight = 600
  observers.clear()
  jest.spyOn(performance, "now").mockImplementation(() => now)
  jest.spyOn(window, "requestAnimationFrame").mockImplementation((callback) => {
    const id = nextFrame++
    frames.set(id, callback)
    return id
  })
  jest.spyOn(window, "cancelAnimationFrame").mockImplementation((id) => { frames.delete(id) })
  window.matchMedia = jest.fn().mockReturnValue({ matches: false })
  global.ResizeObserver = class {
    constructor(callback: ResizeObserverCallback) { observers.set(this, callback) }
    observe() {}
    unobserve() {}
    disconnect() { observers.delete(this) }
  }
  jest.spyOn(HTMLElement.prototype, "clientWidth", "get").mockImplementation(() => viewportWidth)
  jest.spyOn(HTMLElement.prototype, "clientHeight", "get").mockImplementation(() => viewportHeight)
  ;(onSnapshot as jest.Mock).mockImplementation((_collection, callback) => {
    snapshot = callback
    publish()
    return unsubscribe
  })
  ;(setDoc as jest.Mock).mockResolvedValue(undefined)
})

afterEach(() => {
  cleanup()
  expect(frames.size).toBe(0)
  expect(observers.size).toBe(0)
  jest.restoreAllMocks()
})

async function step(milliseconds = 1600) {
  await act(async () => {
    const end = now + milliseconds
    while (now < end) {
      now = Math.min(now + 16, end)
      const callbacks = [...frames.values()]
      frames.clear()
      callbacks.forEach((callback) => callback(now))
    }
  })
}

async function setup(studentId = "student-1") {
  const result = render(<StrictMode><SetItem studentId={studentId} students={students} renderer="openpageflip" /></StrictMode>)
  await act(async () => {})
  return result
}

function visiblePages(container: HTMLElement) {
  return [...container.querySelectorAll<HTMLElement>("[data-opf-page]")].filter((page) => page.style.display === "block")
}

test("legacy is the default and renderer selection is fixed for the mounted SetItem", async () => {
  const { container, rerender } = render(<SetItem studentId="student-1" students={students} />)
  expect(container.querySelector(".opf-book")).toBeNull()
  expect(screen.getByRole("textbox")).toHaveValue("Student one’s saved story")
  rerender(<SetItem studentId="student-1" students={students} renderer="openpageflip" />)
  expect(container.querySelector(".opf-book")).toBeNull()
})

test("opens the correct two-page spread with real editor, content and printed numbers", async () => {
  const { container } = await setup()
  expect(container.querySelectorAll("[data-opf-page]")).toHaveLength(6)
  const [drawing, writing] = visiblePages(container)
  expect(within(drawing).getByText("Your drawing")).toBeInTheDocument()
  expect(within(drawing).getByText("1")).toBeInTheDocument()
  expect(within(writing).getByText("2")).toBeInTheDocument()
  expect(screen.getByRole("textbox", { name: "Your story" })).toHaveValue("Student one’s saved story")
  expect(screen.getByRole("button", { name: "Previous page" })).toBeDisabled()
  expect(container.querySelector('[data-student="student-2"]')).toHaveAttribute("inert")
})

test("typing retains textarea, selection, page elements and engine; save callbacks keep the Firestore contract", async () => {
  const { container } = await setup()
  const editor = screen.getByRole("textbox") as HTMLTextAreaElement
  const engine = container.querySelector(".opf-book")
  const pageElements = [...container.querySelectorAll("[data-opf-page]")]
  const originalObservers = [...observers.keys()]
  editor.focus()
  fireEvent.change(editor, { target: { value: "My new story\nwith a second line" } })
  editor.setSelectionRange(3, 7)
  expect(screen.getByRole("textbox")).toBe(editor)
  expect(editor).toHaveFocus()
  expect(editor.selectionStart).toBe(3)
  expect(editor.selectionEnd).toBe(7)
  expect(container.querySelector(".opf-book")).toBe(engine)
  expect([...container.querySelectorAll("[data-opf-page]")]).toEqual(pageElements)
  expect(observers.size).toBe(2) // one viewport observer, one engine observer
  expect([...observers.keys()]).toEqual(originalObservers)
  expect(frames.size).toBe(0)
  await act(async () => { fireEvent.keyDown(editor, { key: "Enter", ctrlKey: true }) })
  expect(doc).toHaveBeenLastCalledWith(expect.anything(), "items", "student-1")
  expect(setDoc).toHaveBeenLastCalledWith({ collection: "items", id: "student-1" }, { name: "My new story\nwith a second line" }, { merge: true })
  expect(setDoc).toHaveBeenCalledTimes(1)
  fireEvent.change(editor, { target: { value: "Another draft" } })
  await act(async () => { fireEvent.keyDown(editor, { key: "Enter", metaKey: true }) })
  expect(setDoc).toHaveBeenCalledTimes(2)
  fireEvent.change(editor, { target: { value: "Button save" } })
  await act(async () => { fireEvent.click(screen.getByRole("button", { name: "Save" })) })
  expect(setDoc).toHaveBeenCalledTimes(3)
  expect(setDoc).toHaveBeenLastCalledWith(expect.objectContaining({ id: "student-1" }), { name: "Button save" }, { merge: true })
})

test("IME composition does not trigger shortcut saving, and save failures retain the draft and existing error status", async () => {
  await setup()
  const editor = screen.getByRole("textbox")
  fireEvent.change(editor, { target: { value: "Keep this draft" } })
  fireEvent.keyDown(editor, { key: "Enter", ctrlKey: true, isComposing: true })
  expect(setDoc).not.toHaveBeenCalled()
  jest.spyOn(console, "log").mockImplementation(() => {})
  ;(setDoc as jest.Mock).mockRejectedValueOnce(new Error("Test save failure"))
  await act(async () => { fireEvent.click(screen.getByRole("button", { name: "Save" })) })
  expect(editor).toHaveValue("Keep this draft")
  expect(screen.getByRole("status")).toHaveTextContent("Couldn’t save. Try again.")
  expect(screen.getByRole("button", { name: "Save" })).toBeEnabled()
})

test("successful turns commit once after landing, auto-save owned text, and preserve boundaries and ownership", async () => {
  const { container } = await setup()
  fireEvent.change(screen.getByRole("textbox"), { target: { value: "Save on leaving" } })
  fireEvent.click(screen.getByRole("button", { name: "Next page" }))
  fireEvent.click(screen.getByRole("button", { name: "Next page" }))
  expect(setDoc).not.toHaveBeenCalled()
  await step(150)
  expect(screen.getByRole("button", { name: "Next page" })).toBeDisabled()
  await step()
  expect(setDoc).toHaveBeenCalledTimes(1)
  expect(setDoc).toHaveBeenLastCalledWith(expect.objectContaining({ id: "student-1" }), { name: "Save on leaving" }, { merge: true })
  const [drawing, writing] = visiblePages(container)
  expect(within(drawing).getByText("student-2’s drawing")).toBeInTheDocument()
  expect(within(drawing).getByText("3")).toBeInTheDocument()
  expect(within(writing).getByText("Story from student-2")).toBeInTheDocument()
  expect(within(writing).getByText("4")).toBeInTheDocument()
  expect(screen.queryByRole("textbox")).toBeNull()
  const hiddenEditor = container.querySelector("textarea")!
  expect(hiddenEditor).toHaveAttribute("readonly")
  expect(hiddenEditor.closest("[data-page-kind]")).toHaveAttribute("inert")
  fireEvent.change(hiddenEditor, { target: { value: "Must not edit" } })
  fireEvent.keyDown(hiddenEditor, { key: "Enter", ctrlKey: true })
  expect(setDoc).toHaveBeenCalledTimes(1)
  fireEvent.click(screen.getByRole("button", { name: "Next page" }))
  await step()
  expect(visiblePages(container)[0]).toHaveTextContent("student-3’s drawing")
  expect(screen.getByRole("button", { name: "Next page" })).toBeDisabled()
  fireEvent.click(screen.getByRole("button", { name: "Previous page" }))
  await step()
  expect(visiblePages(container)[0]).toHaveTextContent("student-2’s drawing")
  fireEvent.click(screen.getByRole("button", { name: "Previous page" }))
  await step()
  expect(screen.getByRole("textbox")).not.toHaveValue("Must not edit")
  expect(screen.getByRole("button", { name: "Previous page" })).toBeDisabled()
  expect(setDoc).toHaveBeenCalledTimes(1)
})

test("opens on another student's owned spread and Back to my page uses an immediate jump", async () => {
  const { container } = await setup("student-2")
  expect(visiblePages(container)[0]).toHaveTextContent("Your drawing")
  expect(visiblePages(container)[0]).toHaveTextContent("3")
  expect(screen.getByRole("textbox")).toHaveValue("Story from student-2")
  fireEvent.click(screen.getByRole("button", { name: "Next page" }))
  await step()
  fireEvent.click(screen.getByRole("button", { name: "Back to my page" }))
  expect(screen.getByRole("textbox")).toHaveValue("Story from student-2")
  expect(visiblePages(container)[1]).toHaveTextContent("4")
  expect(frames.size).toBe(0)
})

test("writing/drawing modes retain the editor and prohibit editing outside writing mode", async () => {
  const { container, rerender } = await setup()
  const editor = screen.getByRole("textbox")
  rerender(<StrictMode><SetItem studentId="student-1" students={students} renderer="openpageflip" mode="drawing" /></StrictMode>)
  expect(container.querySelector("textarea")).toBe(editor)
  expect(editor).toHaveAttribute("readonly")
  expect(editor).toHaveAttribute("inert")
  expect(editor).toHaveAttribute("tabindex", "-1")
  expect(container.querySelector(".production-flip-pan")).toHaveAttribute("data-mode", "drawing")
  fireEvent.change(editor, { target: { value: "Forbidden" } })
  fireEvent.keyDown(editor, { key: "Enter", ctrlKey: true })
  expect(setDoc).not.toHaveBeenCalled()
  rerender(<StrictMode><SetItem studentId="student-1" students={students} renderer="openpageflip" mode="writing" /></StrictMode>)
  expect(screen.getByRole("textbox")).toBe(editor)
  expect(editor).toHaveValue("Student one’s saved story")
  expect(editor).not.toHaveAttribute("readonly")
})

test("Firestore text updates preserve the active spread and editor instance", async () => {
  const { container } = await setup()
  const editor = screen.getByRole("textbox")
  act(() => publish("Updated from Firestore"))
  expect(screen.getByRole("textbox")).toBe(editor)
  expect(editor).toHaveValue("Updated from Firestore")
  fireEvent.change(editor, { target: { value: "Local draft wins" } })
  act(() => publish("Another remote update"))
  expect(editor).toHaveValue("Local draft wins")
  expect(visiblePages(container)[0]).toHaveTextContent("Your drawing")
})

test("resize waits for landing, preserves student and textarea, and releases all observers on unmount", async () => {
  const { container } = await setup()
  const editor = container.querySelector("textarea")
  fireEvent.click(screen.getByRole("button", { name: "Next page" }))
  await step(150)
  act(() => {
    viewportWidth = 720
    viewportHeight = 420
    for (const [observer, callback] of observers) callback([], observer)
  })
  await step()
  expect(visiblePages(container)[0]).toHaveTextContent("student-2’s drawing")
  expect(visiblePages(container)[0].style.width).toBe("360px")
  expect(visiblePages(container)[0].style.height).toBe("420px")
  expect(container.querySelector("textarea")).toBe(editor)
  expect(observers.size).toBe(2)
  fireEvent.click(screen.getByRole("button", { name: "Previous page" }))
  await step()
  expect(screen.getByRole("textbox")).toBe(editor)
})

test("unmount during a turn neither navigates nor saves and stale frames cannot restart work", async () => {
  const { unmount } = await setup()
  fireEvent.change(screen.getByRole("textbox"), { target: { value: "Uncommitted" } })
  fireEvent.click(screen.getByRole("button", { name: "Next page" }))
  await step(120)
  const stale = [...frames.values()]
  unmount()
  await act(async () => { stale.forEach((callback) => callback(now + 2000)) })
  expect(setDoc).not.toHaveBeenCalled()
  expect(unsubscribe).toHaveBeenCalled()
  expect(frames.size).toBe(0)
})

test("structural changes wait for idle and cancel the old student-index commitment", async () => {
  const pages = students.map((id, i) => ({ id, label: id, text: `Text ${i}`, mine: i === 0 }))
  const onTurn = jest.fn()
  const props = { pages, index: 0, myIndex: 0, onTurn, onJump: jest.fn(), onChangeText: jest.fn(), onSave: jest.fn(), saved: true, error: false }
  const { container, rerender } = render(<StrictMode><OpenPageFlipBook {...props} /></StrictMode>)
  await act(async () => {})
  fireEvent.click(screen.getByRole("button", { name: "Next page" }))
  await step(120)
  rerender(<StrictMode><OpenPageFlipBook {...props} pages={[pages[0], pages[2]]} /></StrictMode>)
  expect(container.querySelectorAll("[data-opf-page]")).toHaveLength(6)
  await step()
  expect(onTurn).not.toHaveBeenCalled()
  expect(container.querySelectorAll("[data-opf-page]")).toHaveLength(4)
  expect(visiblePages(container)[0]).toHaveTextContent("Your drawing")
  expect(screen.getByRole("button", { name: "Next page" })).toBeEnabled()
})

test("reduced-motion turns commit once without an animation loop", async () => {
  window.matchMedia = jest.fn().mockReturnValue({ matches: true })
  const { container } = await setup()
  await act(async () => { fireEvent.click(screen.getByRole("button", { name: "Next page" })) })
  expect(visiblePages(container)[0]).toHaveTextContent("student-2’s drawing")
  expect(frames.size).toBe(0)
})
