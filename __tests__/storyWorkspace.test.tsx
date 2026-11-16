import React, { StrictMode } from "react"
import { act, fireEvent, render, screen, within } from "@testing-library/react"
import "@testing-library/jest-dom"
import { onSnapshot, setDoc } from "@firebase/firestore"
import { ReferenceCreatingStories } from "../src/app/creating-stories/creatingStories"
import StoryPromptPanel from "../src/app/creating-stories/components/StoryPromptPanel"
import StoryWorkspace from "../src/app/creating-stories/components/StoryWorkspace"
import { DEFAULT_STORY_PROMPT } from "../src/app/creating-stories/components/storyPrompt"
import DrawingAssetPanel from "../src/app/creating-stories/components/drawing/DrawingAssetPanel"

jest.mock("@/src/utils/firestore", () => ({ __esModule: true, default: {} }))
jest.mock("@firebase/firestore", () => ({
  collection: jest.fn(() => "items"),
  doc: jest.fn((_db, collection, id) => ({ collection, id })),
  onSnapshot: jest.fn(), setDoc: jest.fn(),
}))
// Test application state independently of the unchanged shared sidebar primitives.
jest.mock("@/components/ui/sidebar", () => ({ SidebarProvider: ({ children }: { children: React.ReactNode }) => <div>{children}</div> }))
jest.mock("@/components/app-sidebar", () => ({ AppSidebar: () => <aside aria-label="Existing drawing tools" /> }))

beforeEach(() => {
  jest.clearAllMocks()
  window.matchMedia = jest.fn().mockReturnValue({ matches: false })
  ;(setDoc as jest.Mock).mockResolvedValue(undefined)
  ;(onSnapshot as jest.Mock).mockImplementation((_collection, callback) => {
    callback({ docs: [1, 2, 3].map((n) => ({ id: `student-${n}`, data: () => ({ name: `Story ${n}` }) })) })
    return jest.fn()
  })
})

test("reference shell uses the existing prompt only in the left panel and identifies the current mode", () => {
  render(<ReferenceCreatingStories />)
  const toolbar = screen.getByRole("banner", { name: "Story toolbar" })
  expect(within(toolbar).getByRole("button", { name: /Writing Mode; switch to Drawing Mode/ })).toHaveTextContent("Writing Mode")
  expect(within(toolbar).queryByText(DEFAULT_STORY_PROMPT)).toBeNull()
  expect(screen.getByLabelText("Writing prompt")).toHaveTextContent(DEFAULT_STORY_PROMPT)
  expect(screen.getByRole("textbox", { name: "Your story" })).toHaveValue("Story 1")
  expect(screen.getByRole("button", { name: "Previous Page" })).toBeDisabled()
  expect(screen.getByRole("button", { name: "Save" })).toBeDisabled()
})

test("typing and both keyboard shortcuts use the original save document and merge contract", async () => {
  render(<ReferenceCreatingStories />)
  const editor = screen.getByRole("textbox")
  editor.focus()
  fireEvent.change(editor, { target: { value: "My story\nwith another line" } })
  expect(editor).toHaveFocus()
  expect(screen.getByRole("status")).toHaveTextContent("Not Saved")
  await act(async () => { fireEvent.keyDown(editor, { key: "Enter", ctrlKey: true }) })
  expect(setDoc).toHaveBeenLastCalledWith({ collection: "items", id: "student-1" }, { name: "My story\nwith another line" }, { merge: true })
  fireEvent.change(editor, { target: { value: "Mac shortcut" } })
  fireEvent.keyDown(editor, { key: "Enter", metaKey: true, isComposing: true })
  expect(setDoc).toHaveBeenCalledTimes(1)
  await act(async () => { fireEvent.keyDown(editor, { key: "Enter", metaKey: true }) })
  expect(setDoc).toHaveBeenCalledTimes(2)
  fireEvent.change(editor, { target: { value: "Button save" } })
  await act(async () => { fireEvent.click(screen.getByRole("button", { name: "Save" })) })
  expect(setDoc).toHaveBeenLastCalledWith(expect.objectContaining({ id: "student-1" }), { name: "Button save" }, { merge: true })
})

