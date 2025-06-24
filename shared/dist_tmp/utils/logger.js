"use strict";
var __spreadArray = (this && this.__spreadArray) || function (to, from, pack) {
    if (pack || arguments.length === 2) for (var i = 0, l = from.length, ar; i < l; i++) {
        if (ar || !(i in from)) {
            if (!ar) ar = Array.prototype.slice.call(from, 0, i);
            ar[i] = from[i];
        }
    }
    return to.concat(ar || Array.prototype.slice.call(from));
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.createConsoleLogger = void 0;
var createConsoleLogger = function (serviceName) {
    var log = function (level, message) {
        var args = [];
        for (var _i = 2; _i < arguments.length; _i++) {
            args[_i - 2] = arguments[_i];
        }
        var timestamp = new Date().toISOString();
        console.log.apply(console, __spreadArray(["[".concat(timestamp, "] [").concat(serviceName, "] [").concat(level.toUpperCase(), "] ").concat(message)], args, false));
    };
    return {
        info: function (message) {
            var args = [];
            for (var _i = 1; _i < arguments.length; _i++) {
                args[_i - 1] = arguments[_i];
            }
            return log.apply(void 0, __spreadArray(['info', message], args, false));
        },
        error: function (message) {
            var args = [];
            for (var _i = 1; _i < arguments.length; _i++) {
                args[_i - 1] = arguments[_i];
            }
            return log.apply(void 0, __spreadArray(['error', message], args, false));
        },
        warn: function (message) {
            var args = [];
            for (var _i = 1; _i < arguments.length; _i++) {
                args[_i - 1] = arguments[_i];
            }
            return log.apply(void 0, __spreadArray(['warn', message], args, false));
        },
        debug: function (message) {
            var args = [];
            for (var _i = 1; _i < arguments.length; _i++) {
                args[_i - 1] = arguments[_i];
            }
            return log.apply(void 0, __spreadArray(['debug', message], args, false));
        },
        verbose: function (message) {
            var args = [];
            for (var _i = 1; _i < arguments.length; _i++) {
                args[_i - 1] = arguments[_i];
            }
            return log.apply(void 0, __spreadArray(['verbose', message], args, false));
        },
    };
};
exports.createConsoleLogger = createConsoleLogger;
