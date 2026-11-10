"use client"

import React, { useEffect, useRef, useState, useSyncExternalStore } from "react"
import dynamic from "next/dynamic"
import supabase from "@/src/utils/supabase"
import { regionFromImage, subtractRegion, eraseFills, tidyFill } from "./fillTool"

export const BRUSH_SIZES = [4, 7, 10, 13, 16]

const newId = () => Array.from({ length: 8 }, () => "abcdefghijklmnopqrstuvwxyz0123456789"[(Math.random() * 36) | 0]).join("")
const emptyDocument = () => ({ version: 1, canvas: { width: 1000, height: 750 }, strokes: [], fills: [] })
const num = (v, d) => (typeof v === "number" && Number.isFinite(v) ? v : d)
const oneOf = (v, list) => (list.includes(v) ? v : list[0])

const UNIT = 10
const tenth = (v) => Math.round(v * UNIT) / UNIT

const encodePoints = (pts) => {
    const out = []
    let px = 0
    let py = 0
    for (let i = 0; i < pts.length; i += 2) {
        const x = Math.round(pts[i] * UNIT)
        const y = Math.round(pts[i + 1] * UNIT)
        out.push(x - px, y - py)
        px = x
        py = y
    }
    return out
}

const decodePoints = (d) => {
    const out = []
    let x = 0
    let y = 0
    for (let i = 0; i < d.length; i += 2) {
        x += d[i]
        y += d[i + 1]
        out.push(x / UNIT, y / UNIT)
    }
    return out
}

// a fill is saved as polygons
const openRing = (ring) => {
    const first = ring[0]
    const last = ring[ring.length - 1]
    return (first[0] === last[0] && first[1] === last[1] ? ring.slice(0, -1) : ring).flatMap(([x, y]) => [x, y])
}

const fillToJSON = (f) => ({
    id: f.id,
    color: f.color,
    ...(f.opacity !== 1 && { opacity: f.opacity }),
    polygons: f.poly.map((polygon) => polygon.map((ring) => encodePoints(openRing(ring)))),
})

const fillFromJSON = (f, unit) => {
    if (!f || typeof f.id !== "string" || !Array.isArray(f.polygons)) return null
    const readRing = (d) => {
        if (!Array.isArray(d) || d.length < 6 || d.length % 2 !== 0 || !d.every(Number.isFinite)) return null
        const flat = decodePoints(d).map((v) => (v * UNIT) / unit)
        const ring = []
        for (let i = 0; i < flat.length; i += 2) ring.push([flat[i], flat[i + 1]])
        ring.push([flat[0], flat[1]])
        return ring
    }
    const poly = f.polygons
        .map((polygon) => (Array.isArray(polygon) ? polygon.map(readRing) : []))
        .filter((rings) => rings[0])
        .map(([outer, ...holes]) => [outer, ...holes.filter(Boolean)])
    if (!poly.length) return null
    return { id: f.id, color: typeof f.color === "string" ? f.color : "#000000", opacity: Math.min(1, Math.max(0, num(f.opacity, 1))), poly }
}

export function documentToJSON(doc) {
    return {
        version: 2,
        units: UNIT,
        canvas: doc.canvas,
        strokes: doc.strokes.map((s) => ({
            id: s.id,
            color: s.color,
            width: s.width,
            points: encodePoints(s.points),
            ...(s.opacity !== 1 && { opacity: s.opacity }),
            ...(s.lineCap !== "round" && { lineCap: s.lineCap }),
            ...(s.lineJoin !== "round" && { lineJoin: s.lineJoin }),
            ...(s.brush !== "pencil" && { brush: s.brush }),
            ...(s.src && { src: s.src }),
            ...(s.brush === "spray" && s.src && { off: tenth(s.off ?? 0), total: tenth(s.total ?? 0) }),
            ...(s.cutStart && { cutStart: true }),
            ...(s.cutEnd && { cutEnd: true }),
        })),
        ...(doc.fills.length && { fills: doc.fills.map(fillToJSON) }),
    }
}

// Packs a drawing into one short string
const PACK_TAG = "gz1:"

async function streamBytes(bytes, stream) {
    const writer = stream.writable.getWriter()
    writer.write(bytes)
    writer.close()
    return new Uint8Array(await new Response(stream.readable).arrayBuffer())
}

export async function packDrawing(json) {
    if (typeof CompressionStream === "undefined") return json // store it the long way if can't compress
    const bytes = await streamBytes(new TextEncoder().encode(JSON.stringify(json)), new CompressionStream("gzip"))
    let bin = ""
    for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode(...bytes.subarray(i, i + 0x8000))
    return PACK_TAG + btoa(bin)
}

export async function unpackDrawing(raw) {
    if (typeof raw !== "string" || !raw.startsWith(PACK_TAG)) return raw // old object format
    const bin = atob(raw.slice(PACK_TAG.length))
    const bytes = Uint8Array.from(bin, (c) => c.charCodeAt(0))
    return JSON.parse(new TextDecoder().decode(await streamBytes(bytes, new DecompressionStream("gzip"))))
}

export function documentFromJSON(raw) {
    if (raw == null) return emptyDocument()
    if (raw.version !== 1 && raw.version !== 2) throw new Error("Unsupported drawing document")
    const unit = num(raw.units, UNIT)
    const read = (s) => (raw.version === 2 && s && Array.isArray(s.points) ? { ...s, points: decodePoints(s.points).map((v) => (v * UNIT) / unit) } : s)
    const valid = (s) => s && typeof s.id === "string" && Array.isArray(s.points) && s.points.length >= 4 && s.points.length % 2 === 0 && s.points.every(Number.isFinite)
    return {
        version: 1,
        canvas: { width: num(raw.canvas?.width, 1000), height: num(raw.canvas?.height, 750) },
        strokes: (Array.isArray(raw.strokes) ? raw.strokes : []).map(read).filter(valid).map((s) => ({
            ...s,
            color: typeof s.color === "string" ? s.color : "#000000",
            width: num(s.width, 4) > 0 ? s.width : 4,
            opacity: Math.min(1, Math.max(0, num(s.opacity, 1))),
            lineCap: oneOf(s.lineCap, ["round", "butt", "square"]),
            lineJoin: oneOf(s.lineJoin, ["round", "bevel", "miter"]),
            brush: oneOf(s.brush, ["pencil", "spray", "eraser"]),
        })),
        fills: raw.version === 2 && Array.isArray(raw.fills) ? raw.fills.map((f) => fillFromJSON(f, unit)).filter(Boolean) : [],
    }
}