test("switching modes retains the draft, editor identity and subscription under Strict Mode", () => {
  render(<StrictMode><ReferenceCreatingStories /></StrictMode>)
  const editor = screen.getByRole("textbox")
  fireEvent.change(editor, { target: { value: "Unsaved across modes" } })
  const subscriptions = (onSnapshot as jest.Mock).mock.calls.length
  fireEvent.click(screen.getByRole("button", { name: /Writing Mode; switch to Drawing Mode/ }))
  expect(screen.getByRole("button", { name: /Drawing Mode; switch to Writing Mode/ })).toHaveTextContent("Drawing Mode")
  expect(screen.getByRole("complementary", { name: "Drawing assets" })).toBeInTheDocument()
  expect(editor).not.toBeVisible()
  expect(editor).toHaveAttribute("readonly")
  expect(editor).toHaveAttribute("inert")
  fireEvent.click(screen.getByRole("button", { name: /Drawing Mode; switch to Writing Mode/ }))
  expect(screen.getByRole("textbox")).toBe(editor)
  expect(editor).toHaveValue("Unsaved across modes")
  expect(onSnapshot).toHaveBeenCalledTimes(subscriptions)
  expect(setDoc).not.toHaveBeenCalled()
})

test("page navigation auto-saves once, respects ownership and boundaries, and returns to the owned page", async () => {
  render(<ReferenceCreatingStories />)
  fireEvent.change(screen.getByRole("textbox"), { target: { value: "Save when leaving" } })
  await act(async () => { fireEvent.click(screen.getByRole("button", { name: "Next Page" })) })
  expect(setDoc).toHaveBeenCalledTimes(1)
  const other = screen.getByRole("textbox")
  expect(other).toHaveValue("Story 2")
  expect(other).toHaveAttribute("readonly")
  fireEvent.change(other, { target: { value: "Forbidden" } })
  fireEvent.keyDown(other, { key: "Enter", ctrlKey: true })
  expect(setDoc).toHaveBeenCalledTimes(1)
  fireEvent.click(screen.getByRole("button", { name: "Next Page" }))
  expect(screen.getByRole("textbox")).toHaveValue("Story 3")
  expect(screen.getByRole("button", { name: "Next Page" })).toBeDisabled()
  fireEvent.click(screen.getByRole("button", { name: "Previous Page" }))
  expect(screen.getByRole("textbox")).toHaveValue("Story 2")
  fireEvent.click(screen.getByRole("button", { name: "Back to my page" }))
  expect(screen.getByRole("textbox", { name: "Your story" })).not.toHaveAttribute("readonly")
  expect(screen.getByRole("button", { name: "Previous Page" })).toBeDisabled()
})

test("the development student selector opens the correct owned page", () => {
  render(<ReferenceCreatingStories />)
  fireEvent.change(screen.getByRole("combobox", { name: "Current student (development only)" }), { target: { value: "student-2" } })
  expect(screen.getByRole("textbox", { name: "Your story" })).toHaveValue("Story 2")
  expect(screen.getByRole("textbox")).not.toHaveAttribute("readonly")
})

test("repeated navigation waits for the parent index to commit", () => {
  const props = {
    pages: [1, 2, 3].map((n) => ({ id: `student-${n}`, label: `Story ${n}`, text: "", mine: n === 1 })),
    index: 0, myIndex: 0, onTurn: jest.fn(), onJump: jest.fn(), onSave: jest.fn(), onChangeText: jest.fn(),
    saved: true, error: false, studentId: "student-1", students: ["student-1", "student-2", "student-3"], DrawingBook: () => null,
  }
  const { rerender } = render(<StoryWorkspace {...props} />)
  fireEvent.click(screen.getByRole("button", { name: "Next Page" }))
  fireEvent.click(screen.getByRole("button", { name: "Next Page" }))
  expect(props.onTurn).toHaveBeenCalledTimes(1)
  rerender(<StoryWorkspace {...props} index={1} />)
  fireEvent.click(screen.getByRole("button", { name: "Next Page" }))
  expect(props.onTurn).toHaveBeenCalledTimes(2)
})

test("Prompt is initially shown with four accessible inactive tool bookmarks and the full long prompt", () => {
  const prompt = "A long assignment. ".repeat(150)
  render(<StoryPromptPanel prompt={prompt} />)
  const buttons = within(screen.getByRole("group", { name: "Writing tools" })).getAllByRole("button")
  expect(buttons).toHaveLength(4)
  buttons.forEach((button) => expect(button).toHaveAttribute("aria-pressed", "false"))
  expect(screen.getByRole("region", { name: "Prompt" })).toBeInTheDocument()
  expect(screen.getByLabelText("Writing prompt").textContent).toBe(prompt)
})

