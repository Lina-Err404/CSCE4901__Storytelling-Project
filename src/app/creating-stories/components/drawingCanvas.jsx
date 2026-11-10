"use client"

import React, { useEffect, useRef, useState, useSyncExternalStore } from "react"
import dynamic from "next/dynamic"
import supabase from "@/src/utils/supabase"

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
        ...(doc.fills.length && { fills: doc.fills }),
    }
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
            brush: oneOf(s.brush, ["pencil", "spray"]),
        })),
        fills: Array.isArray(raw.fills) ? raw.fills : [],
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

const range = (c0, c1, lo, hi) => {
    if (Math.abs(c1) < 1e-12) return c0 >= lo && c0 <= hi ? [-Infinity, Infinity] : null
    const a = (lo - c0) / c1
    const b = (hi - c0) / c1
    return a <= b ? [a, b] : [b, a]
}

function circleRange(ax, ay, vx, vy, cx, cy, d) {
    const vv = vx * vx + vy * vy
    const wx = ax - cx
    const wy = ay - cy
    const c = wx * wx + wy * wy - d * d
    if (vv < 1e-12) return c <= 0 ? [0, 1] : null
    const b = vx * wx + vy * wy
    const disc = b * b - vv * c
    return disc < 0 ? null : [(-b - Math.sqrt(disc)) / vv, (-b + Math.sqrt(disc)) / vv]
}

const sweep = (...parts) => {
    const hit = parts.filter(Boolean)
    return hit.length ? [Math.min(...hit.map((p) => p[0])), Math.max(...hit.map((p) => p[1]))] : null
}

const both = (a, b) => (a && b && Math.max(a[0], b[0]) <= Math.min(a[1], b[1]) ? [Math.max(a[0], b[0]), Math.min(a[1], b[1])] : null)

function reachRange(ax, ay, bx, by, e) {
    const vx = bx - ax
    const vy = by - ay
    const len = Math.hypot(e.x1 - e.x0, e.y1 - e.y0)
    const ux = len > 1e-9 ? (e.x1 - e.x0) / len : 0
    const uy = len > 1e-9 ? (e.y1 - e.y0) / len : 0
    const d = e.r + e.h
    return sweep(
        circleRange(ax, ay, vx, vy, e.x0, e.y0, d),
        len > 1e-9 && circleRange(ax, ay, vx, vy, e.x1, e.y1, d),
        len > 1e-9 && both(range((ax - e.x0) * ux + (ay - e.y0) * uy, vx * ux + vy * uy, 0, len), range((ax - e.x0) * uy - (ay - e.y0) * ux, vx * uy - vy * ux, -d, d))
    )
}

function bandRange(ax, ay, bx, by, e) {
    const vx = bx - ax
    const vy = by - ay
    const sl = Math.hypot(vx, vy)
    const nx = (-vy / sl) * e.h
    const ny = (vx / sl) * e.h
    const P = [[e.x0 - nx, e.y0 - ny], [e.x0 + nx, e.y0 + ny], [e.x1 + nx, e.y1 + ny], [e.x1 - nx, e.y1 - ny]]
    const parts = []
    for (let i = 0; i < 4; i++) {
        const [px, py] = P[i]
        const [qx, qy] = P[(i + 1) % 4]
        parts.push(circleRange(ax, ay, vx, vy, px, py, e.r))
        const len = Math.hypot(qx - px, qy - py)
        if (len > 1e-9) {
            const ux = (qx - px) / len
            const uy = (qy - py) / len
            parts.push(both(range((ax - px) * ux + (ay - py) * uy, vx * ux + vy * uy, 0, len), range((ax - px) * uy - (ay - py) * ux, vx * uy - vy * ux, -e.r, e.r)))
        }
    }
    const ex = P[3][0] - P[0][0]
    const ey = P[3][1] - P[0][1]
    const lx = P[1][0] - P[0][0]
    const ly = P[1][1] - P[0][1]
    const det = ex * ly - ey * lx
    if (Math.abs(det) > 1e-9) {
        const cx = ax - P[0][0]
        const cy = ay - P[0][1]
        parts.push(both(range((cx * ly - cy * lx) / det, (vx * ly - vy * lx) / det, 0, 1), range((ex * cy - ey * cx) / det, (ex * vy - ey * vx) / det, 0, 1)))
    }
    return sweep(...parts)
}

function insideRange(ax, ay, bx, by, e) {
    const wide = reachRange(ax, ay, bx, by, e)
    if (!wide) return null
    const edge = e.h / Math.hypot(bx - ax, by - ay)
    const iv = sweep(bandRange(ax, ay, bx, by, e), wide[0] <= edge && [wide[0], Math.min(wide[1], edge)], wide[1] >= 1 - edge && [Math.max(wide[0], 1 - edge), wide[1]])
    return iv && both([0, 1], iv)
}

