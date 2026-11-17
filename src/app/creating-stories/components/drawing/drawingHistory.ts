import type { DrawingStroke } from "./drawingModel"
import type { StampAsset } from "./drawingStamps"

export type DrawingAction = { type: "stroke"; stroke: DrawingStroke } | { type: "clear" } | { type: "background"; asset: StampAsset | null }
export type DrawingHistory = { actions: readonly DrawingAction[]; cursor: number }
export const emptyHistory: DrawingHistory = { actions: [], cursor: 0 }

export function recordAction(history: DrawingHistory, action: DrawingAction): DrawingHistory {
  const actions = [...history.actions.slice(0, history.cursor), action]
  return { actions, cursor: actions.length }
}

export function replayHistory(history: DrawingHistory): readonly DrawingStroke[] {
  let strokes: DrawingStroke[] = []
  for (const action of history.actions.slice(0, history.cursor)) {
    if (action.type === "clear") strokes = []
    else if (action.type === "stroke") strokes.push(action.stroke)
  }
  return strokes
}

export function replayBackground(history: DrawingHistory): StampAsset | null {
  let background: StampAsset | null = null
  for (const action of history.actions.slice(0, history.cursor)) {
    if (action.type === "background") background = action.asset
  }
  return background
}
