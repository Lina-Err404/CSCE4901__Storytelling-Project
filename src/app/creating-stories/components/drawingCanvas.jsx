"use client"

import React, { useEffect, useRef, useState, useSyncExternalStore } from "react"
import dynamic from "next/dynamic"
import supabase from "@/src/utils/supabase"
import { regionFromImage, subtractRegion, eraseFills, tidyFill } from "./fillTool"

export const BRUSH_SIZES = [4, 7, 10, 13, 16]

const newId = () => Array.from({ length: 8 }, () => "abcdefghijklmnopqrstuvwxyz0123456789"[(Math.random() * 36) | 0]).join("")
const emptyDocument = () => ({ version: 1, canvas: { width: 1000, height: 750 }, strokes: [], fills: [], stamps: [] })
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
    ...(f.back && { back: true }),
    ...(f.above && { above: f.above }),
    ...(f.z && { z: f.z }),
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
    const above = typeof f.above === "string" && f.above.length <= 40 ? f.above : undefined
    return { id: f.id, color: typeof f.color === "string" ? f.color : "#000000", opacity: Math.min(1, Math.max(0, num(f.opacity, 1))), poly, back: f.back === true || !above, above, z: num(f.z, 0) }
}

// stamps and shapes

// Shapes are drawn inside a box that gets stretched to the stamp's width and height
const poly = (pts) => [...pts.map(([x, y], i) => [i ? "L" : "M", x, y]), ["Z"]]

const STAR = (() => {
    const raw = []
    for (let i = 0; i < 10; i++) {
        const r = i % 2 ? 0.4 : 1
        const a = -Math.PI / 2 + (i * Math.PI) / 5
        raw.push([Math.cos(a) * r, Math.sin(a) * r])
    }
    const xs = raw.map((p) => p[0])
    const ys = raw.map((p) => p[1])
    const [x0, x1, y0, y1] = [Math.min(...xs), Math.max(...xs), Math.min(...ys), Math.max(...ys)]
    return poly(raw.map(([x, y]) => [(x - x0) / (x1 - x0), (y - y0) / (y1 - y0)]))
})()

const H = 0.2762 // bezier handle length that makes four curves into a circle
const ELLIPSE = [
    ["M", 0.5, 0],
    ["C", 0.5 + H, 0, 1, 0.5 - H, 1, 0.5],
    ["C", 1, 0.5 + H, 0.5 + H, 1, 0.5, 1],
    ["C", 0.5 - H, 1, 0, 0.5 + H, 0, 0.5],
    ["C", 0, 0.5 - H, 0.5 - H, 0, 0.5, 0],
    ["Z"],
]

const HEART = [
    ["M", 0.5, 1],
    ["C", 0.12, 0.72, 0, 0.5, 0, 0.28],
    ["C", 0, 0.12, 0.12, 0, 0.27, 0],
    ["C", 0.38, 0, 0.46, 0.06, 0.5, 0.16],
    ["C", 0.54, 0.06, 0.62, 0, 0.73, 0],
    ["C", 0.88, 0, 1, 0.12, 1, 0.28],
    ["C", 1, 0.5, 0.88, 0.72, 0.5, 1],
    ["Z"],
]

// ratio = height / width when first placed, width is optional
const SHAPES = {
    rectangle: { label: "rectangle", ratio: 0.7, path: poly([[0, 0], [1, 0], [1, 1], [0, 1]]) },
    ellipse: { label: "circle", ratio: 1, path: ELLIPSE },
    triangle: { label: "triangle", ratio: 0.87, path: poly([[0.5, 0], [1, 1], [0, 1]]) },
    diamond: { label: "diamond", ratio: 1, path: poly([[0.5, 0], [1, 0.5], [0.5, 1], [0, 0.5]]) },
    star: { label: "star", ratio: 0.95, path: STAR },
    heart: { label: "heart", ratio: 0.92, path: HEART },
    arrow: { label: "arrow", ratio: 0.5, path: poly([[0, 0.3], [0.6, 0.3], [0.6, 0], [1, 0.5], [0.6, 1], [0.6, 0.7], [0, 0.7]]) },
    line: { label: "line", ratio: 0.04, width: 360, path: poly([[0, 0], [1, 0], [1, 1], [0, 1]]) },
}
const SHAPE_IDS = Object.keys(SHAPES)

const svgPath = (path) => path.map((cmd) => cmd.join(" ")).join(" ")

// what the stamp panel needs to draw its shape buttons
export const SHAPE_LIST = SHAPE_IDS.map((id) => ({ id, label: SHAPES[id].label, ratio: SHAPES[id].ratio, svgPath: svgPath(SHAPES[id].path) }))