const dist2 = (px, py, ax, ay, bx, by) => {
    const dx = bx - ax
    const dy = by - ay
    const l2 = dx * dx + dy * dy
    const t = l2 === 0 ? 0 : Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / l2))
    return (px - ax - t * dx) ** 2 + (py - ay - t * dy) ** 2
}

export function simplifyPoints(pts, tol) {
    const n = pts.length / 2
    if (n <= 2 || tol <= 0) return pts.slice()
    const keep = new Uint8Array(n)
    keep[0] = keep[n - 1] = 1
    const stack = [[0, n - 1]]
    while (stack.length) {
        const [s, e] = stack.pop()
        let maxD = 0
        let idx = -1
        for (let i = s + 1; i < e; i++) {
            const d = dist2(pts[2 * i], pts[2 * i + 1], pts[2 * s], pts[2 * s + 1], pts[2 * e], pts[2 * e + 1])
            if (d > maxD) [maxD, idx] = [d, i]
        }
        if (idx !== -1 && maxD > tol * tol) {
            keep[idx] = 1
            stack.push([s, idx], [idx, e])
        }
    }
    return pts.filter((_, i) => keep[i >> 1])
}

export function polylineLength(pts) {
    let len = 0
    for (let i = 2; i < pts.length; i += 2) len += Math.hypot(pts[i] - pts[i - 2], pts[i + 1] - pts[i - 1])
    return len
}

const boundsCache = new WeakMap()
function boundsOf(pts) {
    let b = boundsCache.get(pts)
    if (!b) {
        const xs = pts.filter((_, i) => i % 2 === 0)
        const ys = pts.filter((_, i) => i % 2 === 1)
        b = { minX: Math.min(...xs), maxX: Math.max(...xs), minY: Math.min(...ys), maxY: Math.max(...ys) }
        boundsCache.set(pts, b)
    }
    return b
}

// check for if point sits on the stroke
const covers = (s, x, y, slack) => {
    const p = s.points
    const reach = s.width / 2 + slack
    const b = boundsOf(p)
    if (x < b.minX - reach || x > b.maxX + reach || y < b.minY - reach || y > b.maxY + reach) return false
    for (let i = 0; i < p.length - 2; i += 2) if (dist2(x, y, p[i], p[i + 1], p[i + 2], p[i + 3]) <= reach * reach) return true
    return false
}

// index of the stroke you can see at (x, y)
function visibleStrokeAt(strokes, x, y) {
    const erasers = []
    for (let i = strokes.length - 1; i >= 0; i--) {
        const s = strokes[i]
        if (s.brush === "eraser") erasers.push(s)
        else if (covers(s, x, y, 0.5) && !erasers.some((e) => covers(e, x, y, 0))) return i
    }
    return -1
}

// check if there's any drawing near the eraser's path
function touchesInk(strokes, x0, y0, x1, y1, r) {
    const [minX, maxX, minY, maxY] = [Math.min(x0, x1) - r, Math.max(x0, x1) + r, Math.min(y0, y1) - r, Math.max(y0, y1) + r]
    return strokes.some((s) => {
        if (s.brush === "eraser") return false
        const b = boundsOf(s.points)
        const pad = s.width / 2
        return !(b.maxX + pad < minX || b.minX - pad > maxX || b.maxY + pad < minY || b.minY - pad > maxY)
    })
}

// undo / redo

const replaceStrokes = (strokes, remove, insert) => {
    const drop = new Set(remove.map((r) => r.index))
    const out = strokes.filter((_, i) => !drop.has(i))
    for (const a of [...insert].sort((p, q) => p.index - q.index)) out.splice(a.index, 0, a.stroke)
    return out
}

const indexed = (list, skip) => list.map((stroke, index) => ({ stroke, index })).filter((x) => !skip.has(x.stroke.id))

export class DrawingEditor {
    doc = emptyDocument()
    undoStack = []
    redoStack = []
    listeners = new Set()
    version = 0
    gesture = null

    subscribe = (fn) => {
        this.listeners.add(fn)
        return () => this.listeners.delete(fn)
    }

    getVersion = () => this.version

    get canUndo() {
        return this.undoStack.length > 0
    }

    get canRedo() {
        return this.redoStack.length > 0
    }

    emit() {
        this.version++
        this.listeners.forEach((fn) => fn())
    }

    // strokes are tracked by what was removed / added
    record(before, after, fillsBefore = this.doc.fills, fillsAfter = this.doc.fills) {
        const removed = indexed(before, new Set(after.map((s) => s.id)))
        const added = indexed(after, new Set(before.map((s) => s.id)))
        const fillsChanged = fillsBefore !== fillsAfter
        if (!removed.length && !added.length && !fillsChanged) return
        this.pushOp({ removed, added, ...(fillsChanged && { fills: [fillsBefore, fillsAfter] }) })
    }

    pushOp(op) {
        this.undoStack.push(op)
        if (this.undoStack.length > 200) this.undoStack.shift()
        this.redoStack = []
    }

    beginStroke(style, x, y) {
        this.endGesture()
        const stroke = { id: newId(), points: [x, y, x, y], opacity: 1, lineCap: "round", lineJoin: "round", brush: "pencil", ...style }
        this.gesture = { kind: "stroke", id: stroke.id, before: this.doc.strokes, fills: this.doc.fills }
        this.doc.strokes = [...this.doc.strokes, stroke]
        this.emit()
    }

