import polygonClipping from "polygon-clipping"

const UNIT = 10
const tenth = (v) => Math.round(v * UNIT) / UNIT

const TRACE_TOLERANCE = 0.7 // how much the traced outline may drift from the pixel edges
const TIDY_TOLERANCE = 0.25 // cleanup after the eraser has cut a fill
const MIN_AREA = 1.5 // rings smaller than this are dropped such as specks left over from erasing
const COLOR_TOLERANCE = 32 // how far a pixel's colour may differ and still count as the same colour
const SNAP_RADIUS = 3 // clicking on a line's soft edge looks for plain paper this close by
const ARC_STEPS = 10 // segments per half circle on the eraser capsule

// bounds

const boundsCache = new WeakMap()

export function polyBounds(poly) {
    let b = boundsCache.get(poly)
    if (!b) {
        b = { minX: Infinity, minY: Infinity, maxX: -Infinity, maxY: -Infinity }
        for (const polygon of poly) {
            for (const [x, y] of polygon[0] ?? []) {
                if (x < b.minX) b.minX = x
                if (x > b.maxX) b.maxX = x
                if (y < b.minY) b.minY = y
                if (y > b.maxY) b.maxY = y
            }
        }
        boundsCache.set(poly, b)
    }
    return b
}

const apart = (a, b) => a.maxX < b.minX || a.minX > b.maxX || a.maxY < b.minY || a.minY > b.maxY

// ring helpers

const flatten = (ring) => ring.flatMap(([x, y]) => [x, y])

const pairs = (flat) => {
    const out = []
    for (let i = 0; i < flat.length; i += 2) out.push([flat[i], flat[i + 1]])
    return out
}

const ringArea = (flat) => {
    let a = 0
    const n = flat.length / 2
    for (let i = 0; i < n; i++) {
        const j = (i + 1) % n
        a += flat[2 * i] * flat[2 * j + 1] - flat[2 * j] * flat[2 * i + 1]
    }
    return Math.abs(a) / 2
}

const pointSegDist2 = (px, py, ax, ay, bx, by) => {
    const dx = bx - ax
    const dy = by - ay
    const l2 = dx * dx + dy * dy
    const t = l2 === 0 ? 0 : Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / l2))
    return (px - ax - t * dx) ** 2 + (py - ay - t * dy) ** 2
}

// Douglas-Peucker for a closed ring
function simplifyClosed(flat, tol) {
    const n = flat.length / 2
    if (n <= 4 || tol <= 0) return flat
    let far = 0
    let farD = -1
    for (let i = 1; i < n; i++) {
        const d = (flat[2 * i] - flat[0]) ** 2 + (flat[2 * i + 1] - flat[1]) ** 2
        if (d > farD) [farD, far] = [d, i]
    }
    const P = [...flat, flat[0], flat[1]] // wrap around so the second half ends back at the start
    const keep = new Uint8Array(n + 1)
    keep[0] = keep[far] = keep[n] = 1
    const stack = [[0, far], [far, n]]
    while (stack.length) {
        const [s, e] = stack.pop()
        let maxD = 0
        let idx = -1
        for (let i = s + 1; i < e; i++) {
            const d = pointSegDist2(P[2 * i], P[2 * i + 1], P[2 * s], P[2 * s + 1], P[2 * e], P[2 * e + 1])
            if (d > maxD) [maxD, idx] = [d, i]
        }
        if (idx !== -1 && maxD > tol * tol) {
            keep[idx] = 1
            stack.push([s, idx], [idx, e])
        }
    }
    const out = []
    for (let i = 0; i < n; i++) if (keep[i]) out.push(P[2 * i], P[2 * i + 1])
    return out
}

// simplifies a polygon, rounds to the stored precision, drops specks, and closes the rings
export function tidyPoly(poly, tol = TIDY_TOLERANCE) {
    const clean = (ring) => {
        const flat = simplifyClosed(flatten(ring), tol).map(tenth)
        const out = []
        for (let i = 0; i < flat.length; i += 2) {
            const n = out.length
            if (n && out[n - 2] === flat[i] && out[n - 1] === flat[i + 1]) continue
            out.push(flat[i], flat[i + 1])
        }
        if (out.length >= 4 && out[0] === out[out.length - 2] && out[1] === out[out.length - 1]) out.length -= 2
        if (out.length < 6 || ringArea(out) < MIN_AREA) return null
        return [...pairs(out), [out[0], out[1]]]
    }
    const out = []
    for (const polygon of poly) {
        const [outer, ...holes] = polygon.map(clean)
        if (outer) out.push([outer, ...holes.filter(Boolean)])
    }
    return out
}

