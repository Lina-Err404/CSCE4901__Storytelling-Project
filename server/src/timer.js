const DEFAULT_TIME_LIMIT_MINUTES =10;
const MAX_TIME_LIMIT_MINUTES = 180;

function validateTimeLimit(minutes){

    return (

        typeof minutes === "number" &&
        Number.isInteger(minutes) &&
        minutes > 0 &&
        minutes <= MAX_TIME_LIMIT_MINUTES
    );
}


function calculateEndTime(startTime, minutes) {

    if(!validateTimeLimit(minutes)) {

        throw new RangeError("Time limit must be between 1 and 180 minutes");
}

const start = new Date(startTime);

if (Number.isNaN(start.getTime())) {
    throw new TypeError("Invalid start time");
}

return new Date(start.getTime() + minutes * 60 * 1000);
}

function getTimeRemainingSeconds(endTime, now = new Date()) {

    const end = new Date(endTime).getTime();
    const current = new Date(now).getTime();

    if (!Number.isFinite(end) || !Number.isFinite(current)) {
        throw new TypeError("Invalid timer date");
    }

    return Math.max(0, Math.ceil((end - current) / 1000));
}


function isTimerExpired(endTime, now = new Date()) {
    return getTimeRemainingSeconds(endTime, now) === 0;
}

module.exports = {
    DEFAULT_TIME_LIMIT_MINUTES,
    MAX_TIME_LIMIT_MINUTES,
    validateTimeLimit,
    calculateEndTime,
    getTimeRemainingSeconds,
    isTimerExpired
};