    // The eraser is a stroke of its own that erases whatever was drawn before it
    beginErase(radius, x, y) {
        this.endGesture()
        const eraser = { id: newId(), points: [x, y, x, y], width: radius * 2, color: "#000000", opacity: 1, lineCap: "round", lineJoin: "round", brush: "eraser" }
        this.gesture = { kind: "erase", radius, ink: false, before: this.doc.strokes, fills: this.doc.fills }
        this.doc.strokes = [...this.doc.strokes, eraser]
        this.sweep(x, y, x, y)
        this.emit()
    }

    // the eraser moved from (x0, y0) to (x1, y1)
    sweep(x0, y0, x1, y1) {
        const g = this.gesture
        this.doc.fills = eraseFills(this.doc.fills, x0, y0, x1, y1, g.radius)
        if (!g.ink) g.ink = touchesInk(g.before, x0, y0, x1, y1, g.radius)
    }

    pointerMove(x, y) {
        const g = this.gesture
        if (!g) return
        const strokes = this.doc.strokes
        const s = strokes[strokes.length - 1]
        const n = s.points.length
        if (Math.hypot(x - s.points[n - 2], y - s.points[n - 1]) < 0.5) return
        if (g.kind === "erase") this.sweep(s.points[n - 2], s.points[n - 1], x, y)
        this.doc.strokes = [...strokes.slice(0, -1), { ...s, points: [...s.points, x, y] }]
        this.emit()
    }

    endGesture() {
        const g = this.gesture
        if (!g) return
        this.gesture = null
        if (g.kind === "erase" && !g.ink) {
            this.doc.strokes = g.before // nothing to erase, so no eraser stroke is kept
        } else {
            const s = this.doc.strokes[this.doc.strokes.length - 1]
            const points = simplifyPoints(s.points, 0.4).map(tenth)
            this.doc.strokes = [...this.doc.strokes.slice(0, -1), { ...s, points }]
        }
        if (g.kind === "erase" && this.doc.fills !== g.fills) {
            // fills the eraser cut: smooth the polygon and drop tiny leftovers
            const oldFills = new Set(g.fills)
            this.doc.fills = this.doc.fills.map((f) => (oldFills.has(f) ? f : tidyFill(f))).filter(Boolean)
        }
        this.record(g.before, this.doc.strokes, g.fills, this.doc.fills)
        this.emit()
    }

    // paint bucket
    fill(style, x, y) {
        this.endGesture()
        const strokes = this.doc.strokes
        const hit = visibleStrokeAt(strokes, x, y)
        if (hit !== -1) return this.recolor(hit, x, y, style)

        const { rgba, ink } = renderPage(this.doc)
        const region = regionFromImage(rgba, ink, this.doc.canvas.width, this.doc.canvas.height, x, y)
        if (!region) return false
        const before = this.doc.fills
        this.doc.fills = [...subtractRegion(before, region), { id: newId(), color: style.color, opacity: style.opacity, poly: region }]
        this.record(strokes, strokes, before, this.doc.fills)
        this.emit()
        return true
    }

    // Gives the piece of line under (x, y) a new colour
    recolor(hit, x, y, style) {
        const strokes = this.doc.strokes
        const src = strokes[hit].src ?? strokes[hit].id
        const group = []
        strokes.forEach((s, index) => {
            if (s.brush !== "eraser" && (s.src ?? s.id) === src) group.push({ s, index })
        })
        const first = group[0].index
        const erasers = strokes.filter((s, i) => s.brush === "eraser" && i > first)
        const { width: w, height: h } = this.doc.canvas
        const piece = connectedPiece(group.map((g) => g.s), erasers, Math.round(w), Math.round(h), x, y)

        const replacements = new Map() // index -> the strokes that take its place
        for (const { s, index } of group) {
            const parts = splitByPiece(s, piece, style)
            if (parts) replacements.set(index, parts)
        }
        if (!replacements.size) return false

        const removed = []
        const added = []
        const next = []
        strokes.forEach((s, index) => {
            const parts = replacements.get(index)
            if (!parts) return next.push(s)
            removed.push({ stroke: s, index })
            for (const part of parts) {
                added.push({ stroke: part, index: next.length })
                next.push(part)
            }
        })
        this.doc.strokes = next
        this.pushOp({ removed, added })
        this.emit()
        return true
    }

    step(from, to, forward) {
        if (this.gesture || !from.length) return
        const op = from.pop()
        const [remove, insert] = forward ? [op.removed, op.added] : [op.added, op.removed]
        if (remove.length || insert.length) this.doc.strokes = replaceStrokes(this.doc.strokes, remove, insert)
        if (op.fills) this.doc.fills = op.fills[forward ? 1 : 0]
        to.push(op)
        this.emit()
    }

    undo() {
        this.step(this.undoStack, this.redoStack, false)
    }

    redo() {
        this.step(this.redoStack, this.undoStack, true)
    }

    clear() {
        if (this.gesture) return
        const before = this.doc.strokes
        const fillsBefore = this.doc.fills
        this.doc.strokes = []
        this.doc.fills = []
        this.record(before, [], fillsBefore, [])
        this.emit()
    }

    toJSON() {
        return documentToJSON(this.doc)
    }

    load(raw) {
        this.gesture = null
        this.doc = documentFromJSON(raw)
        this.undoStack = []
        this.redoStack = []
        this.emit()
    }
}

function createStore(initial) {
    let state = initial
    const listeners = new Set()
    return {
        get: () => state,
        set: (patch) => {
            const next = typeof patch === "function" ? patch(state) : { ...state, ...patch }
            if (next === state) return
            state = next
            listeners.forEach((fn) => fn())
        },
        subscribe: (fn) => {
            listeners.add(fn)
            return () => listeners.delete(fn)
        },
    }
}

const toolStore = createStore({ tool: "pencil", color: "#000000", sizeIndex: 2, opacity: 100, ownerIndex: 0 })
const snapshotStore = createStore({})
const editors = new Map()

export function getEditor(pageIndex) {
    let editor = editors.get(pageIndex)
    if (!editor) {
        editor = new DrawingEditor()
        editors.set(pageIndex, editor)
        persist.saved[pageIndex] = snapshotOf(editor) // a brand new, empty drawing counts as saved
    }
    return editor
}

export const setDrawingOwner = (pageIndex) => toolStore.set({ ownerIndex: pageIndex })