export function tidyFill(fill, tol) {
    const poly = tidyPoly(fill.poly, tol)
    return poly.length ? { ...fill, poly } : null
}

// every touching pixel that is nearly the colour of the start pixel
function floodByColor(rgba, w, h, sx, sy) {
    const region = new Uint8Array(w * h)
    const base = (sy * w + sx) * 4
    const [r0, g0, b0] = [rgba[base], rgba[base + 1], rgba[base + 2]]
    const blocked = (x, y) => {
        const i = y * w + x
        if (region[i]) return true
        const p = i * 4
        return Math.abs(rgba[p] - r0) > COLOR_TOLERANCE || Math.abs(rgba[p + 1] - g0) > COLOR_TOLERANCE || Math.abs(rgba[p + 2] - b0) > COLOR_TOLERANCE
    }
    const stack = [sx, sy]
    while (stack.length) {
        const y = stack.pop()
        const x = stack.pop()
        if (blocked(x, y)) continue
        let l = x
        let r = x
        while (l > 0 && !blocked(l - 1, y)) l--
        while (r < w - 1 && !blocked(r + 1, y)) r++
        for (let i = l; i <= r; i++) region[y * w + i] = 1
        for (const ny of [y - 1, y + 1]) {
            if (ny < 0 || ny >= h) continue
            let open = false
            for (let i = l; i <= r; i++) {
                const free = !blocked(i, ny)
                if (free && !open) stack.push(i, ny)
                open = free
            }
        }
    }
    return region
}

// grows the area by one pixel into the pixels allow
function grow(region, w, h, allow) {
    const out = region.slice()
    for (let y = 0; y < h; y++) {
        for (let x = 0; x < w; x++) {
            const i = y * w + x
            if (region[i] || !allow(i)) continue
            if ((x > 0 && region[i - 1]) || (x < w - 1 && region[i + 1]) || (y > 0 && region[i - w]) || (y < h - 1 && region[i + w])) out[i] = 1
        }
    }
    return out
}

// walks the boundary pixel edges and returns flat rings
function traceRings(region, w, h) {
    const W1 = w + 1
    const edges = new Uint8Array(W1 * (h + 1))
    for (let y = 0; y < h; y++) {
        for (let x = 0; x < w; x++) {
            const i = y * w + x
            if (!region[i]) continue
            const v = y * W1 + x
            if (y === 0 || !region[i - w]) edges[v] |= 1
            if (x === w - 1 || !region[i + 1]) edges[v + 1] |= 2
            if (y === h - 1 || !region[i + w]) edges[v + W1 + 1] |= 4
            if (x === 0 || !region[i - 1]) edges[v + W1] |= 8
        }
    }
    const step = [1, W1, -1, -W1]
    // where two outlines touch at a corner, turn right first so they stay separate rings
    const pick = (v, d) => [(d + 1) & 3, d, (d + 3) & 3].find((nd) => edges[v] & (1 << nd)) ?? -1
    const rings = []
    for (let v0 = 0; v0 < edges.length; v0++) {
        while (edges[v0]) {
            let d0 = 0
            while (!(edges[v0] & (1 << d0))) d0++
            const ring = []
            let v = v0
            let d = d0
            let prev = -1
            do {
                if (d !== prev) ring.push(v % W1, (v / W1) | 0)
                prev = d
                const from = v
                v += step[d]
                const next = pick(v, d)
                if (!(from === v0 && d === d0)) edges[from] &= ~(1 << d)
                d = next
            } while (!(v === v0 && d === d0) && d !== -1)
            edges[v0] &= ~(1 << d0)
            if (ring.length >= 6) rings.push(ring)
        }
    }
    return rings
}

// where to start
function startPixel(ink, w, h, x, y) {
    const px = Math.floor(x)
    const py = Math.floor(y)
    if (px < 0 || py < 0 || px >= w || py >= h) return null
    if (!ink[py * w + px]) return [px, py]
    let best = [px, py]
    let bestD = Infinity
    for (let dy = -SNAP_RADIUS; dy <= SNAP_RADIUS; dy++) {
        for (let dx = -SNAP_RADIUS; dx <= SNAP_RADIUS; dx++) {
            const nx = px + dx
            const ny = py + dy
            if (nx < 0 || ny < 0 || nx >= w || ny >= h || ink[ny * w + nx]) continue
            const d = dx * dx + dy * dy
            if (d < bestD) [bestD, best] = [d, [nx, ny]]
        }
    }
    return best
}

