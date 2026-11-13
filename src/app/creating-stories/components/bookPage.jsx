"use client"

import React, { useLayoutEffect, useRef, useState } from "react"
import { flushSync } from "react-dom"

const FLIP_MS = 1000
const SERIF = "Georgia, 'Times New Roman', serif"
const TEXT_SIZE = "clamp(13px, calc(var(--ph) * 0.045), 24px)"
const SMALL_SIZE = "clamp(11px, calc(var(--ph) * 0.03), 15px)"
const EDGE = "28px" // gap left between the book and the edge of the stage on the side where a whole page is showing.

const clamp01 = (v) => Math.min(1, Math.max(0, v))
const ease = (t) => 0.5 - 0.5 * Math.cos(Math.PI * t)

/* one warm paper page */
function Face({ side, children }) {
    return (
        <div
            className="absolute inset-0"
            style={{
                background: `linear-gradient(${side === "left" ? "to right" : "to left"}, #fffdf7 0%, #faf7ee 92%, #e9e4d8 100%)`,
                borderRadius: side === "left" ? "16px 2px 2px 16px" : "2px 16px 16px 2px",
                boxShadow: "inset 0 0 0 1px rgba(117,105,78,.14), inset 0 2px 0 rgba(255,255,255,.8)",
            }}
        >
            {children}
        </div>
    )
}

/* what is written on a page: name, story, page number */
function PageBody({ side, page, number, editable, previewEditable, onChangeText, onSave }) {
    if (!page) return null

    const box = side === "left" ? "13% 8% 10% 6%" : "13% 6% 10% 8%"
    const edge = side === "left" ? { left: "6%", right: "8%" } : { left: "8%", right: "6%" }
    const textStyle = { fontFamily: SERIF, fontSize: TEXT_SIZE, lineHeight: 1.65, padding: "4.5% 5%" }

    return (
        <>
            <span className="absolute font-medium tracking-wide text-[#68738a]" style={{ top: "5.5%", fontSize: SMALL_SIZE, ...edge }}>
                {page.label}
            </span>

            {editable || previewEditable ? (
                // the text box: dashed outline or solid outline when you click in
                <div
                    className="absolute overflow-hidden rounded-2xl border border-dashed border-[#c9c4b6] bg-white/20 transition-colors focus-within:border-solid focus-within:border-[#5877a5] focus-within:bg-white/40 focus-within:ring-2 focus-within:ring-[#5877a5]/15 motion-reduce:transition-none"
                    style={{ inset: box }}
                >
                    {editable ? <textarea
                        value={page.text}
                        onChange={(e) => onChangeText(e.target.value)}
                        onKeyDown={(e) => {
                            if ((e.metaKey || e.ctrlKey) && e.key === "Enter") { e.preventDefault(); onSave() }
                        }}
                        placeholder="Write your story here…"
                        aria-label={page.label}
                        className="block h-full w-full resize-none bg-transparent text-[#30364a] outline-none placeholder:italic placeholder:text-[#7c8492]"
                        style={textStyle}
                    /> : (
                        // Match textarea padding relative to its wrapper, without an editor.
                        <div className="h-full w-full overflow-hidden whitespace-pre-wrap text-[#30364a] [overflow-wrap:break-word]" style={textStyle}>
                            {page.text || <span className="italic text-[#7c8492]">Write your story here…</span>}
                        </div>
                    )}
                </div>
            ) : (
                <div
                    className="absolute overflow-hidden whitespace-pre-wrap rounded-2xl text-[#30364a]"
                    style={{ inset: box, border: page.mine ? "1px dashed #c9c4b6" : "1px solid transparent", ...textStyle }}
                >
                    {page.text || <span className="italic text-[#7c8492]">Nothing written yet</span>}
                </div>
            )}

            <span className="absolute left-0 right-0 text-center tabular-nums text-[#858478]" style={{ bottom: "3.5%", fontSize: SMALL_SIZE }}>
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
            <span className="absolute font-medium tracking-wide text-[#68738a]" style={{ top: "5.5%", left: "6%", right: "8%", fontSize: SMALL_SIZE }}>
                {page.mine ? "Your drawing" : `${page.id}’s drawing`}
            </span>
            <div
                className="absolute rounded-2xl bg-[#f5f2e9] shadow-[inset_0_1px_3px_rgba(117,105,78,0.04)]"
                style={{ inset: "13% 8% 10% 6%", border: page.mine ? "1px dashed #c9c4b6" : "1px solid #e5e0d3" }}
            />
            <span className="absolute left-0 right-0 text-center tabular-nums text-[#858478]" style={{ bottom: "3.5%", fontSize: SMALL_SIZE }}>
                {number}
            </span>
        </>
    )
}