const useTools = () => useSyncExternalStore(toolStore.subscribe, toolStore.get, toolStore.get)

const setter = (key) => (value) => toolStore.set((prev) => ({ ...prev, [key]: typeof value === "function" ? value(prev[key]) : value }))
const [setTool, setColor, setSizeIndex, setOpacity] = ["tool", "color", "sizeIndex", "opacity"].map(setter)

export function useDrawingTools() {
    const t = useTools()
    const owner = getEditor(t.ownerIndex)
    useSyncExternalStore(owner.subscribe, owner.getVersion, owner.getVersion)
    return {
        tool: t.tool, setTool,
        color: t.color, setColor,
        sizeIndex: t.sizeIndex, setSizeIndex,
        size: BRUSH_SIZES[t.sizeIndex],
        opacity: t.opacity, setOpacity,
        undo: () => owner.undo(),
        redo: () => owner.redo(),
        clearAll: () => (owner.doc.strokes.length || owner.doc.fills.length) && window.confirm("Delete your whole drawing?") && owner.clear(),
        canUndo: owner.canUndo,
        canRedo: owner.canRedo,
    }
}

// saving to database

const snapshotOf = (editor) => ({ strokes: editor.doc.strokes, fills: editor.doc.fills })

const isSaved = (index) => {
    const saved = persist.saved[index]
    const doc = getEditor(index).doc
    return !!saved && saved.strokes === doc.strokes && saved.fills === doc.fills
}

const persist = { storyId: null, studentIds: [], myIndex: -1, segmentIds: {}, saved: {}, remote: {} }
const statusStore = createStore({ rev: 0, error: false })
const setStatus = (patch) => statusStore.set((prev) => ({ ...prev, rev: prev.rev + 1, ...patch }))

// saved / error state of one drawing, for the Save button's status text
export function useDrawingStatus(index) {
    const editor = getEditor(index)
    useSyncExternalStore(editor.subscribe, editor.getVersion, editor.getVersion)
    const { error } = useSyncExternalStore(statusStore.subscribe, statusStore.get, statusStore.get)
    return { saved: isSaved(index), error }
}

async function segmentIdFor(index) {
    if (persist.segmentIds[index]) return persist.segmentIds[index]
    const studentId = persist.studentIds[index]
    if (!persist.storyId || !studentId) return null
    const { data } = await supabase.from("story_segments").select("segment_id").eq("story_id", persist.storyId).eq("student_id", studentId).order("section_order", { ascending: true }).limit(1).maybeSingle()
    return data ? (persist.segmentIds[index] = data.segment_id) : null
}

// creates the student's story_segments row if it doesn't exist yet, returns its segment_id
export async function saveDrawing(index, makeSegment) {
    const editor = getEditor(index)
    if (isSaved(index)) return true
    const snapshot = snapshotOf(editor) // what is being saved, in case the drawing changes while it uploads
    const data = await packDrawing(editor.toJSON())
    let segmentId = await segmentIdFor(index)
    if (!segmentId && makeSegment) segmentId = persist.segmentIds[index] = await makeSegment()
    if (!segmentId) {
        console.log("Error saving drawing: no segment to save it to")
        setStatus({ error: true })
        return false
    }
    const { error } = await supabase.from("segment_drawings").upsert({ segment_id: segmentId, drawing_data: data }, { onConflict: "segment_id" })
    if (error) {
        console.log("Error saving drawing: ", error)
        setStatus({ error: true })
        return false
    }
    persist.saved[index] = snapshot // keep the saved drawing showing
    setStatus({ error: false })
    return true
}

// read everyone's drawings
export async function loadDrawings() {
    if (!persist.storyId) return
    const { data: segments, error } = await supabase.from("story_segments").select("segment_id, student_id").eq("story_id", persist.storyId).order("section_order", { ascending: true })
    if (error) return console.log("Error reading segments for drawings: ", error)
    const indexOf = {}
    const claimed = new Set()
    for (const row of segments ?? []) {
        const index = persist.studentIds.indexOf(row.student_id)
        if (index === -1 || claimed.has(index)) continue
        claimed.add(index)
        persist.segmentIds[index] = row.segment_id
        indexOf[row.segment_id] = index
    }
    const ids = Object.keys(indexOf)
    if (!ids.length) return
    const { data: drawings, error: drawError } = await supabase.from("segment_drawings").select("segment_id, drawing_data").in("segment_id", ids)
    if (drawError) return console.log("Error reading drawings: ", drawError)
    for (const row of drawings ?? []) {
        if (!row.drawing_data) continue
        const index = indexOf[row.segment_id]
        const editor = getEditor(index)
        const raw = JSON.stringify(row.drawing_data)
        if (index === persist.myIndex) {
            if (editor.doc.strokes.length || editor.doc.fills.length || editor.canUndo) continue
        } else if (persist.remote[index] === raw) {
            continue // nothing new from this student
        }
        try {
            const doc = await unpackDrawing(row.drawing_data)
            // may have started drawing while this was unpacking
            if (index === persist.myIndex && (editor.doc.strokes.length || editor.doc.fills.length || editor.canUndo)) continue
            editor.load(doc)
            persist.saved[index] = snapshotOf(editor)
            persist.remote[index] = raw
        } catch (e) {
            console.log("Could not read saved drawing: ", e)
        }
    }
}

export function setDrawingStory(storyId, studentIds, myIndex) {
    Object.assign(persist, { storyId, studentIds, myIndex, segmentIds: {}, remote: {} })
    return loadDrawings()
}

//rendering with Konva

function tracePaths(ctx, strokes) {
    ctx.beginPath()
    for (const { points: p } of strokes) {
        ctx.moveTo(p[0], p[1])
        for (let i = 2; i < p.length; i += 2) ctx.lineTo(p[i], p[i + 1])
    }
}

function endDirection(pts, atStart) {
    const n = pts.length / 2
    const i = atStart ? 0 : n - 1
    for (let k = 1; k < n; k++) {
        const j = atStart ? k : n - 1 - k
        const dx = pts[2 * i] - pts[2 * j]
        const dy = pts[2 * i + 1] - pts[2 * j + 1]
        const len = Math.hypot(dx, dy)
        if (len > 1e-6) return [dx / len, dy / len]
    }
    return null
}

