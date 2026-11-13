import React from "react"
import { fireEvent, render, screen, waitFor } from "@testing-library/react"
import SetItem from "../src/app/creating-stories/components/SetItem"
import supabase from "@/src/utils/supabase"

jest.mock("@/src/utils/supabase", () => ({
  __esModule: true,
  default: {
    auth: {
      getSession: jest.fn(),
      onAuthStateChange: jest.fn(() => ({
        data: { subscription: { unsubscribe: jest.fn() } },
      })),
      signInWithPassword: jest.fn(),
      signOut: jest.fn(),
    },
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
    default: ({ onChangeDocument, onSave }: {
      onChangeDocument: (document: { version: number; runs: { text: string; marks: Record<string, boolean> }[] }) => void
      onSave: () => void
    }) => React.createElement(
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

describe("story Supabase authentication", () => {
  const originalFetch = global.fetch
  const user = {
    id: "profile-id",
    app_metadata: { provider: "email", providers: ["email"] },
    user_metadata: {},
    aud: "authenticated",
    created_at: "2026-01-01T00:00:00.000Z",
    email: "student@example.test",
  }
  const session = {
    access_token: "supabase-access-token",
    token_type: "bearer" as const,
    expires_in: 3600,
    refresh_token: "refresh-token",
    user,
  }

  afterEach(() => {
    global.fetch = originalFetch
    jest.clearAllMocks()
  })

  test("signs in with Supabase and uses its token to load and save stories", async () => {
    const getSession = jest.spyOn(supabase.auth, "getSession")
    getSession
      .mockResolvedValueOnce({ data: { session: null }, error: null })
      .mockResolvedValue({ data: { session }, error: null })
    const signInWithPassword = jest.spyOn(supabase.auth, "signInWithPassword")
    signInWithPassword.mockResolvedValue({
      data: { session, user },
      error: null,
    })

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
    fireEvent.change(await screen.findByLabelText("Email"), {
      target: { value: "student@example.test" },
    })
    fireEvent.change(screen.getByLabelText("Password"), { target: { value: "test-password" } })
    fireEvent.click(screen.getByRole("button", { name: "Sign in" }))

    fireEvent.click(await screen.findByRole("button", { name: "Edit story" }))
    fireEvent.click(screen.getByRole("button", { name: "Save story" }))

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2))
    expect(signInWithPassword).toHaveBeenCalledWith({
      email: "student@example.test",
      password: "test-password",
    })
    for (const [, options] of fetchMock.mock.calls) {
      expect(options.headers.get("Authorization")).toBe("Bearer supabase-access-token")
      expect(options.headers.has("x-test-student-uid")).toBe(false)
    }
    expect(fetchMock.mock.calls[1][1]).toMatchObject({
      method: "PUT",
      body: JSON.stringify({
        writingContent: "saved story",
        writingDocument: { version: 1, runs: [{ text: "saved story", marks: {} }] },
      }),
    })
  })

  test("does not load a story for an account outside the configured test students", async () => {
    const getSession = jest.spyOn(supabase.auth, "getSession")
    getSession.mockResolvedValue({
      data: { session: { ...session, user: { ...user, id: "another-student" } } },
      error: null,
    })
    const fetchMock = jest.fn()
    global.fetch = fetchMock

    render(React.createElement(SetItem, {
      storyId: "story-id",
      studentId: "profile-id",
      students: ["profile-id"],
    }))

    expect((await screen.findByRole("alert")).textContent).toBe(
      "This Supabase account does not match one of the configured test students.",
    )
    expect(fetchMock).not.toHaveBeenCalled()
  })
})
