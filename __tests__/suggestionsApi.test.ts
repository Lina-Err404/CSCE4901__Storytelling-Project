/** @jest-environment node */
import { GET, POST } from "../src/app/api/suggestions/route"
import { adminAuth, db } from "@/lib/firebaseAdmin"
jest.mock("@/lib/firebaseAdmin", () => ({ adminAuth: { verifyIdToken: jest.fn() }, db: { collection: jest.fn(), runTransaction: jest.fn() } }))
const original = { key: process.env.GROQ_API_KEY, demo: process.env.SUGGESTIONS_DEMO_MODE, mode: process.env.NODE_ENV }
const provider = jest.fn()
const records = new Map<string, { used: number }>()
type Ref = { path: string; get: () => Promise<{ data: () => { used: number } | undefined }> }
const read = (path: string) => Promise.resolve({ data: () => records.get(path) })
beforeEach(() => {
  records.clear()
  Object.assign(process.env, { GROQ_API_KEY: "test-server-key", SUGGESTIONS_DEMO_MODE: "false", NODE_ENV: "test" })
  ;(adminAuth.verifyIdToken as jest.Mock).mockImplementation(async (token: string) => ({ uid: token }))
  ;(db.collection as jest.Mock).mockImplementation(collection => ({
    doc: (uid: string): Ref => ({ path: `${collection}/${uid}`, get: () => read(`${collection}/${uid}`) }),
  }))
  // Model Firestore's serialized read/commit for the shared usage record.
  let commits = Promise.resolve()
  ;(db.runTransaction as jest.Mock).mockImplementation(work => {
    const result = commits.then(() => work({
      get: (ref: Ref) => ref.get(),
      set: (ref: Ref, value: { used: number }) => records.set(ref.path, value),
    }))
    commits = result.then(() => {}, () => {})
    return result
  })
  provider.mockReset().mockResolvedValue({ ok: true, json: async () => ({ choices: [{ message: { content: JSON.stringify({ ideas: ["One", "Two", "Three"] }) } }] }) })
  global.fetch = provider
})
afterAll(() => { for (const [key, value] of Object.entries({ GROQ_API_KEY: original.key, SUGGESTIONS_DEMO_MODE: original.demo, NODE_ENV: original.mode })) { if (value === undefined) delete process.env[key]; else process.env[key] = value } })
const call = (body: unknown, token = "token") => POST(new Request("http://localhost/api/suggestions", { method: "POST", headers: token ? { Authorization: `Bearer ${token}` } : {}, body: JSON.stringify(body) }))
const readUsage = (token: string) => GET(new Request("http://localhost/api/suggestions", { headers: token ? { Authorization: `Bearer ${token}` } : {} }))
test("requires verified Firebase auth before using the provider", async () => {
  expect((await call({ text: "Story", mode: "generate" }, "")).status).toBe(401)
  ;(adminAuth.verifyIdToken as jest.Mock).mockRejectedValueOnce(new Error())
  expect((await call({ text: "Story", mode: "generate" })).status).toBe(401)
  expect((await readUsage("")).status).toBe(401)
  expect(provider).not.toHaveBeenCalled()
})
test.each([{ text: 42, mode: "grammar" }, { text: "x", mode: "other" }, { text: "x".repeat(100001), mode: "generate" }])("rejects invalid or oversized input", async body => {
  expect((await call(body)).status).toBe(400); expect(provider).not.toHaveBeenCalled()
})
test("reuses Groq generation contract and validates grammar/ideas", async () => {
  expect(await (await call({ text: "Story", mode: "generate" })).json()).toEqual({ ideas: ["One", "Two", "Three"], remainingGenerations: 2 })
  expect(JSON.parse(provider.mock.calls[0][1].body)).toMatchObject({ model: "openai/gpt-oss-120b", response_format: { type: "json_object" } })
  provider.mockResolvedValueOnce({ ok: true, json: async () => ({ choices: [{ message: { content: JSON.stringify({ grammar: [{ original: "walk", replacement: "walked" }] }) } }] }) })
  expect(await (await call({ text: "She walk.", mode: "grammar" })).json()).toEqual({ grammar: [{ original: "walk", replacement: "walked" }] })
  provider.mockResolvedValueOnce({ ok: true, json: async () => ({ choices: [{ message: { content: '{"ideas":["One"]}' } }] }) })
  expect((await call({ text: "Story", mode: "generate" })).status).toBe(502)
  provider.mockResolvedValueOnce({ ok: false, status: 429 })
  expect((await call({ text: "Story", mode: "generate" })).status).toBe(429)
  expect(await (await readUsage("token")).json()).toEqual({ remainingGenerations: 2 })
})

test("persisted allowance follows the authenticated personal page across requests", async () => {
  for (const left of [2, 1, 0]) {
    expect(await (await call({ text: "", mode: "generate" }, "alice")).json()).toEqual({
      ideas: ["One", "Two", "Three"], remainingGenerations: left,
    })
    expect(await (await readUsage("alice")).json()).toEqual({ remainingGenerations: left })
  }
  expect((await call({ text: "Story", mode: "generate" }, "alice")).status).toBe(429)
  expect(provider).toHaveBeenCalledTimes(3)
  expect(await (await readUsage("bob")).json()).toEqual({ remainingGenerations: 3 })
  expect((await call({ text: "Story", mode: "generate" }, "bob")).status).toBe(200)
})

test("concurrent valid responses compete for the final available generation", async () => {
  const body = { text: "Story", mode: "generate" }
  await call(body)
  await call(body)
  const results = await Promise.all(Array.from({ length: 4 }, () => call(body)))
  expect(results.map(response => response.status).sort()).toEqual([200, 429, 429, 429])
  expect(await (await readUsage("token")).json()).toEqual({ remainingGenerations: 0 })
})
test("missing key never silently serves demo output in production", async () => {
  process.env.GROQ_API_KEY = ""
  expect((await call({ text: "Story", mode: "generate" })).status).toBe(503)
  process.env.SUGGESTIONS_DEMO_MODE = "true"
  expect((await (await call({ text: "Story", mode: "generate" })).json()).demo).toBe(true)
  Object.assign(process.env, { NODE_ENV: "production" })
  expect((await call({ text: "Story", mode: "generate" })).status).toBe(503)
})