// The area a bucket click at (x, y) would fill
export function regionFromImage(rgba, ink, width, height, x, y) {
    const w = Math.round(width)
    const h = Math.round(height)
    const start = startPixel(ink, w, h, x, y)
    if (!start) return null
    const found = floodByColor(rgba, w, h, start[0], start[1])
    const region = grow(grow(found, w, h, () => true), w, h, (i) => ink[i] > 0)
    const rings = traceRings(region, w, h).map((r) => pairs(simplifyClosed(r, TRACE_TOLERANCE)))
    if (!rings.length) return null
    // outlines and holes are all rings here; xor (even-odd) turns them into polygons with holes
    const poly = polygonClipping.xor(...rings.map((r) => [[r]]))
    const clean = tidyPoly(poly, 0)
    return clean.length ? clean : null
}

// a new fill replaces whatever colour was already in that area
export function subtractRegion(fills, region) {
    const b = polyBounds(region)
    const out = []
    for (const f of fills) {
        if (apart(polyBounds(f.poly), b)) {
            out.push(f)
            continue
        }
        let cut = null
        try {
            cut = polygonClipping.difference(f.poly, region)
        } catch (e) {
            out.push(f)
            continue
        }
        const next = tidyFill({ ...f, poly: cut })
        if (next) out.push(next)
    }
    return out
}

// eraser

// the area swept by a circle of radius r moving from (x0, y0) to (x1, y1)
function capsule(x0, y0, x1, y1, r) {
    const ring = []
    const len = Math.hypot(x1 - x0, y1 - y0)
    if (len < 1e-6) {
        for (let k = 0; k < ARC_STEPS * 2; k++) {
            const a = (Math.PI * k) / ARC_STEPS
            ring.push([x0 + r * Math.cos(a), y0 + r * Math.sin(a)])
        }
    } else {
        const dir = Math.atan2(y1 - y0, x1 - x0)
        for (let k = 0; k <= ARC_STEPS; k++) {
            const a = dir - Math.PI / 2 + (Math.PI * k) / ARC_STEPS
            ring.push([x1 + r * Math.cos(a), y1 + r * Math.sin(a)])
        }
        for (let k = 0; k <= ARC_STEPS; k++) {
            const a = dir + Math.PI / 2 + (Math.PI * k) / ARC_STEPS
            ring.push([x0 + r * Math.cos(a), y0 + r * Math.sin(a)])
        }
    }
    return [[ring]]
}

const crosses = (ax, ay, bx, by, cx, cy, dx, dy) => {
    const o = (px, py, qx, qy, rx, ry) => Math.sign((qx - px) * (ry - py) - (qy - py) * (rx - px))
    return o(ax, ay, bx, by, cx, cy) * o(ax, ay, bx, by, dx, dy) < 0 && o(cx, cy, dx, dy, ax, ay) * o(cx, cy, dx, dy, bx, by) < 0
}

// quick check so a fill the eraser only passes near is left untouched
function touches(poly, x0, y0, x1, y1, r) {
    let inside = false
    for (const polygon of poly) {
        for (const ring of polygon) {
            for (let k = 0; k < ring.length; k++) {
                const [ax, ay] = ring[k]
                const [bx, by] = ring[(k + 1) % ring.length]
                if (
                    crosses(ax, ay, bx, by, x0, y0, x1, y1) ||
                    pointSegDist2(ax, ay, x0, y0, x1, y1) <= r * r ||
                    pointSegDist2(bx, by, x0, y0, x1, y1) <= r * r ||
                    pointSegDist2(x0, y0, ax, ay, bx, by) <= r * r ||
                    pointSegDist2(x1, y1, ax, ay, bx, by) <= r * r
                ) return true
                if (ay > y0 !== by > y0 && x0 < ax + ((y0 - ay) / (by - ay)) * (bx - ax)) inside = !inside
            }
        }
    }
    return inside // the eraser started inside a fill without touching its edge
}

export function eraseFills(fills, x0, y0, x1, y1, r) {
    if (!fills.length) return fills
    const reach = { minX: Math.min(x0, x1) - r, maxX: Math.max(x0, x1) + r, minY: Math.min(y0, y1) - r, maxY: Math.max(y0, y1) + r }
    const cutter = capsule(x0, y0, x1, y1, r)
    let out = null
    fills.forEach((f, i) => {
        if (apart(polyBounds(f.poly), reach) || !touches(f.poly, x0, y0, x1, y1, r)) return out?.push(f)
        let cut
        try {
            cut = polygonClipping.difference(f.poly, cutter)
        } catch (e) {
            return out?.push(f)
        }
        out ??= fills.slice(0, i)
        if (cut.length) out.push({ ...f, poly: cut })
    })
    return out ?? fills
}