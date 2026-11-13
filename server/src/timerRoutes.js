const express = require("express");
const { requireSupabaseTeacher } = require("./supabaseAuth");
const { getSupabase } = require("./supabase");
const {
    validateTimeLimit,
    calculateEndTime,
    getTimeRemainingSeconds,
    isTimerExpired
} = require('./timer');

function createTimerRouter({ getIo }) {
    const router = express.Router();
    const supabase = getSupabase();



    // R5: Teacher sets the time limit for a lobby.
    router.patch("/lobbies/:id/timer", requireSupabaseTeacher, async (req, res) => {
        try {
            const { minutes } = req.body || {};

            if (!validateTimeLimit(minutes)) {
                return res.status(400).json({
                    error: "Time limit must be between 1 and 180 minutes"
                });
            }

            const lobbyId = req.params.id;

            const { data: lobby, error: lookupError } = await supabase
                .from("lobbies")
                .select("lobby_id, class_id, status, timer_started_at")
                .eq("lobby_id", lobbyId)
                .maybeSingle();

            if (lookupError) {
                return res.status(500).json({
                    error: "Unable to retrieve lobby"
                });
            }

            if (!lobby) {
                return res.status(404).json({
                    error: "Lobby not found"
                });
            }

            // The lobby must still be waiting to start.
            if (lobby.status !== "waiting" || lobby.timer_started_at) {
                return res.status(409).json({
                    error: "Timer cannot be changed after the session starts"
                });
            }

            // Verify that this teacher owns the lobby's class.
            const { data: schoolClass, error: classError } = await supabase
                .from("classes")
                .select("teacher_id")
                .eq("class_id", lobby.class_id)
                .maybeSingle();

            if (classError) {
                return res.status(500).json({
                    error: "Unable to verify teacher"
                });
            }

            if (!schoolClass || schoolClass.teacher_id !== req.user.uid) {
                return res.status(403).json({
                    error: "Forbidden"
                });
            }

            const { data, error } = await supabase
                .from("lobbies")
                .update({ time_limit_minutes: minutes })
                .eq("lobby_id", lobbyId)
                .eq("status", "waiting")
                .is("timer_started_at", null)
                .select("lobby_id, time_limit_minutes")
                .maybeSingle();

            if (error) {
                return res.status(500).json({
                    error: "Unable to save time limit"
                });
            }

            if (!data) {
                return res.status(409).json({
                    error: "Lobby state changed. Please try again."
                });
            }

            return res.json({
                lobbyId: data.lobby_id,
                timeLimitMinutes: data.time_limit_minutes
            });
        } catch (error) {
            return res.status(500).json({
                error: "Unable to save time limit"
            });
        }
    });

    // R5: Start the writing timer.
    router.post("/lobbies/:id/timer/start", requireSupabaseTeacher, async (req, res) => {
        try {
            const lobbyId = req.params.id;

            const { data: lobby, error: lobbyError } = await supabase
                .from("lobbies")
                .select("lobby_id, class_id, status, time_limit_minutes, timer_started_at")
                .eq("lobby_id", lobbyId)
                .maybeSingle();

            if (lobbyError) {
                return res.status(500).json({ error: "Unable to retrieve lobby" });
            }

            if (!lobby) {
                return res.status(404).json({ error: "Lobby not found" });
            }

            // Verify that the teacher owns the class.
            const { data: schoolClass, error: classError } = await supabase
                .from("classes")
                .select("teacher_id")
                .eq("class_id", lobby.class_id)
                .maybeSingle();

            if (classError) {
                return res.status(500).json({ error: "Unable to verify teacher" });
            }

            if (!schoolClass || schoolClass.teacher_id !== req.user.uid) {
                return res.status(403).json({ error: "Forbidden" });
            }

            if (lobby.status !== "waiting" || lobby.timer_started_at) {
                return res.status(409).json({
                    error: "Timer already started or lobby is not waiting"
                });
            }

            if (!validateTimeLimit(lobby.time_limit_minutes)) {
                return res.status(400).json({
                    error: "Set a valid time limit first"
                });
            }

            const startTime = new Date();
            const endTime = calculateEndTime(startTime, lobby.time_limit_minutes);

            // Save the start and end times to Supabase.
            const { data, error } = await supabase
                .from("lobbies")
                .update({
                    timer_started_at: startTime.toISOString(),
                    timer_ends_at: endTime.toISOString()
                })
                .eq("lobby_id", lobbyId)
                .eq("status", "waiting")
                .is("timer_started_at", null)
                .select("lobby_id, time_limit_minutes, timer_started_at, timer_ends_at")
                .maybeSingle();

            if (error) {
                return res.status(500).json({ error: "Unable to start timer" });
            }

            if (!data) {
                return res.status(409).json({ error: "Timer was already started" });
            }

            // Notify connected clients when the timer starts.
            const io = typeof getIo === "function" ? getIo() : null;

            io?.to(`lobby:${lobbyId}`).emit("timer:started", {
                lobbyId,
                timerEndsAt: data.timer_ends_at
            });

            return res.json({
                lobbyId,
                timeLimitMinutes: data.time_limit_minutes,
                timerStartedAt: data.timer_started_at,
                timerEndsAt: data.timer_ends_at
            });
        } catch (error) {
            return res.status(500).json({ error: "Unable to start timer" });
        }
    });



// R5: Get the current timer status for a lobby.
router.get("/lobbies/:id/timer", async (req, res) => {
        try {
            const lobbyId = req.params.id;

            const authorization = req.get("authorization");
            const match = typeof authorization === "string"
                ? authorization.match(/^Bearer\s+([^\s]+)$/i)
                : null;

            if (!match) {
                return res.status(401).json({ error: "Unauthorized" });
            }

            const { data: authData, error: authError } =
                await supabase.auth.getUser(match[1]);

            if (authError || !authData.user) {
                return res.status(401).json({ error: "Unauthorized" });
            }

            const userId = authData.user.id;

            const { data: lobby, error } = await supabase
                .from("lobbies")
                .select("lobby_id, class_id, time_limit_minutes, timer_started_at, timer_ends_at")
                .eq("lobby_id", lobbyId)
                .maybeSingle();

            if (error) {
                return res.status(500).json({
                    error: "Unable to retrieve timer"
                });
            }

            if (!lobby) {
                return res.status(404).json({
                    error: "Lobby not found"
                });
            }

            // Check that the user belongs to the lobby's class.
            const { data: schoolClass } = await supabase
                .from("classes")
                .select("teacher_id")
                .eq("class_id", lobby.class_id)
                .maybeSingle();

            let allowed = schoolClass?.teacher_id === userId;

            if (!allowed) {
                const { data: enrollment, error: enrollmentError } = await supabase
                    .from("class_students")
                    .select("student_id")
                    .eq("class_id", lobby.class_id)
                    .eq("student_id", userId)
                    .maybeSingle();

                if (enrollmentError) {
                    return res.status(500).json({
                        error: "Unable to verify class membership"
                    });
                }

                allowed = Boolean(enrollment);
            }

            if (!allowed) {
                return res.status(403).json({ error: "Forbidden" });
            }

            const remainingSeconds = lobby.timer_ends_at
                ? getTimeRemainingSeconds(lobby.timer_ends_at)
                : null;

            return res.json({
                lobbyId,
                timeLimitMinutes: lobby.time_limit_minutes,
                timerStartedAt: lobby.timer_started_at,
                timerEndsAt: lobby.timer_ends_at,
                remainingSeconds,
                expired: lobby.timer_ends_at
                    ? isTimerExpired(lobby.timer_ends_at)
                    : false
            });
        } catch (error) {
            return res.status(500).json({
                error: "Unable to retrieve timer"
            });
        }
    });


    return router;
}

module.exports = { createTimerRouter };
