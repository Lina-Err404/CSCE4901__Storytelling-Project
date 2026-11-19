
const request = require("supertest");
const express = require("express");

// Use fake authentication instead of real user accounts.
jest.mock("../src/supabaseAuth", () => ({
    requireSupabaseTeacher: (req, res, next) => {
        req.user = { uid: "teacher-123" };
        next();
    }
}));

// Use a fake Supabase database.
jest.mock("../src/supabase", () => ({
    getSupabase: jest.fn()
}));

const { getSupabase } = require("../src/supabase");
const { createTimerRouter } = require("../src/timerRoutes");

describe("R5 Timer API", () => {
    let app;
    let responses;
    let updates;
    let supabase;

    beforeEach(() => {
        responses = [];
        updates = [];

        const query = {
            select: jest.fn(() => query),
            eq: jest.fn(() => query),
            is: jest.fn(() => query),
            update: jest.fn((values) => {
                updates.push(values);
                return query;
            }),
            maybeSingle: jest.fn(async () => responses.shift())
        };

        supabase = {
            from: jest.fn(() => query),
            auth: {
                getUser: jest.fn()
            }
        };

        getSupabase.mockReturnValue(supabase);

        app = express();
        app.use(express.json());
        app.use(createTimerRouter({
            getIo: () => null
        }));
    });

    test("rejects an invalid time limit", async () => {
        const response = await request(app)
            .patch("/lobbies/lobby-123/timer")
            .send({ minutes: 0 });

        expect(response.status).toBe(400);
    });

    test("teacher can set a time limit", async () => {
        responses.push(
            {
                data: {
                    lobby_id: "lobby-123",
                    class_id: "class-123",
                    status: "waiting",
                    timer_started_at: null
                },
                error: null
            },
            {
                data: { teacher_id: "teacher-123" },
                error: null
            },
            {
                data: {
                    lobby_id: "lobby-123",
                    time_limit_minutes: 10
                },
                error: null
            }
        );

        const response = await request(app)
            .patch("/lobbies/lobby-123/timer")
            .send({ minutes: 10 });

        expect(response.status).toBe(200);
        expect(response.body.timeLimitMinutes).toBe(10);
        expect(updates[0]).toEqual({
            time_limit_minutes: 10
        });
    });

    test("another teacher cannot change the timer", async () => {
        responses.push(
            {
                data: {
                    lobby_id: "lobby-123",
                    class_id: "class-123",
                    status: "waiting",
                    timer_started_at: null
                },
                error: null
            },
            {
                data: { teacher_id: "another-teacher" },
                error: null
            }
        );

        const response = await request(app)
            .patch("/lobbies/lobby-123/timer")
            .send({ minutes: 10 });

        expect(response.status).toBe(403);
        expect(updates).toHaveLength(0);
    });

    test("teacher can start the timer", async () => {
        responses.push(
            {
                data: {
                    lobby_id: "lobby-123",
                    class_id: "class-123",
                    status: "waiting",
                    time_limit_minutes: 10,
                    timer_started_at: null
                },
                error: null
            },
            {
                data: { teacher_id: "teacher-123" },
                error: null
            },
            {
                data: {
                    lobby_id: "lobby-123",
                    time_limit_minutes: 10,
                    timer_started_at: new Date().toISOString(),
                    timer_ends_at: new Date(
                        Date.now() + 600000
                    ).toISOString()
                },
                error: null
            }
        );

        const response = await request(app)
            .post("/lobbies/lobby-123/timer/start");

        expect(response.status).toBe(200);
        expect(response.body.timeLimitMinutes).toBe(10);
        expect(updates[0]).toHaveProperty("timer_started_at");
        expect(updates[0]).toHaveProperty("timer_ends_at");
    });

    test("rejects timer requests without authentication", async () => {
        const response = await request(app)
            .get("/lobbies/lobby-123/timer");

        expect(response.status).toBe(401);
    });

test("student can retrieve remaining time", async () => {
    const studentId = "student-123";

    supabase.auth.getUser.mockResolvedValue({
        data: { user: { id: studentId } },
        error: null
    });

    responses.push(
        {
            data: {
                lobby_id: "lobby-123",
                class_id: "class-123",
                time_limit_minutes: 10,
                timer_started_at: new Date().toISOString(),
                timer_ends_at: new Date(Date.now() + 300000).toISOString()
            },
            error: null
        },
        {
            data: { teacher_id: "teacher-123" },
            error: null
        },
        {
            data: { student_id: studentId },
            error: null
        }
    );

    const response = await request(app)
        .get("/lobbies/lobby-123/timer")
        .set("Authorization", "Bearer test-token");

    expect(response.status).toBe(200);
    expect(response.body.timeLimitMinutes).toBe(10);
    expect(response.body.remainingSeconds).toBeGreaterThan(0);
    expect(response.body.expired).toBe(false);
});


});
