import React, { StrictMode } from "react"
import { act, fireEvent, render, screen } from "@testing-library/react"
import "@testing-library/jest-dom"
import PageFlipPrototype from "../src/app/page-flip-prototype/PageFlipPrototype"

beforeEach(() => {
  jest.useFakeTimers()
  window.matchMedia = jest.fn().mockReturnValue({ matches: false })
  global.ResizeObserver = class {
    observe() {}
    unobserve() {}
    disconnect() {}
  }
  jest.spyOn(HTMLElement.prototype, "offsetWidth", "get").mockReturnValue(1000)
  jest.spyOn(HTMLElement.prototype, "offsetHeight", "get").mockReturnValue(600)
})

afterEach(() => {
  jest.clearAllTimers() // page-flip 2.0.7 does not cancel its internal render pump.
  jest.useRealTimers()
  jest.restoreAllMocks()
})

async function openBook() {
  const view = render(React.createElement(StrictMode, null, React.createElement(PageFlipPrototype)))
  await act(async () => { await Promise.resolve() })
  act(() => { jest.advanceTimersByTime(50) })
  return view
}

test("Strict Mode leaves one engine, four soft pages, and the correct initial spread", async () => {
  const { container, unmount } = await openBook()
  expect(container.querySelectorAll(".prototype-engine")).toHaveLength(1)
  expect(container.querySelectorAll(".prototype-engine .prototype-page")).toHaveLength(4)
  expect(screen.getByRole("status")).toHaveTextContent("Student 1 · Pages 1–2 of 4")
  expect(screen.getByRole("button", { name: "Previous spread" })).toBeDisabled()
  unmount()
  expect(container.querySelector(".prototype-engine")).toBeNull()
})

test("real core engine supports consecutive forward/back turns and click locking", async () => {
  const { unmount } = await openBook()
  for (let i = 0; i < 3; i++) {
    fireEvent.click(screen.getByRole("button", { name: "Next spread" }))
    fireEvent.click(screen.getByRole("button", { name: "Next spread" }))
    act(() => { jest.advanceTimersByTime(1600) })
    expect(screen.getByRole("status")).toHaveTextContent("Student 2 · Pages 3–4 of 4")
    expect(screen.getByRole("button", { name: "Next spread" })).toBeDisabled()
    fireEvent.click(screen.getByRole("button", { name: "Previous spread" }))
    act(() => { jest.advanceTimersByTime(1600) })
    expect(screen.getByRole("status")).toHaveTextContent("Student 1 · Pages 1–2 of 4")
  }
  unmount()
})

test("reduced motion uses an immediate spread change", async () => {
  const { unmount } = await openBook()
  window.matchMedia = jest.fn().mockReturnValue({ matches: true })
  fireEvent.click(screen.getByRole("button", { name: "Next spread" }))
  expect(screen.getByRole("status")).toHaveTextContent("Student 2 · Pages 3–4 of 4")
  unmount()
})
