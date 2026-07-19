const db = require('../config/database');

function getSchedule() {
    const row = db.prepare("SELECT value FROM config WHERE key = 'schedule'").get();
    return row ? JSON.parse(row.value) : {};
}

function getScheduleWithAttributes() {
    const scheduleRow = db.prepare("SELECT value FROM config WHERE key = 'schedule'").get();
    const schedule = scheduleRow ? JSON.parse(scheduleRow.value) : {};

    const attrRow = db.prepare("SELECT value FROM config WHERE key = 'course_attributes'").get();
    const attributes = attrRow ? JSON.parse(attrRow.value) : [];

    return { schedule, attributes };
}

function updateSchedule(newSchedule) {
    db.prepare(
        "INSERT INTO config (key, value) VALUES ('schedule', ?) ON CONFLICT(key) DO UPDATE SET value=excluded.value"
    ).run(JSON.stringify(newSchedule));
}

function validateScheduleFormat(schedule) {
    const isValidCourses = (courses) =>
        Array.isArray(courses) && courses.every(c => c && typeof c.time === 'string' && Array.isArray(c.notes));

    const isValidVariant = (variant) =>
        variant && isValidCourses(variant.workdays) && isValidCourses(variant.saturday) && isValidCourses(variant.sunday);

    return schedule && isValidVariant(schedule.myslenice) && isValidVariant(schedule.sulkowice);
}

function getShowScheduleImage() {
    try {
        const row = db.prepare("SELECT value FROM config WHERE key = 'show_schedule_image'").get();
        if (row && row.value !== undefined) {
            return JSON.parse(row.value);
        }
    } catch (e) {
        console.error("Error fetching show_schedule_image config:", e);
    }
    return true;
}

function setShowScheduleImage(show) {
    db.prepare(
        "INSERT INTO config (key, value) VALUES ('show_schedule_image', ?) ON CONFLICT(key) DO UPDATE SET value=excluded.value"
    ).run(JSON.stringify(!!show));
}

module.exports = {
    getSchedule,
    getScheduleWithAttributes,
    updateSchedule,
    validateScheduleFormat,
    getShowScheduleImage,
    setShowScheduleImage
};