function addEndCap(ctx, x, y, [ux, uy], w, cap, back) {
    const r = w / 2
    const px = -uy * r
    const py = ux * r
    ctx.moveTo(x + px, y + py)
    if (cap === "round") {
        const a = Math.atan2(uy, ux)
        ctx.arc(x, y, r, a - Math.PI / 2, a + Math.PI / 2, false)
    } else {
        ctx.lineTo(x + px + ux * r, y + py + uy * r)
        ctx.lineTo(x - px + ux * r, y - py + uy * r)
        ctx.lineTo(x - px, y - py)
    }
    ctx.lineTo(x - px - ux * back, y - py - uy * back)
    ctx.lineTo(x + px - ux * back, y + py - uy * back)
    ctx.closePath()
}

// fill as a polygon drawn underneath all the strokes
function drawFill(ctx, fill) {
    ctx.beginPath()
    for (const polygon of fill.poly) {
        for (const ring of polygon) {
            ring.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)))
            ctx.closePath()
        }
    }
    ctx.setAttr("globalAlpha", fill.opacity)
    ctx.setAttr("fillStyle", fill.color)
    ctx.fill()
}

function drawPencilGroup(ctx, strokes) {
    const head = strokes[0]
    const flat = strokes.some((s) => s.cutStart || s.cutEnd)
    for (const [k, v] of [["globalAlpha", head.opacity], ["strokeStyle", head.color], ["fillStyle", head.color], ["lineWidth", head.width], ["lineJoin", head.lineJoin], ["lineCap", flat ? "butt" : head.lineCap]]) ctx.setAttr(k, v)
    tracePaths(ctx, strokes)
    ctx.stroke()
    if (!flat || head.lineCap === "butt") return
    ctx.beginPath()
    for (const { points: p, cutStart, cutEnd } of strokes) {
        const start = !cutStart && endDirection(p, true)
        const end = !cutEnd && endDirection(p, false)
        if (start) addEndCap(ctx, p[0], p[1], start, head.width, head.lineCap, head.opacity >= 0.999 ? 0.75 : 0)
        if (end) addEndCap(ctx, p[p.length - 2], p[p.length - 1], end, head.width, head.lineCap, head.opacity >= 0.999 ? 0.75 : 0)
    }
    ctx.fill()
}

function hashString(str) {
    let h = 2166136261
    for (let i = 0; i < str.length; i++) h = Math.imul(h ^ str.charCodeAt(i), 16777619)
    return h >>> 0
}

function seeded(seed) {
    let a = seed >>> 0
    return () => {
        a = (a + 0x6d2b79f5) | 0
        let t = Math.imul(a ^ (a >>> 15), 1 | a)
        t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296
    }
}

function bristleSpecs(src, width) {
    const count = Math.max(6, Math.min(18, Math.round(width / 2.4)))
    const slot = width / count
    const specs = []
    for (let j = 0; j < count; j++) {
        const rnd = seeded(hashString(src) + j * 7919)
        const o = ((j + 0.5) / count - 0.5) * (width - slot) + (rnd() - 0.5) * slot * 0.5
        const edge = Math.min(1, Math.abs(o) / (width / 2))
        specs.push({
            offset: o,
            width: slot * (1.5 + rnd() * 0.7),
            alpha: 0.55 + rnd() * 0.45,
            trimStart: (edge * 0.8 + rnd() * 0.7) * width,
            trimEnd: (edge * 1.0 + rnd() * 0.9) * width,
        })
    }
    return specs
}

function dedupePoints(pts) {
    const out = [pts[0], pts[1]]
    for (let i = 2; i < pts.length; i += 2) {
        if (Math.hypot(pts[i] - out[out.length - 2], pts[i + 1] - out[out.length - 1]) > 1e-6) out.push(pts[i], pts[i + 1])
    }
    return out
}

function sliceByLength(pts, d0, d1) {
    const out = []
    let acc = 0
    for (let i = 0; i < pts.length / 2 - 1; i++) {
        const ax = pts[2 * i]
        const ay = pts[2 * i + 1]
        const vx = pts[2 * i + 2] - ax
        const vy = pts[2 * i + 3] - ay
        const seg = Math.hypot(vx, vy)
        const s0 = acc
        acc += seg
        if (seg === 0 || acc <= d0) continue
        if (s0 >= d1) break
        const t0 = Math.max(0, (d0 - s0) / seg)
        const t1 = Math.min(1, (d1 - s0) / seg)
        if (out.length === 0) out.push(ax + t0 * vx, ay + t0 * vy)
        out.push(ax + t1 * vx, ay + t1 * vy)
    }
    return out.length >= 4 ? out : null
}

function offsetPolyline(pts, o) {
    const n = pts.length / 2
    const out = new Array(pts.length)
    const normal = (i) => {
        const dx = pts[2 * i + 2] - pts[2 * i]
        const dy = pts[2 * i + 3] - pts[2 * i + 1]
        const len = Math.hypot(dx, dy) || 1
        return [-dy / len, dx / len]
    }
    for (let i = 0; i < n; i++) {
        const a = i > 0 ? normal(i - 1) : null
        const b = i < n - 1 ? normal(i) : null
        let nx
        let ny
        if (a && b) {
            nx = a[0] + b[0]
            ny = a[1] + b[1]
            const l = Math.hypot(nx, ny)
            if (l < 1e-6) {
                nx = a[0]
                ny = a[1]
            } else {
                nx /= l
                ny /= l
                const m = 1 / Math.max(nx * a[0] + ny * a[1], 0.5)
                nx *= m
                ny *= m
            }
        } else {
            const only = a || b
            nx = only[0]
            ny = only[1]
        }
        out[2 * i] = pts[2 * i] + nx * o
        out[2 * i + 1] = pts[2 * i + 1] + ny * o
    }
    return out
}

