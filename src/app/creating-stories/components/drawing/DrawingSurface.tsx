// The previous DrawingBody is an empty placeholder and SetItem supplies drawing:null.
// Keep this boundary isolated until a real editor and drawing persistence exist.
export default function DrawingSurface({ studentId, owned }: { studentId: string; owned: boolean }) {
  return <div className="drawing-surface" role="img" data-student={studentId} data-readonly={!owned}
    aria-label={`${owned ? "Your" : `${studentId}’s`} drawing page; drawing canvas coming soon`} />
}
