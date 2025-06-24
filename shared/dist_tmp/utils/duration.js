"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.parseDuration = parseDuration;
exports.formatDuration = formatDuration;
exports.secondsToMs = secondsToMs;
exports.msToSeconds = msToSeconds;
/**
 * Parse duration string (e.g., "1d", "3h", "30m") into seconds
 */
function parseDuration(durationStr) {
    var regex = /^(\d+)([smhdw])$/;
    var match = regex.exec(durationStr);
    if (!match)
        return null;
    var value = parseInt(match[1]);
    var unit = match[2];
    var multipliers = {
        s: 1,
        m: 60,
        h: 60 * 60,
        d: 60 * 60 * 24,
        w: 60 * 60 * 24 * 7,
    };
    return value * multipliers[unit];
}
/**
 * Format duration in seconds to human readable string
 */
function formatDuration(seconds) {
    var units = [
        { name: "week", seconds: 604800 },
        { name: "day", seconds: 86400 },
        { name: "hour", seconds: 3600 },
        { name: "minute", seconds: 60 },
    ];
    for (var _i = 0, units_1 = units; _i < units_1.length; _i++) {
        var unit = units_1[_i];
        var count = Math.floor(seconds / unit.seconds);
        if (count > 0) {
            return "".concat(count, " ").concat(unit.name).concat(count !== 1 ? "s" : "");
        }
    }
    return "".concat(seconds, " second").concat(seconds !== 1 ? "s" : "");
}
/**
 * Convert seconds to milliseconds
 */
function secondsToMs(seconds) {
    return seconds * 1000;
}
/**
 * Convert milliseconds to seconds
 */
function msToSeconds(ms) {
    return Math.floor(ms / 1000);
}
