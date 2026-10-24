// bookPage.test.jsx
import { render, screen, fireEvent, act } from "@testing-library/react"
import "@testing-library/jest-dom"
import BookPage from "../components/bookPage"

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
})