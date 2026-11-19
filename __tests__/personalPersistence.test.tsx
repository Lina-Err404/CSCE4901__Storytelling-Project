import React from "react"
import { TextEncoder } from "node:util"
import "@testing-library/jest-dom"
import { act, cleanup, fireEvent, render, screen, within } from "@testing-library/react"
import type { User } from "firebase/auth"
import { PersonalStory } from "../src/app/creating-stories/components/PersonalCreatingStories"
import { DrawingSessionProvider } from "../src/app/creating-stories/components/drawing/DrawingSession"
import { installDrawingCanvas } from "./helpers/drawingCanvas"

jest.mock("../src/app/firebase-client", () => ({ auth: null }))
jest.mock("firebase/auth", () => ({ onAuthStateChanged: jest.fn() }))
jest.mock("../src/app/auth-screen", () => ({ AuthScreen: () => <p>Sign in</p> }))
jest.mock("@/src/utils/firestore", () => ({ __esModule: true, default: {} }))
const user = (uid: string) => ({ uid, getIdToken: jest.fn().mockResolvedValue(`token-${uid}`) }) as unknown as User
const alice = user("alice"), bob = user("bob")
let canvas: ReturnType<typeof installDrawingCanvas>
const response = (body: unknown, ok = true) => ({ ok, json: async () => body })
const fresh = { text: "Saved writing", drawing: null, revision: 0 }
const fetchMock = jest.fn()
beforeEach(() => {
  Object.assign(globalThis, { TextEncoder })
  canvas = installDrawingCanvas()
  window.matchMedia = jest.fn().mockReturnValue({ matches: false })
  fetchMock.mockReset().mockResolvedValue(response(fresh))
  global.fetch = fetchMock
})
afterEach(() => { cleanup(); canvas.restore() })
const view = (owner = alice, mode: "writing" | "drawing" = "writing") => <DrawingSessionProvider key={owner.uid}><PersonalStory user={owner} mode={mode} /></DrawingSessionProvider>
const status = () => within(screen.getByRole("navigation", { name: "Story pages" })).getByRole("status")
test("loading gates editing, errors do not overwrite saved data, and retry restores writing", async () => {
  fetchMock.mockRejectedValueOnce(new Error("offline"))
  await act(async () => { render(view()) })
  expect(screen.queryByRole("textbox")).toBeNull()
  expect(screen.getByText(/offline/)).toBeInTheDocument()
  await act(async () => { fireEvent.click(screen.getByRole("button", { name: "Retry loading" })) })
  expect(screen.getByRole("textbox")).toHaveValue("Saved writing")
  expect(status()).toHaveTextContent("Saved")
  expect(fetchMock.mock.calls[1][1].headers.Authorization).toBe("Bearer token-alice")
})
test("one Save submits both text and drawing, preserves edits during an in-flight save, and retries failures", async () => {
  await act(async () => { render(view()) })
  fireEvent.change(screen.getByRole("textbox"), { target: { value: "First edit" } })
  let complete!: (value: unknown) => void
  fetchMock.mockImplementationOnce(() => new Promise(resolve => { complete = resolve }))
  await act(async () => { fireEvent.click(screen.getByRole("button", { name: "Save" })) })
  expect(status()).toHaveTextContent("Saving...")
  expect(screen.getByRole("button", { name: "Save" })).toBeDisabled()
  const sent = JSON.parse(fetchMock.mock.calls[1][1].body)
  expect(sent).toMatchObject({ text: "First edit", revision: 0, drawing: { studentId: "alice", storyId: null, pageId: "drawing", schemaVersion: 1, history: { actions: [], cursor: 0 } } })
  fireEvent.change(screen.getByRole("textbox"), { target: { value: "New edit during save" } })
  await act(async () => { complete(response({ revision: 1 })) })
  expect(status()).toHaveTextContent("Unsaved changes")
  fetchMock.mockResolvedValueOnce(response({ error: "Storage offline" }, false))
  await act(async () => { fireEvent.click(screen.getByRole("button", { name: "Save" })) })
  expect(status()).toHaveTextContent("Save failed")
  expect(screen.getByRole("textbox")).toHaveValue("New edit during save")
  fetchMock.mockResolvedValueOnce(response({ revision: 2 }))
  await act(async () => { fireEvent.click(screen.getByRole("button", { name: "Save" })) })
  expect(status()).toHaveTextContent("Saved")
})
test("drawing operations dirty the same Save button and survive mode changes", async () => {
  const { rerender } = render(view(alice, "drawing"))
  await act(async () => {})
  const target = screen.getByRole("img", { name: "Your drawing page" })
  fireEvent.pointerDown(target, { pointerId: 1, button: 0, clientX: 150, clientY: 80 })
  fireEvent.pointerUp(target, { pointerId: 1, clientX: 300, clientY: 150 })
  expect(status()).toHaveTextContent("Unsaved changes")
  rerender(view(alice, "writing"))
  expect(status()).toHaveTextContent("Unsaved changes")
  fetchMock.mockResolvedValueOnce(response({ revision: 1 }))
  await act(async () => { fireEvent.click(screen.getByRole("button", { name: "Save" })) })
  expect(JSON.parse(fetchMock.mock.calls[1][1].body).drawing.history.actions).toHaveLength(1)
  expect(status()).toHaveTextContent("Saved")
})
test("late responses from a previous authenticated owner cannot replace the current page", async () => {
  let old!: (value: unknown) => void
  fetchMock.mockImplementationOnce(() => new Promise(resolve => { old = resolve }))
  const { rerender } = render(view(alice))
  await act(async () => {})
  fetchMock.mockResolvedValueOnce(response({ ...fresh, text: "Bob's page" }))
  await act(async () => { rerender(view(bob)) })
  await act(async () => { old(response({ ...fresh, text: "Alice's late response" })) })
  expect(screen.getByRole("textbox")).toHaveValue("Bob's page")
  expect(fetchMock.mock.calls[0][1].signal.aborted).toBe(true)
})