function drawBristleGroup(ctx, strokes) {
    const head = strokes[0]
    const W = head.width
    const parts = strokes.map((s) => {
        const pts = dedupePoints(s.points)
        return { pts, off: s.off ?? 0, len: polylineLength(pts), cutStart: s.cutStart === true, cutEnd: s.cutEnd === true }
    })
    const total = head.total ?? polylineLength(head.points)
    if (total < 1e-6) {
        ctx.setAttr("globalAlpha", head.opacity)
        ctx.setAttr("fillStyle", head.color)
        ctx.beginPath()
        for (const p of parts) {
            ctx.moveTo(p.pts[0] + W / 2, p.pts[1])
            ctx.arc(p.pts[0], p.pts[1], W / 2, 0, Math.PI * 2, false)
        }
        ctx.fill()
        return
    }
    const base = 1 - Math.pow(1 - head.opacity, 0.5)
    ctx.setAttr("strokeStyle", head.color)
    ctx.setAttr("lineJoin", "round")
    ctx.setAttr("lineCap", "round")
    for (const b of bristleSpecs(head.src ?? head.id, W)) {
        const cap = total * 0.4
        const from = Math.min(b.trimStart, cap)
        const to = total - Math.min(b.trimEnd, cap)
        ctx.beginPath()
        let any = false
        for (const p of parts) {
            const lo = Math.max(from - p.off, p.cutStart ? b.width / 2 : 0)
            const hi = Math.min(to - p.off, p.len - (p.cutEnd ? b.width / 2 : 0))
            const piece = hi > lo ? sliceByLength(p.pts, lo, hi) : null
            if (!piece) continue
            const line = offsetPolyline(piece, b.offset)
            ctx.moveTo(line[0], line[1])
            for (let i = 2; i < line.length; i += 2) ctx.lineTo(line[i], line[i + 1])
            any = true
        }
        if (!any) continue
        ctx.setAttr("globalAlpha", base * b.alpha)
        ctx.setAttr("lineWidth", b.width)
        ctx.stroke()
    }
}

// rubs out everything drawn before it in the same layer
function drawEraserGroup(ctx, strokes) {
    ctx.setAttr("globalCompositeOperation", "destination-out")
    ctx.setAttr("globalAlpha", 1)
    ctx.setAttr("strokeStyle", "#000000")
    ctx.setAttr("lineWidth", strokes[0].width)
    ctx.setAttr("lineCap", "round")
    ctx.setAttr("lineJoin", "round")
    tracePaths(ctx, strokes)
    ctx.stroke()
    // a click without dragging is a zero-length line, which not every browser draws a dot for, so cap the ends explicitly
    ctx.setAttr("fillStyle", "#000000")
    ctx.beginPath()
    for (const { points: p, width } of strokes) {
        ctx.moveTo(p[0] + width / 2, p[1])
        ctx.arc(p[0], p[1], width / 2, 0, Math.PI * 2)
        ctx.moveTo(p[p.length - 2] + width / 2, p[p.length - 1])
        ctx.arc(p[p.length - 2], p[p.length - 1], width / 2, 0, Math.PI * 2)
    }
    ctx.fill()
}

export function drawStrokeGroup(ctx, strokes) {
    if (strokes[0].brush === "eraser") drawEraserGroup(ctx, strokes)
    else if (strokes[0].brush === "spray") drawBristleGroup(ctx, strokes)
    else drawPencilGroup(ctx, strokes)
}

// Draws the page on screen
function renderPage(doc) {
    const w = Math.round(doc.canvas.width)
    const h = Math.round(doc.canvas.height)
    const make = () => {
        const c = document.createElement("canvas")
        c.width = w
        c.height = h
        const ctx = c.getContext("2d", { willReadFrequently: true })
        ctx.setAttr = (key, value) => { ctx[key] = value }
        return [c, ctx]
    }
    const [fillCanvas, fillCtx] = make()
    for (const f of doc.fills) {
        fillCtx.save()
        drawFill(fillCtx, f)
        fillCtx.restore()
    }
    const [inkCanvas, inkCtx] = make()
    for (const g of groupStrokes(doc.strokes)) {
        inkCtx.save()
        drawStrokeGroup(inkCtx, g.strokes)
        inkCtx.restore()
    }
    const [, pageCtx] = make()
    pageCtx.fillStyle = "#ffffff"
    pageCtx.fillRect(0, 0, w, h)
    pageCtx.drawImage(fillCanvas, 0, 0)
    pageCtx.drawImage(inkCanvas, 0, 0)
    const inkPixels = inkCtx.getImageData(0, 0, w, h).data
    const ink = new Uint8Array(w * h)
    for (let i = 0; i < ink.length; i++) ink[i] = inkPixels[4 * i + 3]
    return { rgba: pageCtx.getImageData(0, 0, w, h).data, ink }
}

const sameLook = (a, b) => ["color", "width", "opacity", "brush", "lineCap", "lineJoin"].every((k) => a[k] === b[k])

export function groupStrokes(strokes) {
    const groups = []
    const seen = new Map()
    for (const s of strokes) {
        const src = s.src ?? s.id
        const last = groups[groups.length - 1]
        if (last?.src === src && sameLook(last.strokes[0], s)) {
            last.strokes.push(s)
        } else {
            seen.set(src, (seen.get(src) ?? 0) + 1)
            groups.push({ src, key: src + ":" + seen.get(src), strokes: [s] })
        }
    }
    return groups
}

