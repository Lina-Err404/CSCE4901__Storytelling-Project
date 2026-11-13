
const {
    validateTimeLimit,
    calculateEndTime,
    getTimeRemainingSeconds,
    isTimerExpired
} = require("../src/timer");

describe("R5 Time Limit", () => {
    test("accepts valid time limits", () => {
        expect(validateTimeLimit(10)).toBe(true);
        expect(validateTimeLimit(180)).toBe(true);
    });

    test("rejects invalid time limits", () => {
        expect(validateTimeLimit(0)).toBe(false);
        expect(validateTimeLimit(181)).toBe(false);
        expect(validateTimeLimit(2.5)).toBe(false);
        expect(validateTimeLimit("10")).toBe(false);
    });

    test("calculates the correct end time", () => {
        const start = new Date("2026-11-06T14:00:00Z");
        const end = calculateEndTime(start, 10);

        expect(end.toISOString()).toBe("2026-11-06T14:10:00.000Z");
    });

    test("calculates remaining seconds", () => {
        const end = new Date("2026-11-06T14:10:00Z");
        const now = new Date("2026-11-06T14:05:00Z");

        expect(getTimeRemainingSeconds(end, now)).toBe(300);
    });

    test("detects expired timers", () => {
        const end = new Date("2026-11-06T14:10:00Z");

        expect(isTimerExpired(end, new Date("2026-11-06T14:11:00Z"))).toBe(true);
        expect(isTimerExpired(end, new Date("2026-11-06T14:05:00Z"))).toBe(false);
    });
});