test.each(["Text Boxes", "Grammar Help", "Writing Suggestions", "Vocab Sheet"])("%s opens below the persistent Prompt and a second click closes only the tool", (name) => {
  const prompt = "A longer writing assignment. ".repeat(150)
  render(<StoryPromptPanel prompt={prompt} />)
  const promptElement = screen.getByLabelText("Writing prompt")
  promptElement.scrollTop = 80
  const bookmark = screen.getByRole("button", { name })
  expect(bookmark).toHaveAttribute("title", name)
  fireEvent.click(bookmark)
  expect(bookmark).toHaveAttribute("aria-pressed", "true")
  expect(bookmark).toHaveAttribute("aria-expanded", "true")
  const content = screen.getByRole("region", { name })
  expect(bookmark).toHaveAttribute("aria-controls", content.id)
  expect(within(content).getByRole("heading", { name })).toBeInTheDocument()
  expect(within(content).getByText("This tool is coming soon.")).toBeInTheDocument()
  expect(screen.getByRole("region", { name: "Prompt" })).toBeVisible()
  expect(screen.getByLabelText("Writing prompt")).toBe(promptElement)
  expect(promptElement.textContent).toBe(prompt)
  expect(promptElement.scrollTop).toBe(80)
  expect(screen.getByLabelText(`${name} content`)).not.toBe(promptElement)
  fireEvent.click(bookmark)
  expect(bookmark).toHaveAttribute("aria-pressed", "false")
  expect(screen.getByRole("region", { name: "Prompt" })).toBeInTheDocument()
  expect(screen.queryByRole("region", { name })).toBeNull()
  expect(screen.getByLabelText("Writing prompt")).toBe(promptElement)
  expect(promptElement.textContent).toBe(prompt)
})

test("repeated switching between all tools preserves the editor, draft and save contract", async () => {
  render(<ReferenceCreatingStories />)
  const editor = screen.getByRole("textbox")
  const subscriptions = (onSnapshot as jest.Mock).mock.calls.length
  fireEvent.change(editor, { target: { value: "Draft while using tools" } })
  const names = ["Text Boxes", "Grammar Help", "Writing Suggestions", "Vocab Sheet"]
  for (let repeat = 0; repeat < 2; repeat++) {
    for (const name of names) {
      fireEvent.click(screen.getByRole("button", { name }))
      expect(screen.getByRole("region", { name })).toBeInTheDocument()
      expect(screen.getByRole("region", { name: "Prompt" })).toBeVisible()
      expect(screen.getByLabelText("Writing prompt")).toHaveTextContent(DEFAULT_STORY_PROMPT)
      for (const other of names) expect(screen.getByRole("button", { name: other })).toHaveAttribute("aria-pressed", String(other === name))
      expect(screen.getByRole("textbox")).toBe(editor)
      expect(editor).toHaveValue("Draft while using tools")
    }
    fireEvent.click(screen.getByRole("button", { name: "Vocab Sheet" }))
    expect(screen.getByLabelText("Writing prompt")).toHaveTextContent(DEFAULT_STORY_PROMPT)
  }
  expect(onSnapshot).toHaveBeenCalledTimes(subscriptions)
  expect(setDoc).not.toHaveBeenCalled()
  await act(async () => { fireEvent.click(screen.getByRole("button", { name: "Save" })) })
  expect(setDoc).toHaveBeenLastCalledWith({ collection: "items", id: "student-1" }, { name: "Draft while using tools" }, { merge: true })
})

test("bottom navigation contains only page controls and save status, with no smiley", () => {
  const { container } = render(<ReferenceCreatingStories />)
  const navigation = screen.getByRole("navigation", { name: "Story pages" })
  expect(within(navigation).getAllByRole("button").map((button) => button.textContent)).toEqual(["Previous Page", "Next Page", "Save"])
  expect(within(navigation).getByRole("status")).toHaveTextContent("Saved")
  expect(navigation.querySelector("svg")).toBeNull()
  expect(container.querySelector(".story-feedback, #story-smile-gold")).toBeNull()
})