/* A continuous two-sided sheet avoids seams from separately rasterized text slices. */
function TurningPage({ front, back, frontNumber, backNumber, previewEditable }) {
    const surface = { position: "absolute", inset: 0, backfaceVisibility: "hidden" }
    const lighting = (side) => ({
        position: "absolute", inset: 0, pointerEvents: "none",
        borderRadius: side === "left" ? "16px 2px 2px 16px" : "2px 16px 16px 2px",
        background: `linear-gradient(${side === "left" ? "to left" : "to right"}, transparent, rgba(255,255,255,var(--leaf-glow,0)) var(--highlight,50%), transparent), linear-gradient(${side === "left" ? "to left" : "to right"}, rgba(75,63,38,var(--leaf-shade,0)), transparent 70%), linear-gradient(${side === "left" ? "to left" : "to right"}, rgba(75,63,38,.12), rgba(96,82,53,.05) 1.2%, transparent 4%)`,
    })

    return (
        <>
            <div style={surface}>
                <Face side="right">
                    <PageBody side="right" page={front} number={frontNumber} previewEditable={previewEditable} />
                </Face>
                <div style={lighting("right")} />
            </div>
            <div style={{ ...surface, transform: "rotateY(180deg)" }}>
                <Face side="left">
                    <DrawingBody page={back} number={backNumber} />
                </Face>
                <div style={lighting("left")} />
            </div>
        </>
    )
}

