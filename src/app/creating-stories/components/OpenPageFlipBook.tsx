"use client"

import { useCallback, useLayoutEffect, useRef, useState } from "react"
import { flushSync } from "react-dom"
import { FlipBook, Page, type Book } from "@openpageflip/react"
import "@openpageflip/core/styles.css"
import "./openPageFlipBook.css"

type StudentPage = { id: string; label: string; text: string; mine: boolean; drawing?: unknown }
type Props = {
  pages: StudentPage[]
  index: number
  myIndex: number
  mode?: "writing" | "drawing"
  onTurn: (direction: "next" | "prev") => void
  onJump: () => void
  onChangeText: (text: string) => void
  onSave: () => void
  saved: boolean
  error: boolean
}

const textStyle = { fontFamily: "Georgia, 'Times New Roman', serif", fontSize: "clamp(13px, calc(var(--ph) * 0.045), 24px)", lineHeight: 1.65, padding: "4.5% 5%" }
const smallStyle = { fontSize: "clamp(11px, calc(var(--ph) * 0.03), 15px)" }
const pill = "min-h-8 rounded-xl border border-[#a4b5ce] bg-[#f6f3ec] px-3 py-1.5 text-xs font-medium text-[#29436c] transition-colors hover:border-[#708cb4] hover:bg-[#fffdf7] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#294889] active:bg-[#e9e3d7] disabled:pointer-events-none disabled:opacity-45 motion-reduce:transition-none @min-[640px]:min-h-9 @min-[640px]:px-4 @min-[640px]:text-sm"

// Match the legacy presentation without changing the fallback component.
function Paper({ page, number, drawing, active, editable, onChangeText, onSave }: {
  page: StudentPage; number: number; drawing: boolean; active: boolean; editable: boolean
  onChangeText: Props["onChangeText"]; onSave: Props["onSave"]
}) {
  return (
    <div className={`production-flip-paper ${drawing ? "production-flip-drawing" : "production-flip-writing"}`}
      inert={!active} aria-hidden={!active} data-student={page.id} data-page-kind={drawing ? "drawing" : "writing"}>
      <span className="absolute font-medium tracking-wide text-[#68738a]" style={{ top: "5.5%", left: drawing ? "6%" : "8%", right: drawing ? "8%" : "6%", ...smallStyle }}>
        {drawing ? (page.mine ? "Your drawing" : `${page.id}’s drawing`) : page.label}
      </span>
      {drawing ? (
        <div className="absolute rounded-2xl bg-[#f5f2e9] shadow-[inset_0_1px_3px_rgba(117,105,78,0.04)]"
          style={{ inset: "13% 8% 10% 6%", border: page.mine ? "1px dashed #c9c4b6" : "1px solid #e5e0d3" }} />
      ) : page.mine ? (
        <div className="absolute overflow-hidden rounded-2xl border border-dashed border-[#c9c4b6] bg-white/20 transition-colors focus-within:border-solid focus-within:border-[#5877a5] focus-within:bg-white/40 focus-within:ring-2 focus-within:ring-[#5877a5]/15 motion-reduce:transition-none" style={{ inset: "13% 6% 10% 8%" }}>
          <textarea value={page.text} readOnly={!editable} inert={!editable} tabIndex={editable ? 0 : -1}
            onChange={(event) => { if (editable) onChangeText(event.target.value) }}
            onKeyDown={(event) => {
              if (editable && !event.nativeEvent.isComposing && (event.metaKey || event.ctrlKey) && event.key === "Enter") {
                event.preventDefault()
                onSave()
              }
            }}
            placeholder="Write your story here…" aria-label={page.label}
            className="block h-full w-full resize-none bg-transparent text-[#30364a] outline-none placeholder:italic placeholder:text-[#7c8492]"
            style={textStyle} />
        </div>
      ) : (
        <div className="absolute overflow-hidden whitespace-pre-wrap rounded-2xl text-[#30364a]" style={{ inset: "13% 6% 10% 8%", border: "1px solid transparent", ...textStyle }}>
          {page.text || <span className="italic text-[#7c8492]">Nothing written yet</span>}
        </div>
      )}
      <span className="absolute left-0 right-0 text-center tabular-nums text-[#858478]" style={{ bottom: "3.5%", ...smallStyle }}>{number}</span>
    </div>
  )
}

