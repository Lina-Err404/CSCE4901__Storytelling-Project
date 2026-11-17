import type { DrawingPoint } from "./drawingModel"

export type StampAsset = { src: string; name: string }
export type StampGeometry = { assetId: string; src: string; x: number; y: number; width: number; height: number; aspectRatio: number }
const images = new Map<string, { image: HTMLImageElement; ready: boolean; promise: Promise<HTMLImageElement> }>()

export function loadedStamp(src: string) { const entry = images.get(src); return entry?.ready ? entry.image : undefined }
export function loadStamp(src: string): Promise<HTMLImageElement> {
  const existing = images.get(src)
  if (existing) return existing.promise
  const image = new Image()
  const entry = { image, ready: false, promise: Promise.resolve(image) }
  entry.promise = new Promise((resolve, reject) => {
    image.onload = () => {
      if (!image.naturalWidth || !image.naturalHeight) { images.delete(src); reject(new Error("Empty stamp image")); return }
      entry.ready = true; image.onload = null; image.onerror = null; resolve(image)
    }
    image.onerror = () => { images.delete(src); image.onload = null; image.onerror = null; reject(new Error("Stamp image could not load")) }
  })
  images.set(src, entry)
  image.src = src
  return entry.promise
}

export function stampGeometry(asset: StampAsset, ratio: number, start: DrawingPoint, end: DrawingPoint, width: number, height: number, hover = false): StampGeometry {
  const dx = (end.x - start.x) * width, dy = (end.y - start.y) * height
  const click = Math.hypot(dx, dy) < 4
  let w = click ? Math.min(120, 120 * ratio) : Math.max(Math.abs(dx), Math.abs(dy) * ratio)
  let h = w / ratio
  const scale = Math.min(1, 512 / Math.max(w, h), width * .9 / w, height * .9 / h)
  w *= scale; h *= scale
  const grow = Math.max(1, Math.min(16, width, height) / Math.max(w, h))
  w *= grow; h *= grow
  let x = start.x * width - (click || hover ? w / 2 : dx < 0 ? w : 0)
  let y = start.y * height - (click || hover ? h / 2 : dy < 0 ? h : 0)
  x = Math.max(0, Math.min(width - w, x)); y = Math.max(0, Math.min(height - h, y))
  return { assetId: asset.src, src: asset.src, x: x / width, y: y / height, width: w / width, height: h / height, aspectRatio: ratio }
}

export function renderStamp(ctx: CanvasRenderingContext2D, stamp: StampGeometry, width: number, height: number) {
  const image = loadedStamp(stamp.src)
  if (!image) return
  // Fit the normalized box without stretching the original image on aspect-ratio changes.
  const w = Math.min(stamp.width * width, stamp.height * height * stamp.aspectRatio)
  ctx.drawImage(image, stamp.x * width, stamp.y * height, w, w / stamp.aspectRatio)
}