function cutPolyline(pts, e, minLen) {
    if (polylineLength(pts) < 1e-9) return dist2(pts[0], pts[1], e.x0, e.y0, e.x1, e.y1) <= (e.r + e.h) ** 2 ? [] : null
    const pieces = []
    let cur = []
    let startCut = false
    let off = 0
    let acc = 0
    let touched = false
    const begin = (x, y, cut, at) => {
        cur = [x, y]
        startCut = cut
        off = at
    }
    for (let i = 0; i < pts.length / 2 - 1; i++) {
        const [ax, ay, bx, by] = pts.slice(2 * i, 2 * i + 4)
        const seg = Math.hypot(bx - ax, by - ay)
        const at = acc
        acc += seg
        const iv = seg > 1e-9 ? insideRange(ax, ay, bx, by, e) : null
        if (!iv) {
            if (!cur.length) begin(ax, ay, i > 0, at)
            cur.push(bx, by)
            continue
        }
        touched = true
        const [t0, t1] = iv
        if (t0 > 0) {
            if (!cur.length) begin(ax, ay, i > 0, at)
            cur.push(ax + t0 * (bx - ax), ay + t0 * (by - ay))
        }
        if (cur.length) pieces.push({ pts: cur, startCut, endCut: true, off })
        cur = []
        if (t1 < 1) {
            begin(ax + t1 * (bx - ax), ay + t1 * (by - ay), true, at + t1 * seg)
            cur.push(bx, by)
        }
    }
    if (cur.length) pieces.push({ pts: cur, startCut, endCut: false, off })
    return touched ? pieces.filter((p) => p.pts.length >= 4 && polylineLength(p.pts) >= minLen) : null
}

export function eraseStrokes(strokes, x0, y0, x1, y1, radius) {
    let out = null
    strokes.forEach((s, i) => {
        const reach = radius + s.width / 2
        const b = boundsOf(s.points)
        const far = b.maxX < Math.min(x0, x1) - reach || b.minX > Math.max(x0, x1) + reach || b.maxY < Math.min(y0, y1) - reach || b.minY > Math.max(y0, y1) + reach
        const keep = Math.max(0.5, s.width * 1.5, Math.min(s.width * 3, 36))
        const pieces = far ? null : cutPolyline(s.points, { x0, y0, x1, y1, r: radius, h: s.width / 2 }, keep)
        if (!pieces) return out?.push(s)
        out ??= strokes.slice(0, i)
        for (const p of pieces) {
            out.push({ ...s, id: newId(), src: s.src ?? s.id, points: p.pts, ...(s.brush === "spray" ? { off: (s.off ?? 0) + p.off, total: s.total ?? polylineLength(s.points) } : {}), ...(p.startCut ? { cutStart: true } : {}), ...(p.endCut ? { cutEnd: true } : {}) })
        }
    })
    return out ?? strokes
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

    record(before, after) {
        const removed = indexed(before, new Set(after.map((s) => s.id)))
        const added = indexed(after, new Set(before.map((s) => s.id)))
        if (!removed.length && !added.length) return
        this.undoStack.push({ removed, added })
        if (this.undoStack.length > 200) this.undoStack.shift()
        this.redoStack = []
    }

    beginStroke(style, x, y) {
        this.endGesture()
        const stroke = { id: newId(), points: [x, y, x, y], opacity: 1, lineCap: "round", lineJoin: "round", brush: "pencil", ...style }
        this.gesture = { kind: "stroke", id: stroke.id, before: this.doc.strokes }
        this.doc.strokes = [...this.doc.strokes, stroke]
        this.emit()
    }

    beginErase(radius, x, y) {
        this.endGesture()
        this.gesture = { kind: "erase", radius, x, y, before: this.doc.strokes }
        this.pointerMove(x, y)
    }

    pointerMove(x, y) {
        const g = this.gesture
        if (!g) return
        const strokes = this.doc.strokes
        let next = strokes
        if (g.kind === "erase") {
            next = eraseStrokes(strokes, g.x, g.y, x, y, g.radius)
            g.x = x
            g.y = y
        } else {
            const s = strokes[strokes.length - 1]
            const n = s.points.length
            if (Math.hypot(x - s.points[n - 2], y - s.points[n - 1]) < 0.5) return
            next = [...strokes.slice(0, -1), { ...s, points: [...s.points, x, y] }]
        }
        if (next !== strokes) {
            this.doc.strokes = next
            this.emit()
        }
    }

    endGesture() {
        const g = this.gesture
        if (!g) return
        this.gesture = null
        if (g.kind === "stroke") {
            const s = this.doc.strokes[this.doc.strokes.length - 1]
            const points = simplifyPoints(s.points, 0.4).map(tenth)
            this.doc.strokes = [...this.doc.strokes.slice(0, -1), { ...s, points }]
        } else {
            const old = new Set(g.before.map((s) => s.id))
            this.doc.strokes = this.doc.strokes.map((s) => (old.has(s.id) ? s : { ...s, points: s.points.map(tenth) }))
        }
        this.record(g.before, this.doc.strokes)
        this.emit()
    }

    step(from, to, forward) {
        if (this.gesture || !from.length) return
        const op = from.pop()
        const [remove, insert] = forward ? [op.removed, op.added] : [op.added, op.removed]
        this.doc.strokes = replaceStrokes(this.doc.strokes, remove, insert)
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
        this.doc.strokes = []
        this.record(before, [])
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
        persist.saved[pageIndex] = editor.doc.strokes // a brand new, empty drawing counts as saved
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
        clearAll: () => owner.doc.strokes.length && window.confirm("Delete your whole drawing?") && owner.clear(),
        canUndo: owner.canUndo,
        canRedo: owner.canRedo,
    }
}

