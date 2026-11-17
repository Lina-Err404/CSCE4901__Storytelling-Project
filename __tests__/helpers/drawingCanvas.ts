// jsdom has no drawing backend. Observe commands; browser checks cover real pixels.
export function makeDrawingContext() {
  return {
    clearRect: jest.fn(), save: jest.fn(), restore: jest.fn(), setTransform: jest.fn(),
    beginPath: jest.fn(), arc: jest.fn(), fill: jest.fn(), moveTo: jest.fn(),
    quadraticCurveTo: jest.fn(), lineTo: jest.fn(), stroke: jest.fn(),
    lineWidth: 0, lineCap: "butt", lineJoin: "miter", strokeStyle: "", fillStyle: "", globalAlpha: 1,
  }
}

export function installDrawingCanvas() {
  let rect = { left: 100, top: 50, width: 400, height: 200 }
  const contexts = new WeakMap<HTMLCanvasElement, ReturnType<typeof makeDrawingContext>>()
  const frames = new Map<number, FrameRequestCallback>()
  let nextFrame = 1
  const observers: { callback: () => void; disconnect: jest.Mock }[] = []
  const originalObserver = global.ResizeObserver
  const originalPointer = window.PointerEvent
  const originalRatio = window.devicePixelRatio
  class TestPointerEvent extends MouseEvent {
    pointerId: number; pointerType: string; isPrimary: boolean
    constructor(type: string, init: PointerEventInit = {}) {
      super(type, init)
      this.pointerId = init.pointerId ?? 1
      this.pointerType = init.pointerType ?? "mouse"
      this.isPrimary = init.isPrimary ?? true
    }
  }
  window.PointerEvent = TestPointerEvent as unknown as typeof PointerEvent
  global.ResizeObserver = class {
    disconnect = jest.fn()
    observe = jest.fn()
    unobserve = jest.fn()
    constructor(callback: () => void) { observers.push({ callback, disconnect: this.disconnect }) }
  } as unknown as typeof ResizeObserver
  jest.spyOn(HTMLCanvasElement.prototype, "getBoundingClientRect").mockImplementation(() => ({
    ...rect, x: rect.left, y: rect.top, right: rect.left + rect.width, bottom: rect.top + rect.height, toJSON() {},
  }))
  function context(canvas: HTMLCanvasElement) {
    if (!contexts.has(canvas)) contexts.set(canvas, makeDrawingContext())
    return contexts.get(canvas)!
  }
  jest.spyOn(HTMLCanvasElement.prototype, "getContext").mockImplementation(function (this: HTMLCanvasElement) {
    return context(this) as unknown as CanvasRenderingContext2D
  })
  const captured = new WeakMap<HTMLCanvasElement, number>()
  // These APIs are missing in jsdom, so define and remove them within each test.
  const captureDescriptors = ["setPointerCapture", "hasPointerCapture", "releasePointerCapture"].map((name) => Object.getOwnPropertyDescriptor(HTMLCanvasElement.prototype, name))
  Object.defineProperties(HTMLCanvasElement.prototype, {
    setPointerCapture: { configurable: true, value: jest.fn(function (this: HTMLCanvasElement, id: number) { captured.set(this, id) }) },
    hasPointerCapture: { configurable: true, value: function (this: HTMLCanvasElement, id: number) { return captured.get(this) === id } },
    releasePointerCapture: { configurable: true, value: jest.fn(function (this: HTMLCanvasElement, id: number) {
      captured.delete(this)
      this.dispatchEvent(new PointerEvent("lostpointercapture", { pointerId: id }))
    }) },
  })
  jest.spyOn(window, "requestAnimationFrame").mockImplementation((callback) => { const id = nextFrame++; frames.set(id, callback); return id })
  jest.spyOn(window, "cancelAnimationFrame").mockImplementation((id) => { frames.delete(id) })
  return {
    context, observers, frames,
    flushFrame() { const queued = [...frames.values()]; frames.clear(); queued.forEach((callback) => callback(0)) },
    resize(next: typeof rect, ratio = 1) {
      rect = next
      Object.defineProperty(window, "devicePixelRatio", { configurable: true, value: ratio })
      observers.filter(({ disconnect }) => !disconnect.mock.calls.length).forEach(({ callback }) => callback())
    },
    restore() {
      jest.restoreAllMocks()
      global.ResizeObserver = originalObserver
      window.PointerEvent = originalPointer
      Object.defineProperty(window, "devicePixelRatio", { configurable: true, value: originalRatio })
      ;["setPointerCapture", "hasPointerCapture", "releasePointerCapture"].forEach((name, index) => {
        const descriptor = captureDescriptors[index]
        if (descriptor) Object.defineProperty(HTMLCanvasElement.prototype, name, descriptor)
        else Reflect.deleteProperty(HTMLCanvasElement.prototype, name)
      })
    },
  }
}