export default function OpenPageFlipBook(props: Props) {
  const { pages, index, myIndex, mode = "writing", onJump, onChangeText, onSave, saved, error } = props
  const stage = useRef<HTMLDivElement>(null)
  const book = useRef<Book>(null)
  const latest = useRef(props)
  const lifecycle = useRef({ mounted: false, generation: 0 })
  const locked = useRef(false)
  const [ready, setReady] = useState(false)
  const [busy, setBusy] = useState(false)
  // This is the accepted DOM page order, not a second editor/student-index state.
  const [layout, setLayout] = useState({ width: 0, height: 0, ids: pages.map((page) => page.id) })
  // Only removed records need a temporary visual snapshot until an in-flight turn finishes.
  const [turnSnapshot, setTurnSnapshot] = useState(pages)
  const idsKey = JSON.stringify(pages.map((page) => page.id))

  useLayoutEffect(() => { latest.current = props })
  useLayoutEffect(() => {
    const lifetime = lifecycle.current
    lifetime.mounted = true
    return () => {
      lifetime.mounted = false
      lifetime.generation++
      locked.current = false
    }
  }, [])

  const measure = useCallback(() => {
    if (!stage.current || locked.current) return
    const rect = stage.current.getBoundingClientRect()
    const width = (rect.width || stage.current.clientWidth) / 2
    const height = rect.height || stage.current.clientHeight
    if (width <= 0 || height <= 0) return
    const ids = latest.current.pages.map((page) => page.id)
    setLayout((previous) => previous.width === width && previous.height === height && JSON.stringify(previous.ids) === JSON.stringify(ids)
      ? previous : { width, height, ids })
  }, [])

  useLayoutEffect(() => {
    const observer = new ResizeObserver(measure)
    if (stage.current) observer.observe(stage.current)
    measure()
    return () => observer.disconnect()
  }, [measure])
  // Reconcile deferred resizing/student-list changes only after the turn has settled.
  useLayoutEffect(measure, [measure, idsKey, busy])

  useLayoutEffect(() => {
    if (ready && !locked.current && book.current && layout.ids.length) {
      const destination = Math.max(0, Math.min(index, layout.ids.length - 1)) * 2
      if (book.current.page !== destination) book.current.turnTo(destination)
    }
  }, [index, ready, layout])

  async function turn(direction: "next" | "prev") {
    const instance = book.current
    if (!ready || !instance || locked.current || instance.state !== "read") return
    const from = latest.current.index
    const target = from + (direction === "next" ? 1 : -1)
    if (target < 0 || target >= layout.ids.length) return
    locked.current = true
    setTurnSnapshot(latest.current.pages)
    setBusy(true)
    const session = lifecycle.current.generation
    try {
      const completed = await (direction === "next" ? instance.flipNext("bottom") : instance.flipPrev("bottom"))
      if (!lifecycle.current.mounted || session !== lifecycle.current.generation) return
      const current = latest.current
      const sameOrder = JSON.stringify(current.pages.map((page) => page.id)) === JSON.stringify(layout.ids)
      if (completed && current.index === from && sameOrder && instance.page === target * 2) {
        // Commit once, after landing. SetItem still owns auto-save and the student index.
        flushSync(() => { current.onTurn(direction) })
      } else {
        instance.turnTo(Math.max(0, Math.min(current.index, layout.ids.length - 1)) * 2)
      }
    } finally {
      if (lifecycle.current.mounted && session === lifecycle.current.generation) {
        locked.current = false
        setBusy(false)
      }
    }
  }

  const records = new Map(pages.map((page) => [page.id, page]))
  const renderedPages = layout.ids.map((id) => records.get(id) ?? turnSnapshot.find((page) => page.id === id))
  const editable = ready && !busy && index === myIndex && mode === "writing"

  return (
    <div className="production-flip-viewport relative flex min-h-0 w-full flex-1 flex-col justify-center overflow-hidden" aria-busy={busy}>
      <div className="production-flip-pan" data-mode={mode}>
        <div ref={stage} className="production-flip-stage">
          <div className="production-flip-underlay production-flip-underlay-left" />
          <div className="production-flip-underlay production-flip-underlay-right" />
          {layout.width > 0 && layout.ids.length > 0 && (
            <FlipBook ref={book} className="production-flip-engine" width={layout.width} height={layout.height}
              size="fixed" layout="spread" binding="left" cover={false} autoSize={false}
              startPage={Math.max(0, Math.min(index, layout.ids.length - 1)) * 2}
              flipDuration={1000} shadows shadowOpacity={0.35}
              click="off" drag={false} swipe={false} hover={false}
              onInit={() => { lifecycle.current.generation++; setReady(true) }}>
              {renderedPages.flatMap((page, studentIndex) => page ? [
                <Page key={`${page.id}:drawing`} density="soft">
                  <Paper page={page} number={studentIndex * 2 + 1} drawing active={!busy && studentIndex === index} editable={false} onChangeText={onChangeText} onSave={onSave} />
                </Page>,
                <Page key={`${page.id}:writing`} density="soft">
                  <Paper page={page} number={studentIndex * 2 + 2} drawing={false} active={!busy && studentIndex === index} editable={editable && studentIndex === myIndex && page.mine} onChangeText={onChangeText} onSave={onSave} />
                </Page>,
              ] : [])}
            </FlipBook>
          )}
          <div className="production-flip-spine" />
        </div>
      </div>
      <div className="relative mt-3 flex shrink-0 flex-col items-center justify-center gap-1 px-2 whitespace-nowrap @min-[640px]:flex-row @min-[640px]:gap-3">
        <div className="flex items-center justify-center gap-2">
          <button type="button" className={pill} onClick={() => void turn("prev")} disabled={!ready || busy || index <= 0}>Previous page</button>
          <button type="button" className={pill} onClick={() => void turn("next")} disabled={!ready || busy || index >= pages.length - 1}>Next page</button>
          <button type="button" onClick={onSave} disabled={saved} className="min-h-8 rounded-xl border border-[#294889] bg-[#294889] px-4 py-1.5 text-xs font-medium text-white transition-colors hover:bg-[#203c74] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#294889] active:bg-[#192f5c] disabled:pointer-events-none disabled:border-[#788ba8] disabled:bg-[#788ba8] motion-reduce:transition-none @min-[640px]:min-h-9 @min-[640px]:px-5 @min-[640px]:text-sm">Save</button>
        </div>
        <div className="flex min-h-6 items-center justify-center gap-3 text-xs @min-[640px]:text-sm">
          {index !== myIndex && <button type="button" className="rounded-lg border border-[#a4b5ce] bg-[#f6f3ec] px-2 py-0.5 text-xs font-medium text-[#29436c] transition-colors hover:border-[#708cb4] hover:bg-[#fffdf7] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#294889] active:bg-[#e9e3d7] disabled:opacity-45 motion-reduce:transition-none" disabled={!ready || busy} onClick={() => {
            if (locked.current || !book.current) return
            book.current.turnTo(myIndex * 2)
            onJump()
          }}>Back to my page</button>}
          <span role="status" className={error ? "text-red-600" : "text-[#465c7b]"}>{error ? "Couldn’t save. Try again." : saved ? "Saved" : "Not saved yet"}</span>
        </div>
      </div>
    </div>
  )
}
