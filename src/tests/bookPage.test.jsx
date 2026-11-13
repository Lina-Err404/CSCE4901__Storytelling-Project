// bookPage.test.jsx
import { render, screen, fireEvent, act, within } from "@testing-library/react"
import { useLayoutEffect, useRef, useState } from "react"
import "@testing-library/jest-dom"
import BookPage from "../app/creating-stories/components/bookPage"

const pages = [
  { id: "amy", label: "amy’s story", text: "amy text", mine: false, drawing: null },
  { id: "ben", label: "Your story", text: "ben text", mine: true, drawing: null },
  { id: "cal", label: "cal’s story", text: "", mine: false, drawing: null },
]

const setup = (overrides = {}) => {
  const props = {
    pages,
    index: 1,
    myIndex: 1,
    mode: "writing",
    onTurn: jest.fn(),
    onJump: jest.fn(),
    onChangeText: jest.fn(),
    onSave: jest.fn(),
    saved: true,
    error: false,
    ...overrides,
  }
  const utils = render(<BookPage {...props} />)
  return { ...utils, props }
}

const mockReducedMotion = (matches) => {
  window.matchMedia = jest.fn().mockImplementation((query) => ({
    matches,
    media: query,
    addEventListener: jest.fn(),
    removeEventListener: jest.fn(),
  }))
}

beforeEach(() => {
  jest.useFakeTimers()
  mockReducedMotion(true) // 1ms animation by default, keeps tests fast
})

afterEach(() => {
  jest.useRealTimers()
})

describe("rendering", () => {
  test("owned page in writing mode is an editable textarea", () => {
    setup()
    expect(screen.getByRole("textbox")).toHaveValue("ben text")
    expect(screen.getByText("Your story")).toBeInTheDocument()
    expect(screen.getByText("Your drawing")).toBeInTheDocument()
  })

  test("someone else's page is read-only", () => {
    setup({ index: 0 })
    expect(screen.queryByRole("textbox")).not.toBeInTheDocument()
    expect(screen.getByText("amy text")).toBeInTheDocument()
    expect(screen.getByText("amy’s story")).toBeInTheDocument()
    expect(screen.getByText("amy’s drawing")).toBeInTheDocument()
  })

  test("empty read-only page shows a placeholder", () => {
    setup({ index: 2 })
    expect(screen.getByText("Nothing written yet")).toBeInTheDocument()
  })

  test("my own page is not editable in drawing mode", () => {
    setup({ mode: "drawing" })
    expect(screen.queryByRole("textbox")).not.toBeInTheDocument()
    expect(screen.getByText("ben text")).toBeInTheDocument()
  })

  test("page numbers follow the index (2 pages per student)", () => {
    setup({ index: 1 })
    expect(screen.getByText("3")).toBeInTheDocument() // drawing page
    expect(screen.getByText("4")).toBeInTheDocument() // writing page
  })
})

describe("editing", () => {
  test("typing calls onChangeText with the new value", () => {
    const { props } = setup()
    fireEvent.change(screen.getByRole("textbox"), { target: { value: "hello" } })
    expect(props.onChangeText).toHaveBeenCalledWith("hello")
  })

  test.each([
    ["ctrlKey", { ctrlKey: true }],
    ["metaKey", { metaKey: true }],
  ])("%s + Enter saves", (_, mod) => {
    const { props } = setup()
    fireEvent.keyDown(screen.getByRole("textbox"), { key: "Enter", ...mod })
    expect(props.onSave).toHaveBeenCalledTimes(1)
  })

  test("plain Enter does not save", () => {
    const { props } = setup()
    fireEvent.keyDown(screen.getByRole("textbox"), { key: "Enter" })
    expect(props.onSave).not.toHaveBeenCalled()
  })
})

