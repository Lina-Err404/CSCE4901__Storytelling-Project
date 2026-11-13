"use client"

import { useRef, useState } from "react"
import Link from "next/link"
import { FlipBook, Page, type Book } from "@openpageflip/react"
import "@openpageflip/core/styles.css"
import "./prototype.css"

// Deliberately the same static sample book as /page-flip-prototype.
const students = [
  { name: "Student 1", title: "The lantern in the woods", text: "Mia found a tiny lantern beneath the oldest tree. It glowed whenever she told the truth. With her friend Leo beside her, she followed its light toward a hidden village.", drawing: "A woodland clearing, an old tree, and a little golden lantern." },
  { name: "Student 2", title: "A village above the clouds", text: "Above the clouds, Noah discovered a village built on floating islands. The bridges had vanished overnight. He and his new friends gathered ribbons, kites, and a little courage to bring everyone together again.", drawing: "Floating islands, bright kites, and bridges made of ribbons." },
]

function ComparisonBook() {
  const book = useRef<Book>(null)
  const locked = useRef(false)
  const [ready, setReady] = useState(false)
  const [busy, setBusy] = useState(false)
  const [page, setPage] = useState(0)
  const [duration, setDuration] = useState(1000)
  const [shadow, setShadow] = useState(0.35)
  const spread = Math.floor(page / 2)

  function turn(direction: "next" | "prev") {
    const instance = book.current
    if (!ready || !instance || locked.current || instance.state !== "read") return
    if ((direction === "next" && instance.page >= 2) || (direction === "prev" && instance.page === 0)) return
    locked.current = true
    // The official promise is intentionally not given a state-setting .then():
    // cancellation settles it on unmount. Library events own the live UI state.
    if (direction === "next") void instance.flipNext("bottom")
    else void instance.flipPrev("bottom")
    locked.current = instance.state !== "read"
  }

  return (
    <>
      <div className="open-prototype-stage" aria-label="Two-page storybook spread">
        <FlipBook
          ref={book}
          className="open-prototype-engine"
          width={440} height={540} size="stretch" minWidth={140} maxWidth={540}
          layout="spread" binding="left" cover={false} autoSize={false}
          startPage={page} flipDuration={duration} shadows shadowOpacity={shadow}
          click="off" drag={false} swipe={false} hover={false}
          onInit={({ page: initial }) => { setPage(initial); setReady(true) }}
          onFlip={({ page: current }) => setPage(current)}
          onChangeState={({ state }) => {
            locked.current = state !== "read"
            setBusy(locked.current)
          }}
        >
          {students.flatMap((student, index) => [
            <Page className="open-prototype-page open-drawing-page" density="soft" key={`${student.name}-drawing`}>
              <div className="open-prototype-paper"><header>{student.name} · Drawing</header><div className="open-prototype-drawing"><span>Imagine the scene</span><p>{student.drawing}</p></div><footer>{index * 2 + 1}</footer></div>
            </Page>,
            <Page className="open-prototype-page open-writing-page" density="soft" key={`${student.name}-writing`}>
              <div className="open-prototype-paper"><header>{student.name} · Writing</header><div className="open-prototype-story"><h2>{student.title}</h2><p>{student.text}</p></div><footer>{index * 2 + 2}</footer></div>
            </Page>,
          ])}
        </FlipBook>
      </div>
      <nav className="open-prototype-controls" aria-label="Book navigation">
        <button onClick={() => turn("prev")} disabled={!ready || busy || spread === 0}>Previous spread</button>
        <span role="status" aria-live="polite">{!ready ? "Opening the prototype…" : busy ? "Turning page…" : `${students[spread].name} · Pages ${spread * 2 + 1}–${spread * 2 + 2} of 4`}</span>
        <button onClick={() => turn("next")} disabled={!ready || busy || spread === 1}>Next spread</button>
      </nav>
      <fieldset className="open-prototype-settings" disabled={!ready || busy}>
        <legend>Animation comparison</legend>
        <label>Duration<select value={duration} onChange={(event) => setDuration(Number(event.target.value))}>
          <option value={700}>700 ms</option><option value={1000}>1000 ms</option><option value={1400}>1400 ms</option>
        </select></label>
        <label>Shadow<select value={shadow} onChange={(event) => setShadow(Number(event.target.value))}>
          <option value={0.2}>Light</option><option value={0.35}>Balanced</option><option value={0.5}>Defined</option>
        </select></label>
      </fieldset>
    </>
  )
}

export default function OpenPageFlipPrototype() {
  const [mounted, setMounted] = useState(true)
  return (
    <main className="open-flip-prototype">
      <header className="open-prototype-header">
        <div><p className="open-prototype-eyebrow">R39 · Phase 4D · OpenPageFlip experiment</p><h1>A different way to turn the page</h1></div>
        <Link href="/page-flip-prototype">Compare with StPageFlip</Link>
      </header>
      <section className="open-prototype-workspace" aria-label="OpenPageFlip experiment">
        <p className="open-prototype-intro">Two students. Two stories. One open book.</p>
        {mounted ? <ComparisonBook /> : <div className="open-prototype-stage open-prototype-unmounted" role="status">Book unmounted. Remount to start again.</div>}
        <div className="open-prototype-controls">
          <button onClick={() => setMounted((value) => !value)}>{mounted ? "Unmount book" : "Remount book"}</button>
        </div>
        <p className="open-prototype-note">Sample content only. Nothing here edits or saves a student’s story. Unmount during a turn to test cleanup.</p>
      </section>
    </main>
  )
}