// Which pixels belong to the line piece clicked
function connectedPiece(group, erasers, w, h, x, y) {
    const c = document.createElement("canvas")
    c.width = w
    c.height = h
    const ctx = c.getContext("2d", { willReadFrequently: true })
    ctx.setAttr = (key, value) => { ctx[key] = value }
    const solid = group.map((s) => ({ ...s, brush: "pencil", opacity: 1, color: "#000000" })) // spray's speckles would count as gaps
    for (const g of [...groupStrokes(solid), ...groupStrokes(erasers)]) {
        ctx.save()
        drawStrokeGroup(ctx, g.strokes)
        ctx.restore()
    }
    const data = ctx.getImageData(0, 0, w, h).data
    const solidAt = (i) => data[4 * i + 3] >= 64

    // start from the clicked pixel, or the closest line pixel just next to it
    const px = Math.floor(x)
    const py = Math.floor(y)
    let start = -1
    let best = Infinity
    for (let dy = -4; dy <= 4; dy++) {
        for (let dx = -4; dx <= 4; dx++) {
            const nx = px + dx
            const ny = py + dy
            if (nx < 0 || ny < 0 || nx >= w || ny >= h || !solidAt(ny * w + nx)) continue
            if (dx * dx + dy * dy < best) [best, start] = [dx * dx + dy * dy, ny * w + nx]
        }
    }
    if (start === -1) return null

    const piece = new Uint8Array(w * h)
    const stack = [start]
    piece[start] = 1
    while (stack.length) {
        const i = stack.pop()
        const cx = i % w
        const cy = (i / w) | 0
        for (let dy = -1; dy <= 1; dy++) {
            for (let dx = -1; dx <= 1; dx++) {
                const nx = cx + dx
                const ny = cy + dy
                if (nx < 0 || ny < 0 || nx >= w || ny >= h) continue
                const j = ny * w + nx
                if (!piece[j] && solidAt(j)) {
                    piece[j] = 1
                    stack.push(j)
                }
            }
        }
    }
    return { mask: piece, w, h }
}

// the part of the polyline between distance a and b along it
function slicePolyline(p, cum, a, b) {
    const at = (t) => {
        let k = 0
        while (k < cum.length - 2 && cum[k + 1] < t) k++
        const len = cum[k + 1] - cum[k]
        const f = len > 0 ? Math.min(1, Math.max(0, (t - cum[k]) / len)) : 0
        return [p[2 * k] + (p[2 * k + 2] - p[2 * k]) * f, p[2 * k + 1] + (p[2 * k + 3] - p[2 * k + 1]) * f]
    }
    const out = [...at(a)]
    for (let k = 0; k < cum.length; k++) if (cum[k] > a && cum[k] < b) out.push(p[2 * k], p[2 * k + 1])
    out.push(...at(b))
    return out
}

// Returns what should replace stroke s so that only the part inside piece has the new style
function splitByPiece(s, piece, style) {
    const same = s.color === style.color && s.opacity === style.opacity
    const recolored = (o) => ({ ...o, color: style.color, opacity: style.opacity })
    if (!piece) return same ? null : [recolored(s)] // could not tell which piece, so the whole line

    const p = s.points
    const cum = [0]
    for (let i = 2; i < p.length; i += 2) cum.push(cum[cum.length - 1] + Math.hypot(p[i] - p[i - 2], p[i + 1] - p[i - 1]))
    const length = cum[cum.length - 1]
    const half = s.width / 2
    const count = Math.max(1, Math.ceil(length))
    const T = []
    const inside = []
    let k = 0
    for (let i = 0; i <= count; i++) {
        const t = Math.min(i, length)
        while (k < cum.length - 2 && cum[k + 1] < t) k++
        const len = cum[k + 1] - cum[k]
        const dx = len > 0 ? (p[2 * k + 2] - p[2 * k]) / len : 1
        const dy = len > 0 ? (p[2 * k + 3] - p[2 * k + 1]) / len : 0
        const cx = p[2 * k] + dx * (t - cum[k])
        const cy = p[2 * k + 1] + dy * (t - cum[k])
        let hit = false
        for (let o = -half; o <= half + 0.5 && !hit; o += 1) {
            const sx = Math.floor(cx - dy * Math.min(o, half))
            const sy = Math.floor(cy + dx * Math.min(o, half))
            hit = sx >= 0 && sy >= 0 && sx < piece.w && sy < piece.h && piece.mask[sy * piece.w + sx] === 1
        }
        T.push(t)
        inside.push(hit)
    }
    // a run only a pixel or two long is rounding at the edge of a cut, not a real piece so fold it into its neighbour
    const runs = []
    inside.forEach((v, i) => (runs.length && runs[runs.length - 1].v === v ? runs[runs.length - 1].n++ : runs.push({ v, n: 1 })))
    for (; ;) {
        const tiny = runs.findIndex((r) => r.n < 3)
        if (tiny === -1 || runs.length === 1) break
        const [prev, next] = [runs[tiny - 1], runs[tiny + 1]]
        const into = !prev ? next : !next ? prev : prev.n >= next.n ? prev : next
        runs[tiny].v = into.v
        for (let i = runs.length - 1; i > 0; i--) if (runs[i].v === runs[i - 1].v) runs.splice(i - 1, 2, { v: runs[i].v, n: runs[i].n + runs[i - 1].n })
    }
    inside.length = 0
    for (const r of runs) for (let i = 0; i < r.n; i++) inside.push(r.v)

    if (!inside.some(Boolean)) return null // this stroke has nothing in the clicked piece
    if (inside.every(Boolean)) return same ? null : [recolored(s)]
    if (same) return null

    const out = []
    let from = 0
    for (let i = 1; i <= inside.length; i++) {
        if (i < inside.length && inside[i] === inside[from]) continue
        const a = from === 0 ? 0 : (T[from - 1] + T[from]) / 2
        const b = i === inside.length ? length : (T[i - 1] + T[i]) / 2
        const part = {
            ...s,
            id: newId(),
            src: s.src ?? s.id,
            points: slicePolyline(p, cum, a, b),
            ...(s.brush === "spray" ? { off: (s.off ?? 0) + a, total: s.total ?? length } : {}),
            ...(a > 0 ? { cutStart: true } : {}),
            ...(b < length ? { cutEnd: true } : {}),
        }
        out.push(inside[from] ? recolored(part) : part)
        from = i
    }
    return out
}