function traceShape(ctx, path, w, h) {
    ctx.beginPath()
    for (const [op, ...a] of path) {
        if (op === "M") ctx.moveTo(a[0] * w, a[1] * h)
        else if (op === "L") ctx.lineTo(a[0] * w, a[1] * h)
        else if (op === "C") ctx.bezierCurveTo(a[0] * w, a[1] * h, a[2] * w, a[3] * h, a[4] * w, a[5] * h)
        else ctx.closePath()
    }
}

const MIN_STAMP = 8
const MAX_STAMP = 4000
const MAX_STAMPS = 300

// only images from the app's own images are loaded
const isStampSrc = (v) => typeof v === "string" && /^\/images\/[\w-]+\/[\w\-. ]+$/.test(v) && !v.includes("..")

const stampToJSON = (s) => ({
    id: s.id,
    kind: s.kind,
    ...(s.kind === "image" ? { src: s.src } : { shape: s.shape, color: s.color }),
    x: tenth(s.x),
    y: tenth(s.y),
    width: tenth(s.width),
    height: tenth(s.height),
    ...(s.rotation && { rotation: tenth(s.rotation) }),
    ...(s.opacity !== 1 && { opacity: s.opacity }),
    ...(s.back && { back: true }),
    ...(s.above && { above: s.above }),
    ...(s.category && { category: s.category }),
    ...(s.z && { z: s.z }),
})