test("Drawing Mode renders the reference panels and isolated placeholder, with unavailable drawing controls disabled", () => {
  render(<ReferenceCreatingStories />)
  fireEvent.click(screen.getByRole("button", { name: /Writing Mode; switch to Drawing Mode/ }))
  const assets = screen.getByRole("complementary", { name: "Drawing assets" })
  expect(within(assets).getByRole("button", { name: "Shapes" })).toHaveAttribute("aria-pressed", "true")
  expect(within(assets).getAllByRole("listitem")).toHaveLength(8)
  const canvas = screen.getByRole("img", { name: /Your drawing page; drawing canvas coming soon/ })
  expect(canvas).toHaveAttribute("data-student", "student-1")
  expect(canvas).toHaveAttribute("data-readonly", "false")
  const controls = screen.getByRole("complementary", { name: "Drawing controls" })
  within(controls).getAllByRole("button").forEach((button) => expect(button).toBeDisabled())
  expect(within(controls).getByRole("slider", { name: "Transparency" })).toBeDisabled()
  expect(within(controls).getByRole("slider")).toHaveValue("50")
  expect(within(controls).getByRole("group", { name: "Colour palette (coming soon)" }).querySelectorAll('.drawing-colors button')).toHaveLength(20)
  expect(within(screen.getByRole("navigation", { name: "Story pages" })).getAllByRole("button")).toHaveLength(3)
  expect(screen.getByText(/drawings cannot be edited or saved yet/)).toBeInTheDocument()
})

test("Drawing Mode retains student/page context, ownership boundaries and immediate navigation", () => {
  render(<ReferenceCreatingStories />)
  fireEvent.change(screen.getByRole("combobox"), { target: { value: "student-2" } })
  fireEvent.click(screen.getByRole("button", { name: /Writing Mode; switch to Drawing Mode/ }))
  expect(screen.getByRole("combobox")).toHaveValue("student-2")
  expect(screen.getByRole("img", { name: /Your drawing page/ })).toHaveAttribute("data-student", "student-2")
  fireEvent.click(screen.getByRole("button", { name: "Next Page" }))
  expect(screen.getByRole("img", { name: /student-3’s drawing page/ })).toHaveAttribute("data-readonly", "true")
  expect(screen.getByRole("button", { name: "Next Page" })).toBeDisabled()
  fireEvent.click(screen.getByRole("button", { name: "Previous Page" }))
  expect(screen.getByRole("img", { name: /Your drawing page/ })).toHaveAttribute("data-student", "student-2")
  fireEvent.click(screen.getByRole("button", { name: "Previous Page" }))
  expect(screen.getByRole("button", { name: "Previous Page" })).toBeDisabled()
  fireEvent.click(screen.getByRole("button", { name: "Back to my page" }))
  fireEvent.click(screen.getByRole("button", { name: /Drawing Mode; switch to Writing Mode/ }))
  expect(screen.getByRole("textbox", { name: "Your story" })).toHaveValue("Story 2")
  expect(screen.getByRole("combobox")).toHaveValue("student-2")
})

test("Drawing Mode Save retains the existing story-text callback and does not claim to save drawings", async () => {
  render(<ReferenceCreatingStories />)
  fireEvent.change(screen.getByRole("textbox"), { target: { value: "Still my writing draft" } })
  fireEvent.click(screen.getByRole("button", { name: /Writing Mode; switch to Drawing Mode/ }))
  const save = screen.getByRole("button", { name: "Save" })
  expect(save).toHaveAttribute("title", "Save story text; drawing saving is coming soon")
  await act(async () => { fireEvent.click(save) })
  expect(setDoc).toHaveBeenCalledTimes(1)
  expect(setDoc).toHaveBeenLastCalledWith({ collection: "items", id: "student-1" }, { name: "Still my writing draft" }, { merge: true })
})


test("existing stamp/background paths are used for paged previews without a canvas placement action", () => {
  render(<DrawingAssetPanel />)
  fireEvent.click(screen.getByRole("button", { name: "Stamps" }))
  expect(screen.getAllByRole("img")).toHaveLength(8)
  expect(screen.getAllByRole("img")[0]).toHaveAttribute("src", "/images/character/20220728_125054.png")
  fireEvent.click(screen.getByRole("button", { name: "Next asset page" }))
  expect(screen.getAllByRole("img")).toHaveLength(5)
  expect(screen.getByRole("button", { name: "Next asset page" })).toBeDisabled()
  fireEvent.click(screen.getByRole("button", { name: "Previous asset page" }))
  expect(screen.getAllByRole("img")).toHaveLength(8)
  fireEvent.click(screen.getByRole("button", { name: "Browse backgrounds" }))
  expect(screen.getAllByRole("img")).toHaveLength(7)
  expect(screen.getAllByRole("img")[0]).toHaveAttribute("src", "/images/background/Untitled103_20260424135732.png")
  expect(screen.getByRole("status")).toHaveTextContent("Placing assets is coming soon.")
  fireEvent.click(screen.getByRole("button", { name: "Shapes" }))
  expect(screen.queryAllByRole("img")).toHaveLength(0)
  expect(screen.getAllByRole("listitem")).toHaveLength(8)
})