describe("controls and status", () => {
  test("Previous is disabled on the first page, Next on the last", () => {
    const { rerender, props } = setup({ index: 0, myIndex: 0 })
    expect(screen.getByRole("button", { name: /previous page/i })).toBeDisabled()
    expect(screen.getByRole("button", { name: /next page/i })).toBeEnabled()

    rerender(<BookPage {...props} index={2} myIndex={2} />)
    expect(screen.getByRole("button", { name: /previous page/i })).toBeEnabled()
    expect(screen.getByRole("button", { name: /next page/i })).toBeDisabled()
  })

  test("'Back to my page' only shows away from my page and calls onJump", () => {
    const { props, rerender } = setup()
    expect(screen.queryByRole("button", { name: /back to my page/i })).not.toBeInTheDocument()

    rerender(<BookPage {...props} index={0} />)
    fireEvent.click(screen.getByRole("button", { name: /back to my page/i }))
    expect(props.onJump).toHaveBeenCalledTimes(1)
  })

  test("Save is disabled when saved, enabled and clickable otherwise", () => {
    const { props, rerender } = setup({ saved: true })
    expect(screen.getByRole("button", { name: "Save" })).toBeDisabled()

    rerender(<BookPage {...props} saved={false} />)
    fireEvent.click(screen.getByRole("button", { name: "Save" }))
    expect(props.onSave).toHaveBeenCalledTimes(1)
  })

  test("status text reflects saved / unsaved / error", () => {
    const { props, rerender } = setup({ saved: true })
    expect(screen.getByRole("status")).toHaveTextContent("Saved")

    rerender(<BookPage {...props} saved={false} />)
    expect(screen.getByRole("status")).toHaveTextContent("Not saved yet")

    rerender(<BookPage {...props} saved={false} error />)
    expect(screen.getByRole("status")).toHaveTextContent(/couldn’t save/i)
    expect(screen.getByRole("status")).toHaveClass("text-red-600")
  })
})