test("Grammar Help uses the actual editor and Save draft; Dismiss does not edit", async () => {
  fetchMock.mockImplementation(async (url, options) => url === "/api/suggestions"
    ? response({ grammar: [{ original: "walk", replacement: "walked", explanation: "Past tense." }] })
    : options?.method === "PUT" ? response({ revision: 1 }) : response({ ...fresh, text: "She walk home." }))
  await act(async () => { render(view()) })
  const prompt = screen.getByLabelText("Writing prompt")
  fireEvent.click(screen.getByRole("button", { name: "Grammar Help" }))
  expect(screen.getByRole("region", { name: "Grammar Help" })).toBeVisible()
  fireEvent.click(await screen.findByRole("button", { name: "Dismiss suggestion 1" }))
  expect(screen.getByRole("textbox")).toHaveValue("She walk home.")
  expect(status()).toHaveTextContent("Saved")
  fireEvent.click(screen.getByRole("button", { name: "Grammar Help" }))
  fireEvent.click(screen.getByRole("button", { name: "Grammar Help" }))
  fireEvent.click(await screen.findByRole("button", { name: "Accept suggestion 1" }))
  expect(screen.getByRole("textbox")).toHaveValue("She walked home.")
  expect(screen.getByLabelText("Writing prompt")).toBe(prompt)
  expect(status()).toHaveTextContent("Unsaved changes")
  await act(async () => { fireEvent.click(screen.getByRole("button", { name: "Save" })) })
  expect(JSON.parse(fetchMock.mock.calls.find(([, opts]) => opts?.method === "PUT")![1].body).text).toBe("She walked home.")
  expect(status()).toHaveTextContent("Saved")
})

