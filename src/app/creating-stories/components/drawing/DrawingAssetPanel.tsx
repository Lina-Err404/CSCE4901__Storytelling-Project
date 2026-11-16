"use client"

import { useState } from "react"
import Image from "next/image"
import { ChevronLeft, ChevronRight } from "lucide-react"
import { PointedBanner } from "../StoryDecorations"
import { DrawingPanelFrame } from "./DrawingDecorations"
import { drawingAssets } from "./drawingAssets"

type Group = "shapes" | "stamps" | "background"

export default function DrawingAssetPanel() {
  const [group, setGroup] = useState<Group>("shapes")
  const [page, setPage] = useState(0)
  const assets = drawingAssets[group]

  function browse(next: Group) {
    if (next === group) return
    setGroup(next); setPage(0)
  }
  const visible = assets.slice(page * 8, page * 8 + 8)
  return <aside className="drawing-panel drawing-assets" aria-label="Drawing assets">
    <DrawingPanelFrame />
    <div className="drawing-asset-tabs" role="group" aria-label="Asset category">
      <div>{(["shapes", "stamps"] as const).map((category) => <button type="button" key={category} aria-pressed={group === category}
        onClick={() => browse(category)}>{category === "shapes" ? "Shapes" : "Stamps"}</button>)}</div>
    </div>
    <div className="drawing-background-selector">
      <button type="button" aria-label="Previous asset page" disabled={page === 0} onClick={() => setPage((current) => current - 1)}><ChevronLeft aria-hidden="true" /></button>
      <PointedBanner compact><button type="button" aria-label="Browse backgrounds" aria-pressed={group === "background"}
        title="Browse backgrounds; placing assets is coming soon" onClick={() => browse("background")}>Background</button></PointedBanner>
      <button type="button" aria-label="Next asset page" disabled={(page + 1) * 8 >= assets.length} onClick={() => setPage((current) => current + 1)}><ChevronRight aria-hidden="true" /></button>
    </div>
    <div className="drawing-asset-frame">
      <div className="drawing-asset-grid" role="list" aria-label={`${group === "background" ? "Background" : group === "stamps" ? "Stamp" : "Shape"} previews`}>
        {Array.from({ length: 8 }, (_, index) => <div className="drawing-asset-slot" role="listitem" key={visible[index]?.src ?? index}
          title={visible[index] ? "Preview only; placing assets is coming soon" : "Asset slot; coming soon"}>
          {visible[index] && <Image src={visible[index].src} alt={visible[index].name} width={120} height={120} unoptimized />}
        </div>)}
      </div>
    </div>
    <p className="drawing-sr-only" role="status">{group === "shapes" ? "Shape assets are coming soon." : `${assets.length} available ${group} previews. Placing assets is coming soon.`}</p>
  </aside>
}
