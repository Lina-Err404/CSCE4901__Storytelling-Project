"use client"
import { useLayoutEffect, useRef, type ComponentType } from "react"
import { PointedBanner } from "./StoryDecorations"
import DrawingWorkspace from "./drawing/DrawingWorkspace"

type Page = { id: string; label: string; text: string; mine: boolean; drawing?: unknown }
type BookProps = {
  pages: Page[]; index: number; myIndex: number; mode?: "writing" | "drawing"
  onTurn: (direction: "prev" | "next") => void; onJump: () => void
  onChangeText: (text: string) => void; onSave: () => void; saved: boolean; error: boolean
}
type Props = BookProps & {
  saveStatus?: string; saving?: boolean; permanent?: boolean
  studentLabel?: string
  DrawingBook: ComponentType<BookProps>
  studentId: string; students: string[]; onSelectStudent?: (id: string) => void
}
export default function StoryWorkspace(props: Props) {
  const { pages, index, myIndex, mode = "writing", onTurn, onJump, onChangeText, onSave, saved, error,
    studentId, students, onSelectStudent } = props
  const page = pages[index]
  const editable = mode === "writing" && index === myIndex && Boolean(page?.mine)
  const turning = useRef(false)
  useLayoutEffect(() => { turning.current = false }, [index, mode])
  function turn(direction: "prev" | "next") {
    if (turning.current || (direction === "prev" ? index <= 0 : index >= pages.length - 1)) return
    turning.current = true
    // Single-canvas navigation commits through SetItem's existing auto-save handler.
    try { onTurn(direction) } catch (error) { turning.current = false; throw error }
  }
  return <section className="story-workspace" data-mode={mode} aria-label={mode === "writing" ? "Writing workspace" : "Drawing workspace"}>
    <PointedBanner className="story-student-banner">
      <span>{props.studentLabel ?? page?.id ?? studentId}</span>
      {onSelectStudent && <select className="story-student-picker" aria-label="Current student (development only)"
        title="Change current student (development only)" value={studentId} onChange={(event) => onSelectStudent(event.target.value)}>
        {students.map((id) => <option key={id} value={id}>{id}</option>)}
      </select>}
    </PointedBanner>
    {index !== myIndex && <button type="button" className="story-return" onClick={onJump}>Back to my page</button>}
    {/* The editor stays mounted across mode changes. Its value always comes from SetItem. */}
    <div className="story-writing-canvas" hidden={mode !== "writing"}>
      <textarea aria-label={page?.label ?? "Your story"} value={page?.text ?? ""} readOnly={!editable}
        tabIndex={editable ? 0 : -1} inert={mode !== "writing"}
        onChange={(event) => { if (editable) onChangeText(event.target.value) }}
        onKeyDown={(event) => {
          if (editable && !event.nativeEvent.isComposing && (event.ctrlKey || event.metaKey) && event.key === "Enter") {
            event.preventDefault()
            onSave()
          }
        }} />
    </div>
    {mode === "drawing" && <DrawingWorkspace studentId={page?.id ?? studentId} permanent={props.permanent} owned={index === myIndex && Boolean(page?.mine)} />}
    <PointedBanner wide className="story-navigation">
      <nav className="story-navigation-content" aria-label="Story pages">
        <button type="button" className="story-previous" disabled={index <= 0} onClick={() => turn("prev")}>Previous Page</button>
        <button type="button" className="story-next" disabled={index >= pages.length - 1} onClick={() => turn("next")}>Next Page</button>
        <button type="button" className="story-save" disabled={saved || props.saving} onClick={onSave} title={!props.permanent && mode === "drawing" ? "Save story text; drawing saving is coming soon" : undefined}>Save</button>
        <span className="story-save-status" role="status" data-error={error}>{props.saveStatus ?? (error ? "Could not save. Try again." : saved ? "Saved" : "Not Saved")}</span>
      </nav>
    </PointedBanner>
  </section>
}