test("ideas generate/regenerate without editing and Use Idea appends to the same saved draft", async () => {
  let generation = 0
  fetchMock.mockImplementation(async (url, options) => url === "/api/suggestions"
    ? options?.method === "POST"
      ? response({ ideas: [`Idea ${++generation}`, "A friendly fox arrived.", "The map glowed."], remainingGenerations: 3 - generation })
      : response({ remainingGenerations: 3 })
    : options?.method === "PUT" ? response({ revision: 1 }) : response(fresh))
  await act(async () => { render(view()) })
  await act(async () => { fireEvent.click(screen.getByRole("button", { name: "Writing Suggestions" })) })
  expect(screen.getByRole("region", { name: "Writing Suggestions" })).toBeVisible()
  await act(async () => { fireEvent.click(screen.getByRole("button", { name: "Generate Ideas" })) })
  expect(screen.getAllByRole("button", { name: /Use idea/ })).toHaveLength(3)
  expect(screen.getByRole("textbox")).toHaveValue(fresh.text)
  expect(status()).toHaveTextContent("Saved")
  await act(async () => { fireEvent.click(screen.getByRole("button", { name: "Generate Again" })) })
  expect(screen.getByText("Idea 2")).toBeInTheDocument()
  expect(screen.getByText("1 of 3 generations remaining")).toBeVisible()
  fireEvent.click(screen.getByRole("button", { name: "Use idea 1" }))
  expect(screen.getByRole("textbox")).toHaveValue(fresh.text + "\n\nIdea 2")
  expect(status()).toHaveTextContent("Unsaved changes")
  expect(screen.getByLabelText("Writing prompt")).toBeVisible()
  await act(async () => { fireEvent.click(screen.getByRole("button", { name: "Save" })) })
  expect(JSON.parse(fetchMock.mock.calls.find(([, opts]) => opts?.method === "PUT")![1].body).text).toBe(fresh.text + "\n\nIdea 2")
  await act(async () => { fireEvent.click(screen.getByRole("button", { name: "Generate Again" })) })
  expect(screen.getByRole("button", { name: "Generate Again" })).toBeDisabled()
  expect(screen.getByRole("button", { name: "Use idea 1" })).toBeEnabled()
  expect(screen.getByText(/used your three idea generations/)).toBeVisible()
})

test.each(["", "First paragraph.\n\n  Second paragraph. "])("appends multiple ideas to the latest draft, preserving the exact original text %j", async original => {
  fetchMock.mockResolvedValueOnce(response({ ...fresh, text: original }))
  await act(async () => { render(view()) })
  fetchMock.mockResolvedValueOnce(response({ remainingGenerations: 3 }))
  await act(async () => { fireEvent.click(screen.getByRole("button", { name: "Writing Suggestions" })) })
  fetchMock.mockResolvedValueOnce(response({ ideas: ["First idea.", "Second idea.", "Third idea."], remainingGenerations: 2 }))
  await act(async () => { fireEvent.click(screen.getByRole("button", { name: "Generate Ideas" })) })
  const editor = screen.getByRole<HTMLTextAreaElement>("textbox")
  editor.setSelectionRange(0, 5)
  fireEvent.click(screen.getByRole("button", { name: "Use idea 1" }))
  const afterFirst = original ? `${original}\n\nFirst idea.` : "First idea."
  expect(editor).toHaveValue(afterFirst)
  fireEvent.click(screen.getByRole("button", { name: "Use idea 2" }))
  expect(editor).toHaveValue(`${afterFirst}\n\nSecond idea.`)
  expect(screen.getByText("2 of 3 generations remaining")).toBeVisible()
  expect(status()).toHaveTextContent("Unsaved changes")
})

test("idea errors/invalid responses are visible and stale responses cannot insert old ideas", async () => {
  await act(async () => { render(view()) })
  fetchMock.mockResolvedValueOnce(response({ remainingGenerations: 3 }))
  await act(async () => { fireEvent.click(screen.getByRole("button", { name: "Writing Suggestions" })) })
  fetchMock.mockResolvedValueOnce(response({ ideas: ["Only one"] }))
  await act(async () => { fireEvent.click(screen.getByRole("button", { name: "Generate Ideas" })) })
  expect(screen.getByText(/response was invalid/)).toBeInTheDocument()
  fetchMock.mockResolvedValueOnce(response({}, false))
  await act(async () => { fireEvent.click(screen.getByRole("button", { name: "Generate Ideas" })) })
  expect(screen.getByText(/Could not generate ideas/)).toBeInTheDocument()
  let finish!: (result: unknown) => void
  fetchMock.mockImplementationOnce(() => new Promise(resolve => { finish = resolve }))
  await act(async () => { fireEvent.click(screen.getByRole("button", { name: "Generate Ideas" })) })
  fireEvent.change(screen.getByRole("textbox"), { target: { value: "New writing" } })
  await act(async () => { finish(response({ ideas: ["Old one", "Old two", "Old three"], remainingGenerations: 2 })) })
  expect(screen.queryByRole("button", { name: /Use idea/ })).toBeNull()
  expect(screen.getByText("2 of 3 generations remaining")).toBeVisible()
  expect(screen.getByRole("textbox")).toHaveValue("New writing")
})
