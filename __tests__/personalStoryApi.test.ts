/** @jest-environment node */
import { NextRequest } from "next/server"
import { GET, PUT } from "../src/app/api/personal-story/route"
import { createDrawingDocument } from "../src/app/creating-stories/components/drawing/drawingDocument"
import { adminAuth, db } from "@/lib/firebaseAdmin"

jest.mock("@/lib/firebaseAdmin", () => ({ adminAuth: { verifyIdToken: jest.fn() }, db: { collection: jest.fn(), runTransaction: jest.fn() } }))
const records = new Map<string, Record<string, unknown>>()
type Ref = { path: string; doc: (id: string) => Ref; collection: (id: string) => Ref }
const ref: (path: string) => Ref = (path) => ({ path, doc: id => ref(`${path}/${id}`), collection: id => ref(`${path}/${id}`) })
beforeEach(() => {
  records.clear(); jest.clearAllMocks()
  ;(adminAuth.verifyIdToken as jest.Mock).mockImplementation(async token => { if (token === "invalid") throw new Error(); return { uid: token } })
  ;(db.collection as jest.Mock).mockImplementation(ref)
  ;(db.runTransaction as jest.Mock).mockImplementation(async work => {
    const writes: [string, Record<string, unknown>, boolean][] = []
    const result = await work({ get: async (target: { path: string }) => ({ data: () => records.get(target.path) }), set: (target: { path: string }, value: Record<string, unknown>, options?: { merge: boolean }) => { writes.push([target.path, value, Boolean(options?.merge)]) } })
    writes.forEach(([path, value, merge]) => records.set(path, merge ? { ...records.get(path), ...value } : value))
    return result
  })
})
const drawing = (uid = "alice") => createDrawingDocument({ studentId: uid, storyId: null, pageId: "drawing" }, { actions: [], cursor: 0 })
const request = (method: string, uid?: string, body?: unknown) => new NextRequest("http://localhost/api/personal-story", { method, headers: uid ? { Authorization: `Bearer ${uid}` } : {}, ...(body ? { body: JSON.stringify(body) } : {}) })
test("requires real bearer authentication, ignores spoofed identity headers, and never touches storage on rejection", async () => {
  expect((await GET(request("GET"))).status).toBe(401)
  expect((await GET(request("GET", "invalid"))).status).toBe(401)
  expect((await GET(new NextRequest("http://localhost/api/personal-story", { headers: { "x-test-student-uid": "alice" } }))).status).toBe(401)
  expect(db.runTransaction).not.toHaveBeenCalled()
})
test("atomically upserts text and drawing, restores revisions and isolates owners", async () => {
  expect(await (await GET(request("GET", "alice"))).json()).toEqual({ text: "", drawing: null, revision: 0 })
  const body = { text: "My story", drawing: drawing(), revision: 0 }
  expect((await PUT(request("PUT", "alice", body))).status).toBe(200)
  expect(records.get("items/alice")?.name).toBe("My story")
  expect(await (await GET(request("GET", "alice"))).json()).toEqual({ ...body, revision: 1 })
  expect(await (await GET(request("GET", "bob"))).json()).toEqual({ text: "", drawing: null, revision: 0 })
  expect((await PUT(request("PUT", "alice", { ...body, revision: 1 }))).status).toBe(200)
  expect(records.size).toBe(2)
  expect((await PUT(request("PUT", "alice", body))).status).toBe(409)
  expect(records.get("items/alice/drawingPages/drawing")?.revision).toBe(2)
})
test("rejects cross-owner data, corrupt/oversized data, and malformed requests", async () => {
  for (const body of [{ text: "x", drawing: drawing("bob"), revision: 0 }, { text: "x", drawing: { ...drawing(), schemaVersion: 9 }, revision: 0 }, { text: "x".repeat(100001), drawing: drawing(), revision: 0 }]) {
    expect((await PUT(request("PUT", "alice", body))).status).toBe(400)
  }
  expect(records.size).toBe(0)
})
test("storage failures return failure; corrupt saved data never becomes an empty drawing", async () => {
  ;(db.runTransaction as jest.Mock).mockRejectedValueOnce(new Error("offline"))
  expect((await PUT(request("PUT", "alice", { text: "x", drawing: drawing(), revision: 0 }))).status).toBe(503)
  expect(records.size).toBe(0)
  records.set("items/alice/drawingPages/drawing", { drawing: {}, revision: 1 })
  expect((await GET(request("GET", "alice"))).status).toBe(503)
})
