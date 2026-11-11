"use client"

import React, { useEffect, useLayoutEffect, useRef, useState } from "react"

const FLIP_MS = 1000
const STRIPS = 12 // the turning page is built from strips so it can bend like paper
const BEND_DEG = 0.35 // how much each strip lags behind the one before it, at the middle of the turn
const LIFT_PX = 28 // how far the page rises off the book at the middle of the turn
const SERIF = "Georgia, 'Times New Roman', serif"
const TEXT_SIZE = "clamp(13px, calc(var(--ph) * 0.045), 24px)"
const SMALL_SIZE = "clamp(11px, calc(var(--ph) * 0.03), 15px)"
const EDGE = "28px" // gap left between the book and the edge of the stage on the side where a whole page is showing.
const FONTS = ["Arial", "Arial Black", "Calibri", "Cambria", "Comic Sans MS", "Courier New", "Georgia", "Helvetica", "Impact", "Times New Roman", "Trebuchet MS", "Verdana"]

const clamp01 = (v) => Math.min(1, Math.max(0, v))
const ease = (t) => 0.5 - 0.5 * Math.cos(Math.PI * t)

function escapeHtml(text) {
    return text.replace(/[&<>]/g, (character) => ({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
    })[character])
}

function documentToHtml(document) {
    return (document?.runs ?? []).map(({ text, marks = {} }) => {
        let content = escapeHtml(text).replace(/\n/g, "<br>")
        if (marks.bold) content = `<strong>${content}</strong>`
        if (marks.italic) content = `<em>${content}</em>`
        if (marks.underline) content = `<u>${content}</u>`
        const fontFamily = FONTS.includes(marks.fontFamily) ? marks.fontFamily : null
        const fontSize = Number.isInteger(marks.fontSize) && marks.fontSize >= 8 && marks.fontSize <= 72
            ? marks.fontSize
            : null
        if (fontFamily || fontSize) {
            const styles = [
                fontFamily && `font-family:${fontFamily}`,
                fontSize && `font-size:${fontSize}px`,
            ].filter(Boolean).join(";")
            content = `<span style="${styles}">${content}</span>`
        }
        return content
    }).join("")
}