const stampFromJSON = (s) => {
    if (!s || typeof s.id !== "string") return null
    const size = (v) => Math.min(MAX_STAMP, Math.max(MIN_STAMP, num(v, 100)))
    const base = {
        id: s.id,
        x: num(s.x, 0),
        y: num(s.y, 0),
        width: size(s.width),
        height: size(s.height),
        rotation: num(s.rotation, 0),
        opacity: Math.min(1, Math.max(0, num(s.opacity, 1))),
        back: s.back === true,
        z: num(s.z, 0),
        ...(typeof s.above === "string" && s.above.length <= 40 && { above: s.above }),
        ...(typeof s.category === "string" && /^[\w-]{1,40}$/.test(s.category) && { category: s.category }),
    }
    if (s.kind === "image") return isStampSrc(s.src) ? { ...base, kind: "image", src: s.src } : null
    if (s.kind === "shape" && SHAPE_IDS.includes(s.shape)) return { ...base, kind: "shape", shape: s.shape, color: typeof s.color === "string" ? s.color : "#000000" }
    return null
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
        ...(doc.stamps.length && { stamps: doc.stamps.map(stampToJSON) }),
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
        stamps: raw.version === 2 && Array.isArray(raw.stamps) ? raw.stamps.slice(0, MAX_STAMPS).map(stampFromJSON).filter(Boolean) : [],
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

// point in a stamp's own frame
function stampLocal(s, x, y) {
    const a = (-s.rotation * Math.PI) / 180
    const [dx, dy] = [x - s.x, y - s.y]
    return [dx * Math.cos(a) - dy * Math.sin(a), dx * Math.sin(a) + dy * Math.cos(a)]
}

let probe = null
const probeCtx = () => (probe ??= document.createElement("canvas").getContext("2d", { willReadFrequently: true }))

// check if the stamp is under (x, y)
function stampHit(s, x, y) {
    const [lx, ly] = stampLocal(s, x, y)
    if (lx < 0 || ly < 0 || lx > s.width || ly > s.height) return false
    const ctx = probeCtx()
    if (s.kind === "shape") {
        ctx.beginPath()
        traceShape(ctx, SHAPES[s.shape].path, s.width, s.height)
        return ctx.isPointInPath(lx, ly)
    }
    const img = loadedStampImage(s.src)
    if (!img) return false
    ctx.canvas.width = 1
    ctx.canvas.height = 1
    ctx.drawImage(img, -lx, -ly, s.width, s.height)
    return ctx.getImageData(0, 0, 1, 1).data[3] > 40
}

function fillHit(f, x, y) {
    const ctx = probeCtx()
    traceFill(ctx, f)
    return ctx.isPointInPath(x, y)
}

// What you can see at (x, y), looking down from the top of the stacking order
function topAt(doc, x, y) {
    const items = interleave(doc.strokes, doc.stamps, doc.fills)
    const erasers = []
    const erased = () => erasers.some((e) => covers(e, x, y, 0))
    for (let i = items.length - 1; i >= 0; i--) {
        const item = items[i]
        if (item.group) {
            const list = item.group.strokes
            for (let k = list.length - 1; k >= 0; k--) {
                const s = list[k]
                if (s.brush === "eraser") erasers.push(s)
                else if (covers(s, x, y, 0.5) && !erased()) return { stroke: s }
            }
        } else if (item.fill) {
            if (!erased() && fillHit(item.fill, x, y)) return { fill: item.fill }
        } else if (!erased() && stampHit(item.stamp, x, y)) {
            return item.stamp.kind === "shape" ? { stamp: item.stamp } : { image: item.stamp }
        }
    }
    return null
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

// does the eraser's path come near a stamp
function touchesStamps(stamps, x0, y0, x1, y1, r) {
    return stamps.some((s) => {
        const a = (-s.rotation * Math.PI) / 180
        const [cos, sin] = [Math.cos(a), Math.sin(a)]
        return [[x0, y0], [x1, y1]].some(([px, py]) => {
            const lx = (px - s.x) * cos - (py - s.y) * sin
            const ly = (px - s.x) * sin + (py - s.y) * cos
            return lx >= -r && lx <= s.width + r && ly >= -r && ly <= s.height + r
        })
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

// The fill helpers hand back new fill objects, so make sure each one keeps its place in the stacking order
const keepStacking = (olds, news) => {
    const byId = new Map(olds.map((f) => [f.id, f]))
    return news.map((f) => {
        const old = f && byId.get(f.id)
        return old && old !== f ? { ...f, back: old.back, above: old.above, z: old.z } : f
    })
}

// where something put on the page right now goes
const stackingNow = (strokes) => {
    const top = strokes[strokes.length - 1]
    return top ? { back: false, above: top.src ?? top.id } : { back: true }
}

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
    record(before, after, fillsBefore = this.doc.fills, fillsAfter = this.doc.fills, stampsBefore = this.doc.stamps, stampsAfter = this.doc.stamps) {
        const removed = indexed(before, new Set(after.map((s) => s.id)))
        const added = indexed(after, new Set(before.map((s) => s.id)))
        const fillsChanged = fillsBefore !== fillsAfter
        const stampsChanged = stampsBefore !== stampsAfter
        if (!removed.length && !added.length && !fillsChanged && !stampsChanged) return
        this.pushOp({ removed, added, ...(fillsChanged && { fills: [fillsBefore, fillsAfter] }), ...(stampsChanged && { stamps: [stampsBefore, stampsAfter] }) })
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
        this.gesture = { kind: "erase", radius, ink: false, before: this.doc.strokes, fills: this.doc.fills, stamps: this.doc.stamps }
        this.doc.strokes = [...this.doc.strokes, eraser]
        this.sweep(x, y, x, y)
        this.emit()
    }

    // the eraser moved from (x0, y0) to (x1, y1)
    sweep(x0, y0, x1, y1) {
        const g = this.gesture
        this.doc.fills = keepStacking(this.doc.fills, eraseFills(this.doc.fills, x0, y0, x1, y1, g.radius))
        if (!g.ink) g.ink = touchesInk(g.before, x0, y0, x1, y1, g.radius) || touchesStamps(g.stamps, x0, y0, x1, y1, g.radius)
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
            this.doc.fills = this.doc.fills.map((f) => (oldFills.has(f) ? f : keepStacking([f], [tidyFill(f)])[0])).filter(Boolean)
        }
        this.record(g.before, this.doc.strokes, g.fills, this.doc.fills)
        this.emit()
    }

    // z for the next stamp or fill, higher than all the ones there are, or lower than all of them
    nextZ() {
        return 1 + Math.max(0, ...this.doc.stamps.map((s) => s.z ?? 0), ...this.doc.fills.map((f) => f.z ?? 0))
    }

    lowestZ() {
        return Math.min(0, ...this.doc.stamps.map((s) => s.z ?? 0), ...this.doc.fills.map((f) => f.z ?? 0)) - 1
    }

    // paint bucket colours the line or shape you can see under the click, otherwise fills the closed area
    fill(style, x, y) {
        this.endGesture()
        const strokes = this.doc.strokes
        const hit = topAt(this.doc, x, y)
        if (hit?.stroke) return this.recolor(strokes.indexOf(hit.stroke), x, y, style)
        if (hit?.stamp) {
            if (hit.stamp.color === style.color && hit.stamp.opacity === style.opacity) return false
            this.updateStamp(hit.stamp.id, { color: style.color, opacity: style.opacity })
            return true
        }

        const { rgba, ink } = renderPage(this.doc)
        const region = regionFromImage(rgba, ink, this.doc.canvas.width, this.doc.canvas.height, x, y)
        if (!region) return false
        const before = this.doc.fills
        const made = { id: newId(), color: style.color, opacity: style.opacity, poly: region, ...stackingNow(strokes), z: this.nextZ() }
        this.doc.fills = [...keepStacking(before, subtractRegion(before, region)), made]
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

    // stamps and shapes
    addStamp(stamp) {
        this.endGesture()
        const before = this.doc.stamps
        this.doc.stamps = [...before, stamp]
        this.record(this.doc.strokes, this.doc.strokes, this.doc.fills, this.doc.fills, before, this.doc.stamps)
        this.emit()
    }

    updateStamp(id, patch, merge = false) {
        this.endGesture()
        const before = this.doc.stamps
        if (!before.some((s) => s.id === id)) return
        const after = before.map((s) => (s.id === id ? { ...s, ...patch } : s))
        this.doc.stamps = after
        const top = this.undoStack[this.undoStack.length - 1]
        if (merge && top?.edit === id && Date.now() - top.at < 1500) {
            top.stamps[1] = after
            top.at = Date.now()
            this.redoStack = []
        } else {
            this.pushOp({ removed: [], added: [], stamps: [before, after], edit: id, at: Date.now() })
        }
        this.emit()
    }

    // to back is underneath all the drawing. To front is over everything drawn so far
    restack(id) {
        this.endGesture()
        const before = this.doc.stamps
        const stamp = before.find((s) => s.id === id)
        if (!stamp) return
        let after
        if (!stamp.back) {
            const { above, ...plain } = stamp
            after = before.map((s) => (s.id === id ? { ...plain, back: true, z: this.lowestZ() } : s))
        } else {
            const top = this.doc.strokes[this.doc.strokes.length - 1]
            if (!top) return // nothing drawn yet to be in front of
            after = before.map((s) => (s.id === id ? { ...s, back: false, above: top.src ?? top.id, z: this.nextZ() } : s))
        }
        this.doc.stamps = after
        this.record(this.doc.strokes, this.doc.strokes, this.doc.fills, this.doc.fills, before, after)
        this.emit()
    }

    removeStamp(id) {
        this.endGesture()
        const before = this.doc.stamps
        if (!before.some((s) => s.id === id)) return
        this.doc.stamps = before.filter((s) => s.id !== id)
        this.record(this.doc.strokes, this.doc.strokes, this.doc.fills, this.doc.fills, before, this.doc.stamps)
        this.emit()
    }

    step(from, to, forward) {
        if (this.gesture || !from.length) return
        const op = from.pop()
        const [remove, insert] = forward ? [op.removed, op.added] : [op.added, op.removed]
        if (remove.length || insert.length) this.doc.strokes = replaceStrokes(this.doc.strokes, remove, insert)
        if (op.fills) this.doc.fills = op.fills[forward ? 1 : 0]
        if (op.stamps) this.doc.stamps = op.stamps[forward ? 1 : 0]
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
        const stampsBefore = this.doc.stamps
        this.doc.strokes = []
        this.doc.fills = []
        this.doc.stamps = []
        this.record(before, [], fillsBefore, [], stampsBefore, [])
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

const toolStore = createStore({ tool: "pencil", color: "#000000", sizeIndex: 2, opacity: 100, ownerIndex: 0, selectedId: null, returnTool: "pencil" })
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
const [setColor, setSizeIndex, setOpacity] = ["color", "sizeIndex", "opacity"].map(setter)

const setTool = (value) =>
    toolStore.set((prev) => {
        const tool = typeof value === "function" ? value(prev.tool) : value
        return { ...prev, tool, ...(tool !== "select" && { selectedId: null }) }
    })

const enterSelect = (id) => toolStore.set((prev) => ({ ...prev, tool: "select", selectedId: id, returnTool: prev.tool === "select" ? prev.returnTool : prev.tool }))
const leaveSelect = () => toolStore.set((prev) => (prev.tool === "select" ? { ...prev, tool: prev.returnTool, selectedId: null } : prev.selectedId ? { ...prev, selectedId: null } : prev))

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
        clearAll: () => (owner.doc.strokes.length || owner.doc.fills.length || owner.doc.stamps.length) && window.confirm("Delete your whole drawing?") && owner.clear(),
        canUndo: owner.canUndo,
        canRedo: owner.canRedo,
    }
}

// stamps and shapes

// the type the stamp panel puts on a drag, and the canvas looks for on a drop
export const STAMP_DRAG = "application/x-stamp"

const imageCache = new Map() // src -> { img, promise }

export function loadStampImage(src) {
    let entry = imageCache.get(src)
    if (!entry) {
        entry = { img: null, promise: null }
        entry.promise = new Promise((resolve, reject) => {
            const img = document.createElement("img")
            img.onload = () => {
                entry.img = img
                resolve(img)
            }
            img.onerror = () => {
                imageCache.delete(src)
                reject(new Error("Could not load " + src))
            }
            img.src = src
        })
        imageCache.set(src, entry)
    }
    return entry.promise
}

const loadedStampImage = (src) => imageCache.get(src)?.img ?? null

// Puts a stamp on a page
export async function placeStamp(spec, at = null, index = toolStore.get().ownerIndex) {
    const { color, opacity } = toolStore.get()
    const editor = getEditor(index)
    const { width: cw, height: ch } = editor.doc.canvas
    const nudge = at ? 0 : (editor.doc.stamps.length % 6) * 24 // so stamps added one after another don't hide each other
    const [cx, cy] = at ? [Math.min(Math.max(at.x, 0), cw), Math.min(Math.max(at.y, 0), ch)] : [cw / 2 + nudge, ch / 2 + nudge]
    // placed over whatever is drawn right now, so strokes drawn afterwards go over it. A background or a page with nothing drawn yet sits underneath
    const stacking = (backdrop) => ({ ...(backdrop ? { back: true } : stackingNow(editor.doc.strokes)), z: editor.nextZ() })
    let stamp
    if (spec.kind === "image") {
        if (!isStampSrc(spec.src)) return false
        const img = await loadStampImage(spec.src).catch(() => null)
        if (!img || !img.naturalWidth) return false
        const backdrop = spec.category === "background" // a background fills the page and sits behind the drawing
        const fit = Math.min((backdrop ? cw : cw * 0.35) / img.naturalWidth, (backdrop ? ch : ch * 0.45) / img.naturalHeight)
        const [width, height] = [tenth(img.naturalWidth * fit), tenth(img.naturalHeight * fit)]
        const [mx, my] = backdrop ? [cw / 2, ch / 2] : [cx, cy]
        stamp = { id: newId(), kind: "image", src: spec.src, x: tenth(mx - width / 2), y: tenth(my - height / 2), width, height, rotation: 0, opacity: 1, ...stacking(backdrop), ...(backdrop && { category: "background" }) }
    } else {
        const def = SHAPES[spec.shape]
        if (!def) return false
        const width = def.width ?? 240
        const height = tenth(width * def.ratio)
        stamp = { id: newId(), kind: "shape", shape: spec.shape, color, x: tenth(cx - width / 2), y: tenth(cy - height / 2), width, height, rotation: 0, opacity: opacity / 100, ...stacking(false) }
    }
    editor.addStamp(stamp)
    if (stamp.category === "background" || (!at && !stamp.back)) {
        enterSelect(stamp.id)
    }
    return true
}

export function useStampTools() {
    const t = useTools()
    const owner = getEditor(t.ownerIndex)
    useSyncExternalStore(owner.subscribe, owner.getVersion, owner.getVersion)
    const selected = owner.doc.stamps.find((s) => s.id === t.selectedId) ?? null
    return {
        tool: t.tool, setTool,
        color: t.color,
        selected,
        placeStamp,
        removeSelected: () => {
            if (!selected) return
            owner.removeStamp(selected.id)
            leaveSelect()
        },
        flipLayer: () => selected && owner.restack(selected.id), // behind or in front of the drawing
    }
}

// saving to database

const snapshotOf = (editor) => ({ strokes: editor.doc.strokes, fills: editor.doc.fills, stamps: editor.doc.stamps })

const isSaved = (index) => {
    const saved = persist.saved[index]
    const doc = getEditor(index).doc
    return !!saved && saved.strokes === doc.strokes && saved.fills === doc.fills && saved.stamps === doc.stamps
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

// has this student already started on the drawing so a load from the database should not overwrite it
const started = (editor) => editor.doc.strokes.length || editor.doc.fills.length || editor.doc.stamps.length || editor.canUndo

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
            if (started(editor)) continue
        } else if (persist.remote[index] === raw) {
            continue // nothing new from this student
        }
        try {
            const doc = await unpackDrawing(row.drawing_data)
            // may have started drawing while this was unpacking
            if (index === persist.myIndex && started(editor)) continue
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

function traceFill(ctx, fill) {
    ctx.beginPath()
    for (const polygon of fill.poly) {
        for (const ring of polygon) {
            ring.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)))
            ctx.closePath()
        }
    }
}

// a fill is a polygon, drawn at its place in the stacking order
function drawFill(ctx, fill) {
    traceFill(ctx, fill)
    ctx.setAttr("globalAlpha", fill.opacity)
    ctx.setAttr("fillStyle", fill.color)
    ctx.fill()
}

// the same stamp as the Konva scene draws, for the plain canvases used to read the page
function drawStamp(ctx, s) {
    ctx.translate(s.x, s.y)
    ctx.rotate((s.rotation * Math.PI) / 180)
    ctx.setAttr("globalAlpha", s.opacity)
    if (s.kind === "shape") {
        traceShape(ctx, SHAPES[s.shape].path, s.width, s.height)
        ctx.setAttr("fillStyle", s.color)
        ctx.fill()
        return
    }
    const img = loadedStampImage(s.src)
    if (img) ctx.drawImage(img, 0, 0, s.width, s.height)
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

// erases everything drawn before it in the same layer
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
    // everything as it looks, in stacking order
    const [stackCanvas, stackCtx] = make()
    for (const item of interleave(doc.strokes, doc.stamps, doc.fills)) {
        stackCtx.save()
        if (item.group) drawStrokeGroup(stackCtx, item.group.strokes)
        else if (item.fill) drawFill(stackCtx, item.fill)
        else drawStamp(stackCtx, item.stamp)
        stackCtx.restore()
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
    pageCtx.drawImage(stackCanvas, 0, 0)
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

// Strokes, stamps and fills in the order they are drawn. Ones that share a place go by z
export function interleave(strokes, stamps, fills = []) {
    const lastIndex = new Map()
    strokes.forEach((s, i) => lastIndex.set(s.src ?? s.id, i))
    const placed = [...stamps.map((stamp) => ({ stamp, f: stamp })), ...fills.map((fill) => ({ fill, f: fill }))].map((p, n) => ({ ...p, n, at: p.f.back ? -1 : lastIndex.has(p.f.above) ? lastIndex.get(p.f.above) : Infinity }))
    const tier = (p) => (p.f.category === "background" ? 0 : 1)
    placed.sort((a, b) => tier(a) - tier(b) || (a.f.z ?? 0) - (b.f.z ?? 0) || a.n - b.n)
    const item = (p) => (p.stamp ? { stamp: p.stamp } : { fill: p.fill })
    const items = placed.filter((p) => p.at === -1).map(item)
    let i = 0
    for (const group of groupStrokes(strokes)) {
        const end = i + group.strokes.length - 1
        items.push({ group })
        for (const p of placed) if (p.at >= i && p.at <= end) items.push(item(p))
        i = end + 1
    }
    for (const p of placed) if (p.at === Infinity) items.push(item(p))
    return items
}

const KonvaScene = dynamic(
    () =>
        import("react-konva").then(({ Stage, Layer, Shape, Circle, Group, Image, Transformer }) => {
            function StampImage({ src, onLoaded, nodeRef, ...props }) {
                const [img, setImg] = useState(() => loadedStampImage(src))
                useEffect(() => {
                    let alive = true
                    loadStampImage(src).then(
                        (loaded) => {
                            if (!alive) return
                            setImg(loaded)
                            onLoaded()
                        },
                        () => { }
                    )
                    return () => {
                        alive = false
                    }
                }, [src])
                return img ? <Image ref={nodeRef} image={img} {...props} /> : null
            }

            function Scene({ width, height, scale, strokes, fills, stamps, selectedId, interactive, editable, tick, handlers, layerRef, overlayRef, trRef, ringRef, onReady, onStampLoaded, onStampEdit, onStampChange }) {
                useEffect(onReady, [])
                const nodes = useRef({}) // stamp id -> its Konva node
                const setNode = (id) => (node) => {
                    if (node) nodes.current[id] = node
                    else delete nodes.current[id]
                }
                const selected = stamps.find((s) => s.id === selectedId)

                // the resize / rotate handles follow the selected stamp
                useEffect(() => {
                    const tr = trRef.current
                    if (!tr) return
                    const node = interactive && selected ? nodes.current[selected.id] : null
                    tr.nodes(node ? [node] : [])
                    tr.getLayer()?.batchDraw()
                }, [selected, interactive, tick])

                // dragging can't carry a stamp's middle off the page, where it could no longer be picked up
                const keepOnPage = (e) => {
                    const n = e.target
                    const r = n.getClientRect({ relativeTo: n.getParent() })
                    const cx = r.x + r.width / 2
                    const cy = r.y + r.height / 2
                    const dx = Math.min(Math.max(cx, 0), width / scale) - cx
                    const dy = Math.min(Math.max(cy, 0), height / scale) - cy
                    if (dx || dy) n.position({ x: n.x() + dx, y: n.y() + dy })
                }

                const common = (s) => ({
                    id: s.id,
                    x: s.x,
                    y: s.y,
                    width: s.width,
                    height: s.height,
                    rotation: s.rotation,
                    opacity: s.opacity,
                    // Right-click opens a placed stamp for editing, and while one is open only it responds
                    listening: editable && (!interactive || s.id === selectedId),
                    draggable: interactive && (s.id === selectedId || s.category === "background"),
                    onContextMenu: (e) => {
                        e.evt.preventDefault()
                        onStampEdit(s.id)
                    },
                    onDragMove: keepOnPage,
                    onDragEnd: (e) => onStampChange(s.id, { x: tenth(e.target.x()), y: tenth(e.target.y()) }),
                    // the handles stretch the node with scaleX / scaleY, so turn that into a width and height
                    onTransformEnd: (e) => {
                        const n = e.target
                        const w = Math.max(MIN_STAMP, n.width() * n.scaleX())
                        const h = Math.max(MIN_STAMP, n.height() * n.scaleY())
                        n.scaleX(1)
                        n.scaleY(1)
                        onStampChange(s.id, { x: tenth(n.x()), y: tenth(n.y()), width: tenth(w), height: tenth(h), rotation: tenth(n.rotation()) })
                    },
                })

                const stampNode = (s) => {
                    if (s.kind === "image") return <StampImage key={s.id} src={s.src} onLoaded={onStampLoaded} nodeRef={setNode(s.id)} {...common(s)} />
                    const def = SHAPES[s.shape]
                    return (
                        <Shape
                            key={s.id}
                            ref={setNode(s.id)}
                            {...common(s)}
                            fill={s.color}
                            sceneFunc={(ctx, shape) => {
                                traceShape(ctx, def.path, s.width, s.height)
                                ctx.fillStrokeShape(shape)
                            }}
                        />
                    )
                }

                const isImage = selected?.kind === "image"
                return (
                    <Stage width={width} height={height} scaleX={scale} scaleY={scale} {...handlers}>
                        <Layer ref={layerRef}>
                            {interleave(strokes, stamps, fills).map((item) =>
                                item.stamp ? (
                                    stampNode(item.stamp)
                                ) : item.fill ? (
                                    <Shape key={item.fill.id} listening={false} sceneFunc={(ctx) => drawFill(ctx, item.fill)} />
                                ) : (
                                    <Shape key={item.group.key} listening={false} sceneFunc={(ctx) => drawStrokeGroup(ctx, item.group.strokes)} />
                                )
                            )}
                        </Layer>
                        <Layer ref={overlayRef}>
                            <Group ref={ringRef} visible={false} listening={false}>
                                <Circle stroke="#ffffff" strokeWidth={3.5 / scale} listening={false} />
                                <Circle stroke="#1f2a52" strokeWidth={1.5 / scale} listening={false} />
                            </Group>
                            <Transformer
                                ref={trRef}
                                keepRatio={isImage}
                                enabledAnchors={isImage ? ["top-left", "top-right", "bottom-left", "bottom-right"] : undefined}
                                rotationSnaps={[0, 90, 180, 270]}
                                anchorSize={12}
                                anchorCornerRadius={3}
                                anchorStroke="#1f2a52"
                                anchorFill="#ffffff"
                                borderStroke="#1f2a52"
                                boundBoxFunc={(oldBox, newBox) => (Math.abs(newBox.width) < 20 || Math.abs(newBox.height) < 20 ? oldBox : newBox)}
                            />
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
    const { strokes, fills, stamps, canvas } = editor.doc
    const size = BRUSH_SIZES[tools.sizeIndex]
    const interactive = editable && tools.tool === "select" // stamps can only be grabbed with the select tool, so they don't get in the way of drawing

    const wrapRef = useRef(null)
    const layerRef = useRef(null)
    const overlayRef = useRef(null)
    const trRef = useRef(null)
    const ringRef = useRef(null)
    const drawing = useRef(false)
    const [scale, setScale] = useState(0.7)
    const [ready, setReady] = useState(false)
    const [tick, setTick] = useState(0)
    const latest = useRef({})
    latest.current = { scale, strokes, fills, stamps, pageIndex, end: null }

    useEffect(() => {
        const el = wrapRef.current
        const fit = () => {
            const fitted = Math.min(el.clientWidth / canvas.width, el.clientHeight / canvas.height)
            const device = (window.devicePixelRatio || 1) * (el.getBoundingClientRect().width / el.clientWidth || 1)
            setScale(fitted)
            for (const layer of [layerRef, overlayRef].map((r) => r.current)) {
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
            const { scale: s, strokes: list, fills: filled, stamps: placed, pageIndex: page } = latest.current
            const layer = layerRef.current
            if (!layer) return
            layer.draw()
            let url = null
            if (list.length || filled.length || placed.length) {
                const overlay = overlayRef.current
                overlay?.visible(false) // the brush ring and the resize handles are not part of the picture
                try {
                    url = layer.getStage().toDataURL({ pixelRatio: 1 / s, mimeType: "image/png" })
                } finally {
                    overlay?.visible(true)
                    overlay?.batchDraw()
                }
            }
            snapshotStore.set((prev) => ((prev[page] ?? null) === url ? prev : { ...prev, [page]: url }))
        })
        return () => cancelAnimationFrame(id)
    }, [strokes, fills, stamps, tick, ready])

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

    // Delete removes the stamp being edited, Escape or Enter finishes with it
    useEffect(() => {
        if (!editable) return
        const onKey = (e) => {
            const { selectedId } = toolStore.get()
            if (!selectedId) return
            const el = e.target
            if (el instanceof HTMLElement && (el.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(el.tagName))) return
            if (e.key === "Delete" || e.key === "Backspace") {
                e.preventDefault()
                editor.removeStamp(selectedId)
                leaveSelect()
            } else if (e.key === "Escape" || e.key === "Enter") {
                leaveSelect()
            }
        }
        window.addEventListener("keydown", onKey)
        return () => window.removeEventListener("keydown", onKey)
    }, [editable, editor])

    // a selected shape follows the colour and transparency controls
    const lastLook = useRef({ color: tools.color, opacity: tools.opacity })
    useEffect(() => {
        const prev = lastLook.current
        lastLook.current = { color: tools.color, opacity: tools.opacity }
        if (!editable || tools.tool !== "select" || !tools.selectedId) return
        const stamp = editor.doc.stamps.find((s) => s.id === tools.selectedId)
        if (!stamp || stamp.kind !== "shape") return
        const patch = {}
        if (tools.color !== prev.color) patch.color = tools.color
        if (tools.opacity !== prev.opacity) patch.opacity = tools.opacity / 100
        if (Object.keys(patch).length) editor.updateStamp(stamp.id, patch, true)
    }, [tools.color, tools.opacity])

    const pos = (e) => {
        const p = e.target.getStage().getPointerPosition()
        return p && { x: p.x / scale, y: p.y / scale }
    }

    const down = (e) => {
        if (!editable || e.evt.button > 0) return // right-click is for editing stamps, not drawing
        if (tools.tool === "select") {
            // a press anywhere but the stamp being edited finishes the edit
            if (e.target === e.target.getStage()) leaveSelect()
            return
        }
        const p = pos(e)
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

    // dropping a stamp or shape dragged out of the side panel
    const dragOver = (e) => {
        if (!editable || !Array.from(e.dataTransfer.types).includes(STAMP_DRAG)) return
        e.preventDefault()
        e.dataTransfer.dropEffect = "copy"
    }

    const drop = (e) => {
        const raw = editable && e.dataTransfer.getData(STAMP_DRAG)
        const rect = layerRef.current?.getStage().container().getBoundingClientRect()
        if (!raw || !rect) return
        e.preventDefault()
        let spec
        try {
            spec = JSON.parse(raw)
        } catch {
            return
        }
        const k = rect.width / canvas.width
        const x = (e.clientX - rect.left) / k
        const y = (e.clientY - rect.top) / k
        if (x < 0 || y < 0 || x > canvas.width || y > canvas.height) return
        placeStamp(spec, { x, y }, pageIndex)
    }

    return (
        <div ref={wrapRef} onDragOver={dragOver} onDrop={drop} className="flex h-full w-full touch-none items-center justify-center overflow-hidden" style={{ cursor: editable && ringTools.includes(tools.tool) ? "none" : editable && tools.tool === "fill" ? "crosshair" : "default" }}>
            <KonvaScene
                width={canvas.width * scale}
                height={canvas.height * scale}
                scale={scale}
                strokes={strokes}
                fills={fills}
                stamps={stamps}
                selectedId={interactive ? tools.selectedId : null}
                interactive={interactive}
                editable={editable}
                tick={tick}
                handlers={{ onMouseDown: down, onTouchStart: down, onMouseMove: move, onTouchMove: move, onMouseUp: end, onTouchEnd: end, onMouseLeave: () => showRing(null) }}
                layerRef={layerRef}
                overlayRef={overlayRef}
                trRef={trRef}
                ringRef={ringRef}
                onReady={() => setReady(true)}
                onStampLoaded={() => setTick((t) => t + 1)}
                onStampEdit={enterSelect}
                onStampChange={(id, patch) => editor.updateStamp(id, patch)}
            />
        </div>
    )
}