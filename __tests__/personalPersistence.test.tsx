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
