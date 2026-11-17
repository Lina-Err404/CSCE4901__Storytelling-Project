"use client"

import { useId, useLayoutEffect, useRef } from "react"

export default function ClearDrawingDialog({ onCancel, onConfirm }: { onCancel: () => void; onConfirm: () => void }) {
  const ref = useRef<HTMLDialogElement>(null)
  const titleId = useId(), descriptionId = useId()
  useLayoutEffect(() => {
    const dialog = ref.current
    if (!dialog || dialog.open) return
    // Native modal provides focus trapping, Escape, and a top-layer backdrop.
    if (dialog.showModal) dialog.showModal()
    else dialog.setAttribute("open", "") // Non-browser test environments.
  }, [])
  return <dialog ref={ref} className="drawing-clear-dialog" aria-labelledby={titleId} aria-describedby={descriptionId}
    onCancel={(event) => { event.preventDefault(); onCancel() }}>
    <h2 id={titleId}>Clear this page?</h2>
    <p id={descriptionId}>This will erase all drawings on the current page. You can undo this action.</p>
    <div><button type="button" autoFocus onClick={onCancel}>Cancel</button><button type="button" onClick={onConfirm}>Delete All</button></div>
  </dialog>
}
