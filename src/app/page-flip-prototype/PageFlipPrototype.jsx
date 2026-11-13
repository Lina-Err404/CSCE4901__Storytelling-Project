"use client"

import { useEffect, useRef, useState } from "react"
import Link from "next/link"
import "./prototype.css"

const students = [
  { name: "Student 1", title: "The lantern in the woods", text: "Mia found a tiny lantern beneath the oldest tree. It glowed whenever she told the truth. With her friend Leo beside her, she followed its light toward a hidden village.", drawing: "A woodland clearing, an old tree, and a little golden lantern." },
  { name: "Student 2", title: "A village above the clouds", text: "Above the clouds, Noah discovered a village built on floating islands. The bridges had vanished overnight. He and his new friends gathered ribbons, kites, and a little courage to bring everyone together again.", drawing: "Floating islands, bright kites, and bridges made of ribbons." },
]

export default function PageFlipPrototype() {
  const mountRef = useRef(null)
  const sourceRef = useRef(null)
  const engineRef = useRef(null)
  const lockRef = useRef(false)
  const [ready, setReady] = useState(false)
  const [busy, setBusy] = useState(false)
  const [spread, setSpread] = useState(0)
  const [error, setError] = useState("")
  const [duration, setDuration] = useState(1000)
  const [shadow, setShadow] = useState(0.35)

  useEffect(() => {
    let disposed = false
    let instance
    let observer
    let resizeFrame = 0
    const host = document.createElement("div")
    host.className = "prototype-engine"
    mountRef.current.append(host)

    // The library moves page nodes and destroy() removes its root. React owns
    // only the mount and source; each effect owns a fresh disposable clone.
    async function initialize() {
      try {
        const { PageFlip } = await import("page-flip")
        if (disposed) return
        const pages = Array.from(sourceRef.current.children, (page) => page.cloneNode(true))
        host.append(...pages)
        instance = new PageFlip(host, {
          width: 440, height: 540, size: "stretch",
          minWidth: 140, maxWidth: 540, minHeight: 172, maxHeight: 663,
          startPage: 0, showCover: false, usePortrait: false, autoSize: false,
          flippingTime: 1000, drawShadow: true, maxShadowOpacity: 0.35,
          useMouseEvents: false, showPageCorners: false,
          mobileScrollSupport: false,
        })
        const sync = () => {
          if (disposed) return
          setSpread(Math.floor(instance.getCurrentPageIndex() / 2))
        }
        instance.on("init", () => { if (!disposed) { sync(); setReady(true) } })
        instance.on("flip", sync)
        instance.on("changeState", ({ data }) => {
          if (disposed) return
          lockRef.current = data !== "read"
          setBusy(lockRef.current)
          if (data === "read") sync()
        })
        instance.loadFromHTML(pages)
        engineRef.current = instance
        observer = new ResizeObserver(() => {
          cancelAnimationFrame(resizeFrame)
          resizeFrame = requestAnimationFrame(() => {
            if (!disposed && instance.getState() === "read") instance.update()
          })
        })
        observer.observe(mountRef.current)
      } catch (cause) {
        if (!disposed) setError(`Could not initialize the prototype: ${cause.message}`)
      }
    }
    initialize()
    return () => {
      disposed = true
      observer?.disconnect()
      cancelAnimationFrame(resizeFrame)
      engineRef.current = null
      instance?.destroy()
      host.remove()
    }
  }, [])

  function turn(direction) {
    const engine = engineRef.current
    if (!engine || lockRef.current || engine.getState() !== "read") return
    const current = Math.floor(engine.getCurrentPageIndex() / 2)
    if ((direction === "next" && current === 1) || (direction === "prev" && current === 0)) return
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      engine.turnToPage(direction === "next" ? 2 : 0)
      return
    }
    lockRef.current = true
    setBusy(true)
    if (direction === "next") engine.flipNext("bottom")
    else engine.flipPrev("bottom")
  }

  return (
    <main className="flip-prototype">
      <header className="prototype-header">
        <div><p className="prototype-eyebrow">R39 · Phase 4C · Isolated experiment</p><h1>A different way to turn the page</h1></div>
        <Link href="/creating-stories">Back to existing book</Link>
      </header>
      <section className="prototype-workspace" aria-label="Page-flip experiment">
        <p className="prototype-intro">Two students. Two stories. One open book.</p>
        <div ref={mountRef} className="prototype-stage" aria-label="Two-page storybook spread" />
        {!ready && !error && <p role="status">Opening the prototype…</p>}
        {error && <p role="alert">{error}</p>}
        <nav className="prototype-controls" aria-label="Book navigation">
          <button onClick={() => turn("prev")} disabled={!ready || busy || spread === 0}>Previous spread</button>
          <span role="status" aria-live="polite">{busy ? "Turning page…" : `${students[spread].name} · Pages ${spread * 2 + 1}–${spread * 2 + 2} of 4`}</span>
          <button onClick={() => turn("next")} disabled={!ready || busy || spread === 1}>Next spread</button>
        </nav>
        <fieldset className="prototype-settings" disabled={!ready || busy}>
          <legend>Animation comparison</legend>
          <label>Duration
            <select value={duration} onChange={(event) => {
              const value = Number(event.target.value)
              setDuration(value)
              engineRef.current.getSettings().flippingTime = value
            }}>
              <option value={700}>700 ms</option><option value={1000}>1000 ms</option><option value={1400}>1400 ms</option>
            </select>
          </label>
          <label>Shadow
            <select value={shadow} onChange={(event) => {
              const value = Number(event.target.value)
              setShadow(value)
              engineRef.current.getSettings().maxShadowOpacity = value
            }}>
              <option value={0.2}>Light</option><option value={0.35}>Balanced</option><option value={0.5}>Defined</option>
            </select>
          </label>
        </fieldset>
        <p className="prototype-note">Sample content only. Nothing here edits or saves a student’s story. Use the buttons to compare repeated turns.</p>
      </section>
      <div ref={sourceRef} hidden aria-hidden="true">
        {students.flatMap((student, index) => [
          <article className="prototype-page drawing-page" data-density="soft" key={`${student.name}-drawing`}>
            <div className="prototype-paper"><header>{student.name} · Drawing</header><div className="prototype-drawing"><span>Imagine the scene</span><p>{student.drawing}</p></div><footer>{index * 2 + 1}</footer></div>
          </article>,
          <article className="prototype-page writing-page" data-density="soft" key={`${student.name}-writing`}>
            <div className="prototype-paper"><header>{student.name} · Writing</header><div className="prototype-story"><h2>{student.title}</h2><p>{student.text}</p></div><footer>{index * 2 + 2}</footer></div>
          </article>,
        ])}
      </div>
    </main>
  )
}
