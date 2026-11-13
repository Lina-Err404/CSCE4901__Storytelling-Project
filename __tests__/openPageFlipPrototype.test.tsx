import React, { StrictMode, createRef } from "react"
import { act, fireEvent, render, screen } from "@testing-library/react"
import { renderToString } from "react-dom/server"
import "@testing-library/jest-dom"
import { FlipBook, Page, type Book } from "@openpageflip/react"
import { createBook, type Clock } from "@openpageflip/core"
import OpenPageFlipPrototype from "../src/app/openpageflip-prototype/OpenPageFlipPrototype"

// Test-only scheduler: count real package requests/cancellations, without hiding
// leaks by clearing timers. Production uses the browser's untouched RAF.
let now: number
let nextId: number
let frames: Map<number, FrameRequestCallback>
let requested: jest.SpyInstance
const observers = new Set<ResizeObserver>()

beforeEach(() => {
  now = 0
  nextId = 1
  frames = new Map()
  observers.clear()
  jest.spyOn(performance, "now").mockImplementation(() => now)
  requested = jest.spyOn(window, "requestAnimationFrame").mockImplementation((callback) => {
    const id = nextId++
    frames.set(id, callback)
    return id
  })
  jest.spyOn(window, "cancelAnimationFrame").mockImplementation((id) => { frames.delete(id) })
  window.matchMedia = jest.fn().mockReturnValue({ matches: false })
  global.ResizeObserver = class {
    constructor() { observers.add(this) }
    observe() {}
    unobserve() {}
    disconnect() { observers.delete(this) }
  }
  jest.spyOn(HTMLElement.prototype, "clientWidth", "get").mockReturnValue(1000)
  jest.spyOn(HTMLElement.prototype, "clientHeight", "get").mockReturnValue(600)
})

afterEach(() => { jest.restoreAllMocks() })

async function step(milliseconds: number) {
  await act(async () => {
    const end = now + milliseconds
    while (now < end) {
      now = Math.min(now + 16, end)
      const current = [...frames.values()]
      frames.clear()
      current.forEach((callback) => callback(now))
    }
  })
}

function pages() {
  return [1, 2, 3, 4].map((n) => <Page key={n} density="soft">Page {n}</Page>)
}

test("official React component can server-render before effects initialize the engine", () => {
  expect(renderToString(<OpenPageFlipPrototype />)).toContain("The lantern in the woods")
  expect(requested).not.toHaveBeenCalled()
  expect(observers.size).toBe(0)
})

test("Strict Mode leaves one live instance and unmount cancels an in-flight real animation", async () => {
  const ref = createRef<Book>()
  const events = jest.fn()
  const { container, unmount } = render(<StrictMode><FlipBook ref={ref} width={440} height={540} layout="spread" onFlip={events} onFlipProgress={events} onChangeState={events}>{pages()}</FlipBook></StrictMode>)
  await act(async () => {})
  expect(container.querySelectorAll(".opf-book")).toHaveLength(1)
  expect(observers.size).toBe(1)
  expect(ref.current?.pageCount).toBe(4)
  expect(frames.size).toBe(0) // no perpetual idle render loop
  act(() => { void ref.current!.flipNext("bottom") })
  await step(250)
  expect(frames.size).toBe(1)
  const staleCallbacks = [...frames.values()]
  const retainedHandle = ref.current!
  unmount()
  expect(frames.size).toBe(0)
  expect(observers.size).toBe(0)
  expect(() => retainedHandle.page).toThrow("not mounted")
  const eventCount = events.mock.calls.length
  const requestCount = requested.mock.calls.length
  await step(3000)
  // A callback already dequeued by the browser must also be harmless.
  staleCallbacks.forEach((callback) => callback(now))
  expect(events).toHaveBeenCalledTimes(eventCount)
  expect(requested).toHaveBeenCalledTimes(requestCount)
  expect(frames.size).toBe(0)
})