function serializeEditor(root) {
    const runs = []
    const addText = (text, marks) => {
        if (!text) return
        const previous = runs[runs.length - 1]
        if (previous && JSON.stringify(previous.marks) === JSON.stringify(marks)) {
            previous.text += text
        } else {
            runs.push({ text, marks })
        }
    }

    const visit = (node, parentMarks = {}) => {
        if (node.nodeType === Node.TEXT_NODE) {
            addText(node.nodeValue ?? "", parentMarks)
            return
        }
        if (node.nodeType !== Node.ELEMENT_NODE) return

        const element = node
        if (element.tagName === "BR") {
            addText("\n", parentMarks)
            return
        }

        const marks = { ...parentMarks }
        if (["B", "STRONG"].includes(element.tagName) || element.style.fontWeight === "bold") marks.bold = true
        if (["I", "EM"].includes(element.tagName) || element.style.fontStyle === "italic") marks.italic = true
        if (element.tagName === "U" || element.style.textDecoration.includes("underline")) marks.underline = true
        const fontFamily = (element.style.fontFamily || element.getAttribute("face") || "").replace(/["']/g, "").split(",")[0].trim()
        if (FONTS.includes(fontFamily)) marks.fontFamily = fontFamily
        const fontSize = Number.parseInt(element.style.fontSize, 10)
        if (Number.isInteger(fontSize) && fontSize >= 8 && fontSize <= 72) marks.fontSize = fontSize

        const isBlock = ["DIV", "P"].includes(element.tagName)
        if (isBlock && runs.length && !runs[runs.length - 1].text.endsWith("\n")) addText("\n", parentMarks)
        Array.from(element.childNodes).forEach((child) => visit(child, marks))
        if (isBlock && element.nextSibling && !runs[runs.length - 1]?.text.endsWith("\n")) addText("\n", parentMarks)
    }

    Array.from(root.childNodes).forEach((node) => visit(node))
    return { version: 1, runs }
}

function RichTextEditor({ writingDocument, onChange, onSave }) {
    const editorRef = useRef(null)
    const selectionRef = useRef(null)
    const lastDocumentRef = useRef("")
    const serializedDocument = JSON.stringify(writingDocument ?? { version: 1, runs: [] })

    useEffect(() => {
        if (!editorRef.current || serializedDocument === lastDocumentRef.current) return
        editorRef.current.innerHTML = documentToHtml(writingDocument)
        lastDocumentRef.current = serializedDocument
    }, [serializedDocument, writingDocument])

    const rememberSelection = () => {
        const selection = window.getSelection()
        if (selection?.rangeCount && editorRef.current?.contains(selection.anchorNode)) {
            selectionRef.current = selection.getRangeAt(0).cloneRange()
        }
    }

    const restoreSelection = () => {
        const selection = window.getSelection()
        if (!selection || !selectionRef.current || !editorRef.current?.contains(selectionRef.current.commonAncestorContainer)) {
            editorRef.current?.focus()
            return
        }
        editorRef.current.focus()
        selection.removeAllRanges()
        selection.addRange(selectionRef.current)
    }

    const commit = () => {
        if (!editorRef.current) return
        const document = serializeEditor(editorRef.current)
        lastDocumentRef.current = JSON.stringify(document)
        onChange(document)
        rememberSelection()
    }

    const applyCommand = (command) => {
        restoreSelection()
        window.document.execCommand(command)
        commit()
    }

    const applyStyle = (property, value) => {
        restoreSelection()
        const selection = window.getSelection()
        if (!selection?.rangeCount || selection.isCollapsed || !editorRef.current?.contains(selection.anchorNode)) return

        const range = selection.getRangeAt(0)
        const wrapper = window.document.createElement("span")
        wrapper.style[property] = value
        wrapper.appendChild(range.extractContents())
        range.insertNode(wrapper)
        selection.removeAllRanges()
        const nextRange = window.document.createRange()
        nextRange.selectNodeContents(wrapper)
        selection.addRange(nextRange)
        commit()
    }

    const button = (label, command) => (
        <button
            key={command}
            type="button"
            aria-label={label}
            title={label}
            className="rounded border border-neutral-300 px-2 py-1 text-sm text-neutral-800 hover:bg-neutral-100"
            onMouseDown={(event) => { event.preventDefault(); rememberSelection() }}
            onClick={() => applyCommand(command)}
        >
            {label}
        </button>
    )

    return (
        <div className="flex h-full min-h-0 flex-col">
            <div className="flex shrink-0 flex-wrap items-center gap-1 border-b border-neutral-200 px-2 py-1">
                {button("Bold", "bold")}
                {button("Italic", "italic")}
                {button("Underline", "underline")}
                <select
                    aria-label="Font family"
                    className="max-w-28 rounded border border-neutral-300 bg-white px-1 py-1 text-xs text-neutral-800"
                    defaultValue="Georgia"
                    onMouseDown={rememberSelection}
                    onChange={(event) => applyStyle("fontFamily", event.target.value)}
                >
                    {FONTS.map((font) => <option key={font} value={font}>{font}</option>)}
                </select>
                <select
                    aria-label="Font size"
                    className="rounded border border-neutral-300 bg-white px-1 py-1 text-xs text-neutral-800"
                    defaultValue="16"
                    onMouseDown={rememberSelection}
                    onChange={(event) => applyStyle("fontSize", `${event.target.value}px`)}
                >
                    {[12, 14, 16, 18, 24, 32, 48, 72].map((size) => (
                        <option key={size} value={size}>{size}</option>
                    ))}
                </select>
            </div>
            <div
                ref={editorRef}
                role="textbox"
                aria-label="Story text"
                aria-multiline="true"
                contentEditable
                suppressContentEditableWarning
                className="min-h-0 flex-1 overflow-auto whitespace-pre-wrap px-[5%] py-[4.5%] text-[#26262e] outline-none empty:before:text-[#a9abb8] empty:before:content-['Write_your_story_here…']"
                style={{ lineHeight: 1.65, fontFamily: SERIF, fontSize: TEXT_SIZE }}
                onInput={commit}
                onMouseUp={rememberSelection}
                onKeyUp={rememberSelection}
                onKeyDown={(event) => {
                    rememberSelection()
                    if ((event.metaKey || event.ctrlKey) && event.key === "Enter") {
                        event.preventDefault()
                        onSave()
                    }
                }}
            />
        </div>
    )
}

function RichTextDisplay({ writingDocument }) {
    return (
        <div className="absolute overflow-hidden whitespace-pre-wrap rounded-xl px-[5%] py-[4.5%] text-[#26262e]" style={{ inset: "13% 6% 10% 8%", lineHeight: 1.65, fontFamily: SERIF, fontSize: TEXT_SIZE }}>
            {(writingDocument?.runs ?? []).map((run, index) => (
                <span
                    key={index}
                    style={{
                        fontFamily: run.marks?.fontFamily,
                        fontSize: run.marks?.fontSize ? `${run.marks.fontSize}px` : undefined,
                        fontWeight: run.marks?.bold ? "bold" : undefined,
                        fontStyle: run.marks?.italic ? "italic" : undefined,
                        textDecoration: run.marks?.underline ? "underline" : undefined,
                    }}
                >
                    {run.text}
                </span>
            ))}
        </div>
    )
}

/* one white page */
function Face({ side, children }) {
    return (
        <div
            className="absolute inset-0"
            style={{
                background: `linear-gradient(${side === "left" ? "to right" : "to left"}, #fff 88%, #ececf0 100%)`,
                borderRadius: side === "left" ? "12px 0 0 12px" : "0 12px 12px 0",
                boxShadow: "inset 0 0 0 1px rgba(0,0,0,.07)",
            }}
        >
            {children}
        </div>
    )
}

/* what is written on a page: name, story, page number */
function PageBody({ side, page, number, editable, onChangeDocument, onSave }) {
    if (!page) return null

    const box = side === "left" ? "13% 8% 10% 6%" : "13% 6% 10% 8%"
    const edge = side === "left" ? { left: "6%", right: "8%" } : { left: "8%", right: "6%" }
    const writingDocument = page.writingDocument ?? {
        version: 1,
        runs: page.text ? [{ text: page.text, marks: {} }] : [],
    }

    return (
        <>
            <span className="absolute text-[#9a9aa8]" style={{ top: "5.5%", fontSize: SMALL_SIZE, ...edge }}>
                {page.label}
            </span>

            {editable ? (
                // the text box: dashed outline or solid outline when you click in
                <div
                    className="absolute rounded-xl border-[1.5px] border-dashed border-[#c3c6d4] transition-colors focus-within:border-solid focus-within:border-[#6b7cff]"
                    style={{ inset: box, resize: "both", overflow: "auto", minWidth: "45%", minHeight: "35%", maxWidth: "100%", maxHeight: "100%" }}
                >
                    <RichTextEditor writingDocument={writingDocument} onChange={onChangeDocument} onSave={onSave} />
                </div>
            ) : (
                page.text
                    ? <RichTextDisplay writingDocument={writingDocument} />
                    : <div className="absolute rounded-xl italic text-[#a9abb8]" style={{ inset: box, border: page.mine ? "1.5px dashed #c3c6d4" : "1.5px solid transparent", padding: "4.5% 5%" }}>Nothing written yet</div>
            )}

            <span className="absolute left-0 right-0 text-center text-[#b4b6c2]" style={{ bottom: "3.5%", fontSize: SMALL_SIZE }}>
                {number}
            </span>
        </>
    )
}

/* the drawing page (left page)
   Placeholder for now: a blank, labelled drawing area. The Konva <Stage> for drawing goes inside the area div below later. */
function DrawingBody({ page, number }) {
    if (!page) return null
    return (
        <>
            <span className="absolute text-[#9a9aa8]" style={{ top: "5.5%", left: "6%", right: "8%", fontSize: SMALL_SIZE }}>
                {page.mine ? "Your drawing" : `${page.name}’s drawing`}
            </span>
            <div
                className="absolute rounded-xl bg-[#f7f7fa]"
                style={{ inset: "13% 8% 10% 6%", border: page.mine ? "1.5px dashed #c3c6d4" : "1.5px solid transparent" }}
            />
            <span className="absolute left-0 right-0 text-center text-[#b4b6c2]" style={{ bottom: "3.5%", fontSize: SMALL_SIZE }}>
                {number}
            </span>
        </>
    )
}

/* the turning page */
const SW = `calc(var(--pw) / ${STRIPS})` // width of one strip

function Strip({ i, front, back, frontNumber, backNumber }) {
    const face = { position: "absolute", top: 0, left: 0, width: "calc(100% + 0.25px)", height: "100%", overflow: "hidden", backfaceVisibility: "hidden" }
    // each strip shows its own slice of a full-size page
    const fullPage = (slice) => ({ position: "absolute", top: 0, left: `calc(${SW} * ${-slice})`, width: "var(--pw)", height: "100%" })
    // the same shadow the spine has, so the page looks the same lying flat on either side
    const hinge = (dir) => ({
        position: "absolute",
        inset: 0,
        pointerEvents: "none",
        background: `linear-gradient(${dir}, rgba(0,0,0,.16) 0, rgba(0,0,0,.08) 1.2%, rgba(0,0,0,0) 6%)`,
    })
    const shade = (dir) => ({
        position: "absolute",
        inset: 0,
        background: `linear-gradient(${dir}, rgba(0,0,0,0), rgba(0,0,0,.28))`,
        opacity: "var(--shade)",
    })

    return (
        <div
            style={{
                position: "absolute",
                top: 0,
                left: i === 0 ? 0 : "100%",
                width: SW,
                height: "100%",
                transformStyle: "preserve-3d",
                transformOrigin: "0 50%",
                transform: i === 0 ? undefined : "rotateY(var(--bend)) translateZ(0.25px)", // the tiny translateZ stops flat neighbours flickering
            }}
        >
            {/* front: the page as written */}
            <div style={face}>
                <div style={fullPage(i)}>
                    <Face side="right">
                        <PageBody side="right" page={front} number={frontNumber} />
                    </Face>
                    <div style={shade("to right")} />
                    <div style={hinge("to right")} />
                </div>
            </div>

            {/* back: the next student's drawing page (it becomes the left page) */}
            <div style={{ ...face, transform: "rotateY(180deg)" }}>
                <div style={fullPage(STRIPS - 1 - i)}>
                    <Face side="left">
                        <DrawingBody page={back} number={backNumber} />
                    </Face>
                    <div style={shade("to left")} />
                    <div style={hinge("to left")} />
                </div>
            </div>

            {i < STRIPS - 1 && <Strip i={i + 1} front={front} back={back} frontNumber={frontNumber} backNumber={backNumber} />}
        </div>
    )
}

/* the open book */
function BookPage({ pages, index, myIndex, mode = "writing", onTurn, onJump, onChangeDocument, onSave, saved, error, errorMessage }) {
    const [anim, setAnim] = useState(null) // null | { dir: "next" | "prev" }
    const bookRef = useRef(null)
    const leafRef = useRef(null)

    const page = (i) => (i >= 0 && i < pages.length ? pages[i] : null)

    // each student has 2 pages: drawing page on the left, writing page on the right
    // while a page turns: its front is student leafIdx's writing, its back is student leafIdx+1's drawing.
    const leafIdx = anim ? (anim.dir === "next" ? index : index - 1) : null
    const leftIdx = anim ? leafIdx : index // drawing page showing on the left
    const rightIdx = anim ? leafIdx + 1 : index // writing page showing on the right
    const canEdit = !anim && index === myIndex && mode === "writing" // only owned page, and only in writing mode

    const turn = (dir) => {
        if (anim) return
        if (dir === "next" ? index >= pages.length - 1 : index <= 0) return
        setAnim({ dir })
    }

    useLayoutEffect(() => {
        if (!anim) return
        const leaf = leafRef.current
        const book = bookRef.current
        const from = anim.dir === "next" ? 0 : 1
        const to = 1 - from
        const lag = anim.dir === "next" ? 1 : -1 // the free edge trails behind the direction of travel
        const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches
        const duration = reduce ? 1 : FLIP_MS

        const apply = (raw) => {
            const e = clamp01(raw)
            const s = Math.sin(Math.PI * e) // 0 at both ends, 1 in the middle
            leaf.style.transform = `translateZ(${(s * LIFT_PX).toFixed(2)}px) rotateY(${(-180 * e).toFixed(3)}deg)`
            leaf.style.setProperty("--bend", `${(lag * BEND_DEG * s).toFixed(3)}deg`)
            leaf.style.setProperty("--shade", (0.75 * s).toFixed(3))
            const t = clamp01((e - 0.35) / 0.3)
            const toLeft = t * t * (3 - 2 * t) // 0 while the page is on the right, 1 once it is over the left
            book.style.setProperty("--underR", (s * (1 - toLeft)).toFixed(3))
            book.style.setProperty("--underL", (s * toLeft).toFixed(3))
        }

        apply(from)
        let raf
        let start
        const tick = (now) => {
            if (start === undefined) start = now
            const t = Math.min(1, (now - start) / duration)
            apply(from + (to - from) * ease(t))
            if (t < 1) {
                raf = requestAnimationFrame(tick)
            } else {
                book.style.setProperty("--underR", "0")
                book.style.setProperty("--underL", "0")
                onTurn(anim.dir)
                setAnim(null)
            }
        }
        raf = requestAnimationFrame(tick)
        return () => cancelAnimationFrame(raf)
    }, [anim]) // eslint-disable-line react-hooks/exhaustive-deps

    const pill = "rounded-full border border-neutral-300 px-4 py-1.5 text-neutral-700 transition-colors hover:bg-neutral-100 disabled:pointer-events-none disabled:opacity-30"

    return (
        <div
            className="relative flex min-h-0 w-full flex-1 flex-col justify-center overflow-hidden"
            style={{
                containerType: "size",
                "--pw": `min(calc((100cqw - ${EDGE}) / 1.5), calc((100cqh - 76px) / 0.62), 1200px)`,
                "--ph": "min(calc(100cqh - 76px), calc(var(--pw) * 1.05))",
            }}
        >
            <div
                style={{
                    width: "calc(var(--pw) * 2)",
                    flexShrink: 0,
                    transform: mode === "writing" ? "translateX(calc(var(--pw) * -0.5))" : `translateX(${EDGE})`,
                    transition: "transform 700ms cubic-bezier(.65, 0, .25, 1)",
                }}
            >
                <div ref={bookRef} className="relative" style={{ height: "var(--ph)", perspective: 2400 }}>
                    {/* a thin sheet under each page gives the book some thickness */}
                    <div
                        className="absolute left-0 w-1/2"
                        style={{ top: 6, height: "100%", background: "linear-gradient(#efeff3, #dddde4)", borderRadius: "12px 0 0 12px", boxShadow: "0 30px 40px -24px rgba(0,0,0,.3), 0 1px 3px rgba(0,0,0,.08)" }}
                    />
                    <div
                        className="absolute left-1/2 w-1/2"
                        style={{ top: 6, height: "100%", background: "linear-gradient(#efeff3, #dddde4)", borderRadius: "0 12px 12px 0", boxShadow: "0 30px 40px -24px rgba(0,0,0,.3), 0 1px 3px rgba(0,0,0,.08)" }}
                    />

                    {/* left page: the page before */}
                    <div className="absolute left-0 top-0 h-full w-1/2">
                        <Face side="left">
                            <DrawingBody page={page(leftIdx)} number={2 * leftIdx + 1} />
                        </Face>
                        {anim && (
                            <div
                                className="pointer-events-none absolute inset-0"
                                style={{ background: "linear-gradient(to left, rgba(0,0,0,.2), rgba(0,0,0,0) 60%)", opacity: "var(--underL, 0)", borderRadius: "12px 0 0 12px" }}
                            />
                        )}
                    </div>

                    {/* right page: the page the user is on */}
                    <div className="absolute left-1/2 top-0 h-full w-1/2">
                        <Face side="right">
                            <PageBody
                                side="right"
                                page={page(rightIdx)}
                                number={2 * rightIdx + 2}
                                editable={canEdit}
                                onChangeDocument={onChangeDocument}
                                onSave={onSave}
                            />
                        </Face>
                        {anim && (
                            <div
                                className="pointer-events-none absolute inset-0"
                                style={{ background: "linear-gradient(to right, rgba(0,0,0,.2), rgba(0,0,0,0) 60%)", opacity: "var(--underR, 0)", borderRadius: "0 12px 12px 0" }}
                            />
                        )}
                    </div>

                    {/* shadow where the pages meet */}
                    <div
                        className="pointer-events-none absolute left-1/2 top-0 z-20 h-full -translate-x-1/2"
                        style={{
                            width: "calc(var(--pw) * 0.12)",
                            background: "linear-gradient(to right, transparent, rgba(0,0,0,.08) 40%, rgba(0,0,0,.16) 50%, rgba(0,0,0,.08) 60%, transparent)",
                        }}
                    />

                    {/* the turning page */}
                    {anim && (
                        <div
                            ref={leafRef}
                            className="pointer-events-none absolute left-1/2 top-0 z-30 h-full w-1/2"
                            style={{ transformStyle: "preserve-3d", transformOrigin: "0 50%", willChange: "transform", "--bend": "0deg", "--shade": 0 }}
                        >
                            <Strip i={0} front={page(leafIdx)} back={page(leafIdx + 1)} frontNumber={2 * leafIdx + 2} backNumber={2 * (leafIdx + 1) + 1} />
                        </div>
                    )}
                </div>

            </div>

            {/* controls for flipping the pages */}
            <div className="relative mt-3 flex shrink-0 flex-nowrap items-center justify-center gap-2 whitespace-nowrap text-sm">
                {index !== myIndex && (
                    <button type="button" className={`${pill} absolute left-4`} onClick={onJump}>
                        Back to my page
                    </button>
                )}
                <button type="button" className={pill} onClick={() => turn("prev")} disabled={index === 0}>
                    Previous page
                </button>
                <button type="button" className={pill} onClick={() => turn("next")} disabled={index >= pages.length - 1}>
                    Next page
                </button>
                <button
                    type="button"
                    onClick={onSave}
                    disabled={saved}
                    className="ml-2 rounded-full bg-neutral-900 px-5 py-1.5 font-medium text-white transition-opacity disabled:opacity-40"
                >
                    Save
                </button>
                <span role="status" className={error ? "text-red-600" : "text-neutral-500"}>
                    {error ? (errorMessage || "Couldn’t save. Try again.") : saved ? "Saved" : "Not saved yet"}
                </span>
            </div>
        </div>
    )
}

export default BookPage