/* the open book */
function BookPage({ pages, index, myIndex, mode = "writing", onTurn, onJump, onChangeText, onSave, saved, error }) {
    const [anim, setAnim] = useState(null) // null | { dir: "next" | "prev" }
    const bookRef = useRef(null)
    const leafRef = useRef(null)
    const turningRef = useRef(false)

    const page = (i) => (i >= 0 && i < pages.length ? pages[i] : null)

    // each student has 2 pages: drawing page on the left, writing page on the right
    // while a page turns: its front is student leafIdx's writing, its back is student leafIdx+1's drawing.
    const leafIdx = anim ? (anim.dir === "next" ? index : index - 1) : null
    const leftIdx = anim ? leafIdx : index // drawing page showing on the left
    const rightIdx = anim ? leafIdx + 1 : index // writing page showing on the right
    const canEdit = !anim && index === myIndex && mode === "writing" // only owned page, and only in writing mode

    const turn = (dir) => {
        if (turningRef.current || anim) return
        if (dir === "next" ? index >= pages.length - 1 : index <= 0) return
        turningRef.current = true
        setAnim({ dir })
    }

    useLayoutEffect(() => {
        if (!anim) return
        const leaf = leafRef.current
        const book = bookRef.current
        const from = anim.dir === "next" ? 0 : 1
        const to = 1 - from
        const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches
        const duration = reduce ? 1 : FLIP_MS
        let cancelled = false
        let completed = false

        const apply = (raw) => {
            const progress = clamp01(raw)
            // Explicit endpoints have zero lift/lighting and exactly match static pages.
            const settled = progress === 0 || progress === 1
            const envelope = settled ? 0 : Math.sin(Math.PI * progress)
            leaf.style.transform = `rotateY(${progress === 0 ? 0 : progress === 1 ? -180 : -180 * progress}deg)`
            leaf.style.setProperty("--leaf-shade", `${envelope * 0.12}`)
            leaf.style.setProperty("--leaf-glow", `${envelope * 0.1}`)
            leaf.style.setProperty("--highlight", `${(1 - progress) * 100}%`)
            const t = clamp01((progress - 0.35) / 0.3)
            const toLeft = t * t * (3 - 2 * t)
            book.style.setProperty("--underR", (envelope * (1 - toLeft) * 0.65).toFixed(3))
            book.style.setProperty("--underL", (envelope * toLeft * 0.65).toFixed(3))
        }

        apply(from)
        let raf
        let start
        const tick = (now) => {
            if (cancelled || completed) return
            if (start === undefined) start = now
            const t = Math.min(1, (now - start) / duration)
            apply(reduce ? to : from + (to - from) * ease(t))
            if (!reduce && t < 1) {
                raf = requestAnimationFrame(tick)
            } else {
                completed = true
                book.style.setProperty("--underR", "0")
                book.style.setProperty("--underL", "0")
                // Commit the destination and remove its animated cover in one render.
                flushSync(() => {
                    onTurn(anim.dir)
                    setAnim(null)
                })
                turningRef.current = false
            }
        }
        raf = requestAnimationFrame(tick)
        return () => {
            cancelled = true
            cancelAnimationFrame(raf)
            book.style.setProperty("--underR", "0")
            book.style.setProperty("--underL", "0")
        }
    }, [anim]) // eslint-disable-line react-hooks/exhaustive-deps

    const pill = "min-h-8 rounded-xl border border-[#a4b5ce] bg-[#f6f3ec] px-3 py-1.5 text-xs font-medium text-[#29436c] transition-colors hover:border-[#708cb4] hover:bg-[#fffdf7] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#294889] active:bg-[#e9e3d7] disabled:pointer-events-none disabled:opacity-45 motion-reduce:transition-none @min-[640px]:min-h-9 @min-[640px]:px-4 @min-[640px]:text-sm"

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
                <div ref={bookRef} className="relative" style={{ height: "var(--ph)", perspective: 12000 }}>
                    {/* a thin sheet under each page gives the book some thickness */}
                    <div
                        className="absolute left-0 w-1/2"
                        style={{ top: 6, height: "100%", background: "linear-gradient(to bottom, #f2eddf 98%, #d8d0bf 98%, #f5f0e5 99%)", borderRadius: "16px 0 0 16px", boxShadow: "0 18px 30px -18px rgba(15,30,75,.25), 0 2px 4px rgba(75,63,38,.1)" }}
                    />
                    <div
                        className="absolute left-1/2 w-1/2"
                        style={{ top: 6, height: "100%", background: "linear-gradient(to bottom, #f2eddf 98%, #d8d0bf 98%, #f5f0e5 99%)", borderRadius: "0 16px 16px 0", boxShadow: "0 18px 30px -18px rgba(15,30,75,.25), 0 2px 4px rgba(75,63,38,.1)" }}
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
                                onChangeText={onChangeText}
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
                            width: "calc(var(--pw) * 0.08)",
                            background: "linear-gradient(to right, transparent, rgba(96,82,53,.05) 35%, rgba(75,63,38,.12) 50%, rgba(96,82,53,.05) 65%, transparent)",
                        }}
                    />

                    {/* the turning page */}
                    {anim && (
                        <div
                            ref={leafRef}
                            className="pointer-events-none absolute left-1/2 top-0 z-30 h-full w-1/2"
                            aria-hidden="true"
                            data-turning-page=""
                            style={{ transformStyle: "preserve-3d", transformOrigin: "0 50%", willChange: "transform" }}
                        >
                            <TurningPage front={page(leafIdx)} back={page(leafIdx + 1)} frontNumber={2 * leafIdx + 2} backNumber={2 * (leafIdx + 1) + 1} previewEditable={leafIdx === myIndex && mode === "writing"} />
                        </div>
                    )}
                </div>

            </div>

            {/* controls for flipping the pages */}
            <div className="relative mt-3 flex shrink-0 flex-col items-center justify-center gap-1 px-2 whitespace-nowrap @min-[640px]:flex-row @min-[640px]:gap-3">
                <div className="flex items-center justify-center gap-2">
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
                        className="min-h-8 rounded-xl border border-[#294889] bg-[#294889] px-4 py-1.5 text-xs font-medium text-white transition-colors hover:bg-[#203c74] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#294889] active:bg-[#192f5c] disabled:pointer-events-none disabled:border-[#788ba8] disabled:bg-[#788ba8] motion-reduce:transition-none @min-[640px]:min-h-9 @min-[640px]:px-5 @min-[640px]:text-sm"
                    >
                        Save
                    </button>
                </div>
                <div className="flex min-h-6 items-center justify-center gap-3 text-xs @min-[640px]:text-sm">
                    {index !== myIndex && (
                        <button type="button" className="rounded-lg border border-[#a4b5ce] bg-[#f6f3ec] px-2 py-0.5 text-xs font-medium text-[#29436c] transition-colors hover:border-[#708cb4] hover:bg-[#fffdf7] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#294889] active:bg-[#e9e3d7] motion-reduce:transition-none" onClick={onJump}>
                            Back to my page
                        </button>
                    )}
                    <span role="status" className={error ? "text-red-600" : "text-[#465c7b]"}>
                        {error ? "Couldn’t save. Try again." : saved ? "Saved" : "Not saved yet"}
                    </span>
                </div>
            </div>
        </div>
    )
}

export default BookPage