test("six Strict Mode mount/unmount cycles accumulate no frames, observers or late callbacks", async () => {
  const events = jest.fn()
  for (let i = 0; i < 6; i++) {
    const ref = createRef<Book>()
    const { unmount } = render(<StrictMode><FlipBook ref={ref} width={440} height={540} layout="spread" onInit={events} onFlip={events} onFlipProgress={events}>{pages()}</FlipBook></StrictMode>)
    await act(async () => {})
    expect(observers.size).toBe(1)
    act(() => { void ref.current!.flipNext() })
    await step(200)
    unmount()
    expect(frames.size).toBe(0)
    expect(observers.size).toBe(0)
    const eventCount = events.mock.calls.length
    const requestCount = requested.mock.calls.length
    await step(1600)
    expect(events).toHaveBeenCalledTimes(eventCount)
    expect(requested).toHaveBeenCalledTimes(requestCount)
  }
})

test("unmount before the queued init event suppresses that callback", async () => {
  const initialized = jest.fn()
  const { unmount } = render(<FlipBook width={440} height={540} onInit={initialized}>{pages()}</FlipBook>)
  unmount()
  await act(async () => {})
  expect(initialized).not.toHaveBeenCalled()
  expect(frames.size).toBe(0)
})

test("direct core Clock confirms destroy cancellation, DOM restoration and false settlement", async () => {
  const host = document.createElement("div")
  host.innerHTML = "<article>1</article><article>2</article><article>3</article><article>4</article>"
  document.body.append(host)
  const originalPages = [...host.children]
  const clock: Clock = {
    now: () => now,
    requestFrame: (callback) => { const id = nextId++; frames.set(id, callback); return id },
    cancelFrame: (id) => { frames.delete(id) },
  }
  const instance = createBook(host, { width: 440, height: 540, layout: "spread", clock })
  const events = jest.fn()
  instance.on("flip", events)
  const result = instance.flipNext()
  expect(frames.size).toBe(1)
  instance.destroy()
  await expect(result).resolves.toBe(false)
  expect(frames.size).toBe(0)
  expect([...host.children]).toEqual(originalPages)
  expect(host.textContent).toBe("1234")
  originalPages.forEach((page) => {
    expect(page.className).toBe("")
    expect((page as HTMLElement).style.cssText).toBe("")
  })
  await step(2000)
  expect(events).not.toHaveBeenCalled()
  host.remove()
})

test("prototype turns repeatedly, retains settings spread, and provides a working remount control", async () => {
  const { container, unmount } = render(<StrictMode><OpenPageFlipPrototype /></StrictMode>)
  await act(async () => {})
  for (let i = 0; i < 3; i++) {
    fireEvent.click(screen.getByRole("button", { name: "Next spread" }))
    fireEvent.click(screen.getByRole("button", { name: "Next spread" }))
    await step(1600)
    expect(screen.getByRole("status")).toHaveTextContent("Student 2 · Pages 3–4 of 4")
    expect(frames.size).toBe(0)
    fireEvent.click(screen.getByRole("button", { name: "Previous spread" }))
    await step(1600)
    expect(screen.getByRole("status")).toHaveTextContent("Student 1 · Pages 1–2 of 4")
  }
  fireEvent.click(screen.getByRole("button", { name: "Next spread" }))
  await step(1600)
  fireEvent.change(screen.getByLabelText("Duration"), { target: { value: "1400" } })
  await act(async () => {})
  expect(screen.getByRole("status")).toHaveTextContent("Student 2 · Pages 3–4 of 4")
  expect(observers.size).toBe(1)
  fireEvent.click(screen.getByRole("button", { name: "Previous spread" }))
  await step(200)
  fireEvent.click(screen.getByRole("button", { name: "Unmount book" }))
  expect(container.querySelector(".opf-book")).toBeNull()
  expect(frames.size).toBe(0)
  fireEvent.click(screen.getByRole("button", { name: "Remount book" }))
  await act(async () => {})
  expect(container.querySelectorAll(".opf-book")).toHaveLength(1)
  expect(screen.getByRole("status")).toHaveTextContent("Student 1 · Pages 1–2 of 4")
  unmount()
  expect(frames.size).toBe(0)
})

test("reduced motion lands immediately without scheduling animation frames", async () => {
  window.matchMedia = jest.fn().mockReturnValue({ matches: true })
  const { unmount } = render(<OpenPageFlipPrototype />)
  await act(async () => {})
  fireEvent.click(screen.getByRole("button", { name: "Next spread" }))
  expect(screen.getByRole("status")).toHaveTextContent("Student 2 · Pages 3–4 of 4")
  expect(frames.size).toBe(0)
  unmount()
})
