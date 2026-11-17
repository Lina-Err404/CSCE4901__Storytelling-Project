import { NextRequest, NextResponse } from "next/server"
import { adminAuth, db } from "@/lib/firebaseAdmin"
import { readDrawingDocument } from "@/src/app/creating-stories/components/drawing/drawingDocument"

export const runtime = "nodejs"
async function identity(request: NextRequest) {
  const token = request.headers.get("authorization")?.match(/^Bearer ([^\s]+)$/i)?.[1]
  if (!token) throw new Error("unauthorized")
  try {
    const claims = await adminAuth.verifyIdToken(token, true)
    if (!/^[A-Za-z0-9_-]{1,128}$/.test(claims.uid)) throw new Error()
    return { studentId: claims.uid, pageId: "drawing", storyId: null }
  } catch { throw new Error("unauthorized") }
}
function failure(error: unknown) {
  const message = error instanceof Error ? error.message : ""
  const status = message === "unauthorized" ? 401 : message === "conflict" ? 409 : message === "invalid" ? 400 : 503
  return NextResponse.json({ error: status === 401 ? "Sign in to save your page." : status === 409 ? "This page changed in another tab. Reload before saving again." : status === 400 ? "Invalid or oversized story data." : "Could not access your saved page. Please retry." }, { status })
}
export async function GET(request: NextRequest) {
  try {
    const owner = await identity(request)
    const textRef = db.collection("items").doc(owner.studentId)
    const drawingRef = textRef.collection("drawingPages").doc(owner.pageId)
    const result = await db.runTransaction(async tx => {
      const text = await tx.get(textRef), drawing = await tx.get(drawingRef)
      const data = drawing.data()
      return { text: text.data()?.name ?? "", drawing: data ? readDrawingDocument(data.drawing, owner) : null, revision: data?.revision ?? 0 }
    })
    return NextResponse.json(result, { headers: { "Cache-Control": "private, no-store" } })
  } catch (error) { return failure(error) }
}
export async function PUT(request: NextRequest) {
  try {
    const owner = await identity(request)
    if (Number(request.headers.get("content-length")) > 800_000) return NextResponse.json({ error: "Story data exceeds the save limit." }, { status: 413 })
    const raw = await request.text()
    if (new TextEncoder().encode(raw).length > 800_000) throw new Error("invalid")
    let body, drawing
    try {
      body = JSON.parse(raw)
      if (!body || Object.keys(body).some(key => !["text", "drawing", "revision"].includes(key)) || typeof body.text !== "string" || body.text.length > 100_000 || !Number.isSafeInteger(body.revision) || body.revision < 0) throw new Error()
      drawing = readDrawingDocument(body.drawing, owner)
    } catch { throw new Error("invalid") }
    const textRef = db.collection("items").doc(owner.studentId)
    const drawingRef = textRef.collection("drawingPages").doc(owner.pageId)
    const revision = await db.runTransaction(async tx => {
      const existing = await tx.get(drawingRef)
      if ((existing.data()?.revision ?? 0) !== body.revision) throw new Error("conflict")
      tx.set(textRef, { name: body.text }, { merge: true })
      tx.set(drawingRef, { drawing, revision: body.revision + 1 })
      return body.revision + 1
    })
    return NextResponse.json({ revision })
  } catch (error) { return failure(error) }
}