// saving to database

const persist = { storyId: null, studentIds: [], myIndex: -1, segmentIds: {}, saved: {}, remote: {} }
const statusStore = createStore({ rev: 0, error: false })
const setStatus = (patch) => statusStore.set((prev) => ({ ...prev, rev: prev.rev + 1, ...patch }))

// saved / error state of one drawing, for the Save button's status text
export function useDrawingStatus(index) {
    const editor = getEditor(index)
    useSyncExternalStore(editor.subscribe, editor.getVersion, editor.getVersion)
    const { error } = useSyncExternalStore(statusStore.subscribe, statusStore.get, statusStore.get)
    return { saved: editor.doc.strokes === persist.saved[index], error }
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
    const strokes = editor.doc.strokes
    if (strokes === persist.saved[index]) return true
    const data = editor.toJSON()
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
    persist.saved[index] = strokes // keep the saved drawing showing
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
            if (editor.doc.strokes.length || editor.canUndo) continue
        } else if (persist.remote[index] === raw) {
            continue // nothing new from this student
        }
        try {
            editor.load(row.drawing_data)
            persist.saved[index] = editor.doc.strokes
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

export function drawStrokeGroup(ctx, strokes) {
    if (strokes[0].brush === "spray") drawBristleGroup(ctx, strokes)
    else drawPencilGroup(ctx, strokes)
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

const KonvaScene = dynamic(
    () =>
        import("react-konva").then(({ Stage, Layer, Shape, Circle, Group }) => {
            function Scene({ width, height, scale, strokes, handlers, layerRef, ringRef, onReady }) {
                useEffect(onReady, [])
                return (
                    <Stage width={width} height={height} scaleX={scale} scaleY={scale} {...handlers}>
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
    const { strokes, canvas } = editor.doc
    const size = BRUSH_SIZES[tools.sizeIndex]

    const wrapRef = useRef(null)
    const layerRef = useRef(null)
    const ringRef = useRef(null)
    const drawing = useRef(false)
    const [scale, setScale] = useState(0.7)
    const [ready, setReady] = useState(false)
    const [tick, setTick] = useState(0)
    const latest = useRef({})
    latest.current = { scale, strokes, pageIndex, end: null }

    useEffect(() => {
        const el = wrapRef.current
        const fit = () => {
            const fitted = Math.min(el.clientWidth / canvas.width, el.clientHeight / canvas.height)
            const device = (window.devicePixelRatio || 1) * (el.getBoundingClientRect().width / el.clientWidth || 1)
            setScale(fitted)
            const layer = layerRef.current
            if (layer) {
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
            const { scale: s, strokes: list, pageIndex: page } = latest.current
            const layer = layerRef.current
            if (!layer) return
            layer.draw()
            const url = list.length ? layer.getStage().toDataURL({ pixelRatio: 1 / s, mimeType: "image/png" }) : null
            snapshotStore.set((prev) => ((prev[page] ?? null) === url ? prev : { ...prev, [page]: url }))
        })
        return () => cancelAnimationFrame(id)
    }, [strokes, tick, ready])

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
        <div ref={wrapRef} className="flex h-full w-full touch-none items-center justify-center overflow-hidden" style={{ cursor: editable && ringTools.includes(tools.tool) ? "none" : "default" }}>
            <KonvaScene
                width={canvas.width * scale}
                height={canvas.height * scale}
                scale={scale}
                strokes={strokes}
                handlers={{ onMouseDown: down, onTouchStart: down, onMouseMove: move, onTouchMove: move, onMouseUp: end, onTouchEnd: end, onMouseLeave: () => showRing(null) }}
                layerRef={layerRef}
                ringRef={ringRef}
                onReady={() => setReady(true)}
            />
        </div>
    )
}