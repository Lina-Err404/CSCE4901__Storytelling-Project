"use client"

import { useEffect, useState } from "react"
import { loadStamp as loadDrawingImage, loadedStamp as loadedDrawingImage, type StampAsset } from "./drawingStamps"

/** A CSS image below the transparent foreground; destination-out never touches it. */
export default function DrawingBackground({ asset }: { asset: StampAsset | null }) {
  const [result, setResult] = useState<{ src: string; error: boolean } | null>(null)
  const [attempt, retry] = useState(0)
  useEffect(() => {
    let cancelled = false
    if (asset) loadDrawingImage(asset.src).then(() => {
      if (!cancelled) setResult({ src: asset.src, error: false })
    }).catch(() => { if (!cancelled) setResult({ src: asset.src, error: true }) })
    return () => { cancelled = true }
  }, [asset, attempt])
  const current = result?.src === asset?.src ? result : null
  const ready = Boolean(asset && (loadedDrawingImage(asset.src) || (current && !current.error)))
  return <>
    <div className="drawing-background-layer" aria-hidden="true" data-background={asset?.src ?? "white"}
      style={{ backgroundImage: asset && ready ? `url(${JSON.stringify(asset.src)})` : undefined }} />
    {asset && !ready && <span className="drawing-background-status" role="status">
      {current?.error ? <>Background could not load. <button type="button" onClick={() => retry(value => value + 1)}>Retry background</button></> : "Loading background..."}
    </span>}
  </>
}
