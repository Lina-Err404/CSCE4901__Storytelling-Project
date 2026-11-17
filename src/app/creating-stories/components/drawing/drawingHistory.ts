import type { DrawingStroke } from "./drawingModel"

export type DrawingAction = { type: "stroke"; stroke: DrawingStroke } | { type: "clear" }
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
    else strokes.push(action.stroke)
  }
  return strokes
}