describe("page turning", () => {
  const next = () => fireEvent.click(screen.getByRole("button", { name: /next page/i }))
  const prev = () => fireEvent.click(screen.getByRole("button", { name: /previous page/i }))

  test("calls onTurn only after the animation finishes", () => {
    const { props } = setup()
    next()
    expect(props.onTurn).not.toHaveBeenCalled()

    act(() => { jest.advanceTimersByTime(100) })
    expect(props.onTurn).toHaveBeenCalledTimes(1)
    expect(props.onTurn).toHaveBeenCalledWith("next")
  })

  test("previous reports 'prev'", () => {
    const { props } = setup()
    prev()
    act(() => { jest.advanceTimersByTime(100) })
    expect(props.onTurn).toHaveBeenCalledWith("prev")
  })

  test("the textarea is not editable while a page is turning", () => {
    setup()
    expect(screen.getByRole("textbox")).toBeInTheDocument()
    next()
    expect(screen.queryByRole("textbox")).not.toBeInTheDocument()
  })

  test("clicks during a turn are ignored", () => {
    const { props } = setup()
    next()
    next()
    prev()
    act(() => { jest.advanceTimersByTime(100) })
    expect(props.onTurn).toHaveBeenCalledTimes(1)
  })

  test("full-length animation (no reduced motion) takes about 1000ms", () => {
    mockReducedMotion(false)
    const { props } = setup()
    next()

    act(() => { jest.advanceTimersByTime(900) })
    expect(props.onTurn).not.toHaveBeenCalled()

    act(() => { jest.advanceTimersByTime(200) })
    expect(props.onTurn).toHaveBeenCalledTimes(1)
  })

  test("unmounting mid-turn cancels the animation", () => {
    mockReducedMotion(false)
    const { props, unmount } = setup()
    next()
    act(() => { jest.advanceTimersByTime(300) })
    unmount()
    act(() => { jest.advanceTimersByTime(2000) })
    expect(props.onTurn).not.toHaveBeenCalled()
  })

  test("controls work again after a turn completes", () => {
    const { props } = setup()
    next()
    act(() => { jest.advanceTimersByTime(100) })
    next()
    act(() => { jest.advanceTimersByTime(100) })
    expect(props.onTurn).toHaveBeenCalledTimes(2)
  })

  test("the animated sheet has one read-only copy of each face with the correct numbers", () => {
    const { container } = setup()
    next()
    const leaf = container.querySelector("[data-turning-page]")
    expect(leaf).toHaveAttribute("aria-hidden", "true")
    expect(leaf.querySelectorAll("textarea, input, button")).toHaveLength(0)
    expect(within(leaf).getAllByText("ben text")).toHaveLength(1)
    expect(within(leaf).getAllByText("cal’s drawing")).toHaveLength(1)
    expect(within(leaf).getByText("4")).toBeInTheDocument()
    expect(within(leaf).getByText("5")).toBeInTheDocument()
  })

  test.each([
    ["next", "rotateY(-180deg)"],
    ["prev", "rotateY(0deg)"],
  ])("%s reaches an exact unlit endpoint before its cover is removed", (direction, transform) => {
    let leaf
    const onTurn = jest.fn(() => {
      expect(leaf.isConnected).toBe(true)
      expect(leaf.style.transform).toBe(transform)
      expect(leaf.style.getPropertyValue("--leaf-shade")).toBe("0")
      expect(leaf.style.getPropertyValue("--leaf-glow")).toBe("0")
    })
    const { container } = setup({ onTurn })
    if (direction === "next") next()
    else prev()
    leaf = container.querySelector("[data-turning-page]")
    act(() => { jest.advanceTimersByTime(100) })
    expect(onTurn).toHaveBeenCalledTimes(1)
    expect(onTurn).toHaveBeenCalledWith(direction)
    expect(leaf.isConnected).toBe(false)
  })

  test("landing commits the destination and removes the animated cover together", () => {
    mockReducedMotion(false)
    const commits = []
    const onTurn = jest.fn()
    function Book() {
      const [index, setIndex] = useState(1)
      const root = useRef(null)
      useLayoutEffect(() => {
        commits.push({ index, covered: !!root.current.querySelector("[data-turning-page]") })
      })
      return <div ref={root}><BookPage pages={pages} index={index} myIndex={1} saved onTurn={(direction) => {
        onTurn(direction)
        setIndex((current) => current + (direction === "next" ? 1 : -1))
      }} /></div>
    }
    const { container } = render(<Book />)
    next()
    const leaf = container.querySelector("[data-turning-page]")
    act(() => { jest.advanceTimersByTime(900) })
    expect(leaf.isConnected).toBe(true)
    expect(onTurn).not.toHaveBeenCalled()
    act(() => { jest.advanceTimersByTime(200) })
    expect(onTurn).toHaveBeenCalledTimes(1)
    expect(leaf.isConnected).toBe(false)
    expect(commits.at(-1)).toEqual({ index: 2, covered: false })
    expect(commits).not.toContainEqual({ index: 2, covered: true })
    expect(screen.getByText("cal’s story")).toBeInTheDocument()
    expect(screen.getByText("5")).toBeInTheDocument()
    expect(screen.getByText("6")).toBeInTheDocument()
  })

  test("consecutive turns retain page order and ignore repeated clicks until landing", () => {
    const onTurn = jest.fn()
    function Book() {
      const [index, setIndex] = useState(0)
      return <BookPage pages={pages} index={index} myIndex={1} saved onTurn={(direction) => {
        onTurn(direction)
        setIndex((current) => current + (direction === "next" ? 1 : -1))
      }} />
    }
    render(<Book />)
    expect(screen.getByRole("button", { name: /previous page/i })).toBeDisabled()
    next()
    next()
    prev()
    act(() => { jest.advanceTimersByTime(100) })
    expect(onTurn).toHaveBeenCalledTimes(1)
    expect(screen.getByRole("textbox")).toHaveValue("ben text")
    next()
    act(() => { jest.advanceTimersByTime(100) })
    expect(screen.getByRole("button", { name: /next page/i })).toBeDisabled()
    prev()
    act(() => { jest.advanceTimersByTime(100) })
    expect(screen.getByRole("textbox")).toHaveValue("ben text")
    prev()
    act(() => { jest.advanceTimersByTime(100) })
    expect(screen.getByText("amy text")).toBeInTheDocument()
    expect(screen.getByRole("button", { name: /previous page/i })).toBeDisabled()
    expect(onTurn.mock.calls.map(([direction]) => direction)).toEqual(["next", "next", "prev", "prev"])
  })
})
