import DrawingAssetPanel from "./DrawingAssetPanel"
import DrawingControlsPanel from "./DrawingControlsPanel"
import DrawingSurface from "./DrawingSurface"
import "./drawing-workspace.css"

export default function DrawingWorkspace({ studentId, owned }: { studentId: string; owned: boolean }) {
  return <div className="story-drawing-layout">
    <DrawingAssetPanel />
    <DrawingSurface studentId={studentId} owned={owned} />
    <DrawingControlsPanel />
    <p className="drawing-sr-only">The drawing surface is a placeholder. Save and the save status refer to existing story text; drawings cannot be edited or saved yet.</p>
  </div>
}
