import type { ReactNode } from "react"

// Accessible HTML controls sit above these decorative SVG outlines.
export function ToolbarFrame() {
  return <svg className="story-frame" viewBox="0 0 1670 112" preserveAspectRatio="none" aria-hidden="true">
    <path d="M3 3H1667V65C1639 65 1618 84 1618 109H52C52 84 31 65 3 65Z" />
  </svg>
}
export function PanelFrame() {
  return <svg className="story-frame" viewBox="0 0 402 884" preserveAspectRatio="none" aria-hidden="true">
    <path d="M2 2H353C353 29 376 50 400 50V833C376 833 353 855 353 882H2Z" />
  </svg>
}
export function PointedBanner({ children, className = "", wide = false, compact = false }: { children: ReactNode; className?: string; wide?: boolean; compact?: boolean }) {
  return <div className={`story-banner ${className}`}>
    <svg className="story-frame" viewBox={wide ? "0 0 950 70" : compact ? "0 0 330 56" : "0 0 600 70"} preserveAspectRatio="none" aria-hidden="true">
      <path d={wide ? "M40 2H906L948 35 906 68H40L2 35Z" : compact ? "M26 2H304L328 28 304 54H26L2 28Z" : "M26 2H572L598 35 572 68H26L2 35Z"} />
    </svg>
    {children}
  </div>
}