const KonvaScene = dynamic(
    () =>
        import("react-konva").then(({ Stage, Layer, Shape, Circle, Group }) => {
            function Scene({ width, height, scale, strokes, fills, handlers, fillsRef, layerRef, ringRef, onReady }) {
                useEffect(onReady, [])
                return (
                    <Stage width={width} height={height} scaleX={scale} scaleY={scale} {...handlers}>
                        <Layer ref={fillsRef} listening={false}>
                            {fills.map((f) => (
                                <Shape key={f.id} sceneFunc={(ctx) => drawFill(ctx, f)} />
                            ))}
                        </Layer>
                        <Layer ref={layerRef} listening={false}>
                            {groupStrokes(strokes).map((g) => (
                                <Shape key={g.key} sceneFunc={(ctx) => drawStrokeGroup(ctx, g.strokes)} />
                            ))}
                        </Layer>
                        <Layer listening={false}>
                            <Group ref={ringRef} visible={false} listening={false}>
                                <Circle stroke="#ffffff" strokeWidth={3.5 / scale} listening={false} />
                                <Circle stroke="#1f2a52" strokeWidth={1.5 / scale} listening={false} />
                            </Group>
                        </Layer>
                    </Stage>
                )
            }
            return Scene
        }),
    { ssr: false }
)

export function DrawingSnapshot({ pageIndex }) {
    const url = useSyncExternalStore(snapshotStore.subscribe, snapshotStore.get, snapshotStore.get)[pageIndex]
    return url ? <img src={url} alt="" className="absolute inset-0 h-full w-full object-contain" /> : null
}

const ringTools = ["pencil", "spray", "eraser"]

export function DrawingCanvas({ pageIndex, editable = false }) {
    const editor = getEditor(pageIndex)
    const tools = useTools()
    useSyncExternalStore(editor.subscribe, editor.getVersion, editor.getVersion)
    const { strokes, fills, canvas } = editor.doc
    const size = BRUSH_SIZES[tools.sizeIndex]

    const wrapRef = useRef(null)
    const fillsRef = useRef(null)
    const layerRef = useRef(null)
    const ringRef = useRef(null)
    const drawing = useRef(false)
    const [scale, setScale] = useState(0.7)
    const [ready, setReady] = useState(false)
    const [tick, setTick] = useState(0)
    const latest = useRef({})
    latest.current = { scale, strokes, fills, pageIndex, end: null }

    useEffect(() => {
        const el = wrapRef.current
        const fit = () => {
            const fitted = Math.min(el.clientWidth / canvas.width, el.clientHeight / canvas.height)
            const device = (window.devicePixelRatio || 1) * (el.getBoundingClientRect().width / el.clientWidth || 1)
            setScale(fitted)
            for (const layer of [fillsRef.current, layerRef.current]) {
                if (!layer) continue
                layer.getCanvas().setPixelRatio(device)
                layer.batchDraw()
            }
        }
        fit()
        const ro = new ResizeObserver(fit)
        ro.observe(el)
        window.addEventListener("resize", fit)
        return () => {
            ro.disconnect()
            window.removeEventListener("resize", fit)
        }
    }, [canvas.width, canvas.height, ready])

    useEffect(() => {
        if (drawing.current || !ready) return
        const id = requestAnimationFrame(() => {
            const { scale: s, strokes: list, fills: filled, pageIndex: page } = latest.current
            const layer = layerRef.current
            if (!layer) return
            fillsRef.current?.draw()
            layer.draw()
            const url = list.length || filled.length ? layer.getStage().toDataURL({ pixelRatio: 1 / s, mimeType: "image/png" }) : null
            snapshotStore.set((prev) => ((prev[page] ?? null) === url ? prev : { ...prev, [page]: url }))
        })
        return () => cancelAnimationFrame(id)
    }, [strokes, fills, tick, ready])

    const end = () => {
        if (!drawing.current) return
        drawing.current = false
        editor.endGesture()
        setTick((t) => t + 1)
    }
    latest.current.end = end

    useEffect(() => {
        const up = () => latest.current.end()
        window.addEventListener("mouseup", up)
        window.addEventListener("touchend", up)
        return () => {
            window.removeEventListener("mouseup", up)
            window.removeEventListener("touchend", up)
        }
    }, [])

    const pos = (e) => {
        const p = e.target.getStage().getPointerPosition()
        return p && { x: p.x / scale, y: p.y / scale }
    }

    const down = (e) => {
        const p = editable && pos(e)
        if (!p) return
        const { tool, color, opacity } = tools
        const style = { color, opacity: opacity / 100 }
        if (tool === "eraser") editor.beginErase(size * 1.25, p.x, p.y)
        else if (tool === "pencil") editor.beginStroke({ ...style, width: size }, p.x, p.y)
        else if (tool === "spray") editor.beginStroke({ ...style, width: size * 2.5, brush: "spray" }, p.x, p.y)
        else if (tool === "fill") return void editor.fill(style, p.x, p.y) // one click, nothing to drag
        else return
        drawing.current = true
    }

    const showRing = (p) => {
        const ring = ringRef.current
        if (!ring) return
        const on = !!p && editable && ringTools.includes(tools.tool)
        ring.visible(on)
        if (on) {
            const radius = tools.tool === "pencil" ? size / 2 : size * 1.25
            const [halo, line] = ring.getChildren()
            ring.position({ x: p.x, y: p.y })
            halo.radius(radius)
            line.setAttrs({ radius, dash: tools.tool === "eraser" ? [5 / scale, 4 / scale] : [] })
        }
        ring.getLayer().batchDraw()
    }

    const move = (e) => {
        const p = pos(e)
        showRing(p)
        if (drawing.current && p) editor.pointerMove(p.x, p.y)
    }

    return (
        <div ref={wrapRef} className="flex h-full w-full touch-none items-center justify-center overflow-hidden" style={{ cursor: editable && ringTools.includes(tools.tool) ? "none" : editable && tools.tool === "fill" ? "crosshair" : "default" }}>
            <KonvaScene
                width={canvas.width * scale}
                height={canvas.height * scale}
                scale={scale}
                strokes={strokes}
                fills={fills}
                handlers={{ onMouseDown: down, onTouchStart: down, onMouseMove: move, onTouchMove: move, onMouseUp: end, onTouchEnd: end, onMouseLeave: () => showRing(null) }}
                fillsRef={fillsRef}
                layerRef={layerRef}
                ringRef={ringRef}
                onReady={() => setReady(true)}
            />
        </div>
    )
}