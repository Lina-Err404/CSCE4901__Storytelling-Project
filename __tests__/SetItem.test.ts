import React from "react"
import { fireEvent, render, screen, waitFor } from "@testing-library/react"
import SetItem from "../src/app/creating-stories/components/SetItem"

jest.mock("@/src/app/firebase-client", () => ({ auth: null }))

jest.mock("@/src/utils/supabase", () => ({
  __esModule: true,
  default: {
    channel: () => ({
      on() { return this },
      subscribe() { return this },
    }),
    removeChannel: jest.fn(),
    from: () => ({
      select: () => ({
        in: async () => ({ data: [], error: null }),
      }),
    }),
  },
}))

jest.mock("../src/app/creating-stories/components/bookPage", () => {
  const React = jest.requireActual("react")
  return {
    __esModule: true,
    default: ({ onChangeDocument, onSave }) => React.createElement(
      React.Fragment,
      null,
      React.createElement("button", {
        onClick: () => onChangeDocument({
          version: 1,
          runs: [{ text: "saved story", marks: {} }],
        }),
      }, "Edit story"),
      React.createElement("button", { onClick: onSave }, "Save story"),
    ),
  }
})

describe("story API local development auth", () => {
  const originalEnv = {
    allowDevMode: process.env.NEXT_PUBLIC_ALLOW_DEV_MODE,
    testStudentUid: process.env.NEXT_PUBLIC_TEST_STUDENT_UID,
    nodeEnv: process.env.NODE_ENV,
  }
  const originalFetch = global.fetch

  afterEach(() => {
    process.env.NEXT_PUBLIC_ALLOW_DEV_MODE = originalEnv.allowDevMode
    process.env.NEXT_PUBLIC_TEST_STUDENT_UID = originalEnv.testStudentUid
    process.env.NODE_ENV = originalEnv.nodeEnv
    if (originalFetch) {
      global.fetch = originalFetch
    } else {
      delete global.fetch
    }
    jest.restoreAllMocks()
  })

  test("uses the configured test UID to load and save stories without Firebase sign-in", async () => {
    process.env.NEXT_PUBLIC_ALLOW_DEV_MODE = "true"
    process.env.NEXT_PUBLIC_TEST_STUDENT_UID = "linked-test-uid"
    process.env.NODE_ENV = "development"
    const fetchMock = jest.fn()
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          segments: [{
            segmentId: "segment-id",
            studentId: "profile-id",
            assignedToYou: true,
            writingContent: "",
            writingDocument: { version: 1, runs: [] },
          }],
        }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          writingDocument: { version: 1, runs: [{ text: "saved story", marks: {} }] },
        }),
      })
    global.fetch = fetchMock

    render(React.createElement(SetItem, { storyId: "story-id", studentId: "profile-id" }))
    fireEvent.click(await screen.findByRole("button", { name: "Edit story" }))
    fireEvent.click(screen.getByRole("button", { name: "Save story" }))

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2))
    for (const [, options] of fetchMock.mock.calls) {
      expect(options.headers.get("x-test-student-uid")).toBe("linked-test-uid")
      expect(options.headers.has("Authorization")).toBe(false)
    }
    expect(fetchMock.mock.calls[1][1]).toMatchObject({
      method: "PUT",
      body: JSON.stringify({
        writingContent: "saved story",
        writingDocument: { version: 1, runs: [{ text: "saved story", marks: {} }] },
      }),
    })
  })

  test("does not use the test UID when running in production", async () => {
    process.env.NEXT_PUBLIC_ALLOW_DEV_MODE = "true"
    process.env.NEXT_PUBLIC_TEST_STUDENT_UID = "linked-test-uid"
    process.env.NODE_ENV = "production"
    const fetchMock = jest.fn()
    global.fetch = fetchMock
    const consoleError = jest.spyOn(console, "error").mockImplementation(() => {})

    render(React.createElement(SetItem, { storyId: "story-id", studentId: "profile-id" }))

    await waitFor(() => expect(consoleError).toHaveBeenCalled())
    expect(fetchMock).not.toHaveBeenCalled()
  })
})
