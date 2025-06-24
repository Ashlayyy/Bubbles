"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __generator = (this && this.__generator) || function (thisArg, body) {
    var _ = { label: 0, sent: function() { if (t[0] & 1) throw t[1]; return t[1]; }, trys: [], ops: [] }, f, y, t, g = Object.create((typeof Iterator === "function" ? Iterator : Object).prototype);
    return g.next = verb(0), g["throw"] = verb(1), g["return"] = verb(2), typeof Symbol === "function" && (g[Symbol.iterator] = function() { return this; }), g;
    function verb(n) { return function (v) { return step([n, v]); }; }
    function step(op) {
        if (f) throw new TypeError("Generator is already executing.");
        while (g && (g = 0, op[0] && (_ = 0)), _) try {
            if (f = 1, y && (t = op[0] & 2 ? y["return"] : op[0] ? y["throw"] || ((t = y["return"]) && t.call(y), 0) : y.next) && !(t = t.call(y, op[1])).done) return t;
            if (y = 0, t) op = [op[0] & 2, t.value];
            switch (op[0]) {
                case 0: case 1: t = op; break;
                case 4: _.label++; return { value: op[1], done: false };
                case 5: _.label++; y = op[1]; op = [0]; continue;
                case 7: op = _.ops.pop(); _.trys.pop(); continue;
                default:
                    if (!(t = _.trys, t = t.length > 0 && t[t.length - 1]) && (op[0] === 6 || op[0] === 2)) { _ = 0; continue; }
                    if (op[0] === 3 && (!t || (op[1] > t[0] && op[1] < t[3]))) { _.label = op[1]; break; }
                    if (op[0] === 6 && _.label < t[1]) { _.label = t[1]; t = op; break; }
                    if (t && _.label < t[2]) { _.label = t[2]; _.ops.push(op); break; }
                    if (t[2]) _.ops.pop();
                    _.trys.pop(); continue;
            }
            op = body.call(thisArg, _);
        } catch (e) { op = [6, e]; y = 0; } finally { f = t = 0; }
        if (op[0] & 5) throw op[1]; return { value: op[0] ? op[1] : void 0, done: true };
    }
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.QueueManager = exports.createQueue = exports.createRedisConnection = exports.getQueueConfig = void 0;
var ioredis_1 = require("ioredis");
var bull_1 = require("bull");
var getQueueConfig = function () {
    return {
        redis: {
            host: process.env.REDIS_HOST || 'localhost',
            port: parseInt(process.env.REDIS_PORT || '6379'),
            password: process.env.REDIS_PASSWORD,
            db: 0,
        },
        defaultJobOptions: {
            removeOnComplete: 100,
            removeOnFail: 50,
            attempts: 3,
            backoff: {
                type: 'exponential',
                delay: 2000,
            },
        },
    };
};
exports.getQueueConfig = getQueueConfig;
var createRedisConnection = function (config) {
    var redisConfig = config || (0, exports.getQueueConfig)().redis;
    var redis = new ioredis_1.default({
        host: redisConfig.host,
        port: redisConfig.port,
        password: redisConfig.password,
        db: redisConfig.db,
        lazyConnect: true,
        maxRetriesPerRequest: 3,
        enableReadyCheck: true,
        // Connection timeout settings
        connectTimeout: 5000,
        commandTimeout: 5000
    });
    var reconnectAttempts = 0;
    var maxReconnectAttempts = 10;
    var reconnectBackoff = 1000; // Start with 1 second
    // Add error handling for Redis connection
    redis.on('error', function (err) {
        console.warn("Redis connection error: ".concat(err.message));
    });
    redis.on('connect', function () {
        console.log('Redis connection established');
        // Reset reconnect attempts on successful connection
        reconnectAttempts = 0;
        reconnectBackoff = 1000;
    });
    redis.on('ready', function () {
        console.log('Redis is ready to accept commands');
    });
    redis.on('close', function () {
        console.warn('Redis connection closed');
    });
    redis.on('reconnecting', function (delay) {
        reconnectAttempts++;
        if (reconnectAttempts > maxReconnectAttempts) {
            console.error("Redis reconnection failed after ".concat(maxReconnectAttempts, " attempts. Stopping reconnection."));
            redis.disconnect(false); // Stop reconnecting
            return;
        }
        console.log("Redis reconnecting... (attempt ".concat(reconnectAttempts, "/").concat(maxReconnectAttempts, ", delay: ").concat(delay, "ms)"));
        // Exponential backoff
        reconnectBackoff = Math.min(reconnectBackoff * 1.5, 30000); // Max 30 seconds
    });
    return redis;
};
exports.createRedisConnection = createRedisConnection;
var createQueue = function (name, redisConnection) {
    var config = (0, exports.getQueueConfig)();
    var redis = redisConnection || (0, exports.createRedisConnection)();
    return new bull_1.default(name, {
        redis: {
            port: config.redis.port,
            host: config.redis.host,
            password: config.redis.password,
            db: config.redis.db,
        },
        defaultJobOptions: config.defaultJobOptions,
    });
};
exports.createQueue = createQueue;
var QueueManager = /** @class */ (function () {
    function QueueManager(redisConnection) {
        this.queues = new Map();
        this.connectionHealthy = false;
        this.hasGivenUpReconnecting = false;
        this.redisConnection = redisConnection || (0, exports.createRedisConnection)();
        this.setupConnectionMonitoring();
    }
    QueueManager.prototype.setupConnectionMonitoring = function () {
        var _this = this;
        this.redisConnection.on('ready', function () {
            _this.connectionHealthy = true;
            _this.hasGivenUpReconnecting = false;
            console.log('Queue Redis connection is healthy');
        });
        this.redisConnection.on('error', function (err) {
            _this.connectionHealthy = false;
            if (!_this.hasGivenUpReconnecting) {
                console.warn('Queue Redis connection unhealthy:', err.message);
            }
        });
        this.redisConnection.on('close', function () {
            _this.connectionHealthy = false;
            if (!_this.hasGivenUpReconnecting) {
                console.warn('Queue Redis connection closed');
            }
        });
        this.redisConnection.on('end', function () {
            _this.connectionHealthy = false;
            _this.hasGivenUpReconnecting = true;
            console.warn('Queue Redis has given up reconnecting - switching to fallback mode permanently');
        });
    };
    QueueManager.prototype.getQueue = function (name) {
        if (!this.queues.has(name)) {
            this.queues.set(name, (0, exports.createQueue)(name, this.redisConnection));
        }
        return this.queues.get(name);
    };
    QueueManager.prototype.closeAll = function () {
        return __awaiter(this, void 0, void 0, function () {
            var _i, _a, queue;
            return __generator(this, function (_b) {
                switch (_b.label) {
                    case 0:
                        _i = 0, _a = this.queues.values();
                        _b.label = 1;
                    case 1:
                        if (!(_i < _a.length)) return [3 /*break*/, 4];
                        queue = _a[_i];
                        return [4 /*yield*/, queue.close()];
                    case 2:
                        _b.sent();
                        _b.label = 3;
                    case 3:
                        _i++;
                        return [3 /*break*/, 1];
                    case 4:
                        this.queues.clear();
                        this.redisConnection.disconnect();
                        return [2 /*return*/];
                }
            });
        });
    };
    QueueManager.prototype.getQueueStats = function (name) {
        return __awaiter(this, void 0, void 0, function () {
            var queue;
            var _a;
            return __generator(this, function (_b) {
                switch (_b.label) {
                    case 0:
                        if (!this.connectionHealthy || this.hasGivenUpReconnecting) {
                            throw new Error('Redis connection is not healthy or has given up reconnecting');
                        }
                        queue = this.getQueue(name);
                        _a = {};
                        return [4 /*yield*/, queue.getWaiting()];
                    case 1:
                        _a.waiting = _b.sent();
                        return [4 /*yield*/, queue.getActive()];
                    case 2:
                        _a.active = _b.sent();
                        return [4 /*yield*/, queue.getCompleted()];
                    case 3:
                        _a.completed = _b.sent();
                        return [4 /*yield*/, queue.getFailed()];
                    case 4:
                        _a.failed = _b.sent();
                        return [4 /*yield*/, queue.getDelayed()];
                    case 5: return [2 /*return*/, (_a.delayed = _b.sent(),
                            _a)];
                }
            });
        });
    };
    /**
     * Check if Redis connection is healthy
     */
    QueueManager.prototype.isConnectionHealthy = function () {
        return this.connectionHealthy && !this.hasGivenUpReconnecting;
    };
    /**
     * Test Redis connection by performing a simple operation
     */
    QueueManager.prototype.testConnection = function () {
        return __awaiter(this, void 0, void 0, function () {
            var error_1;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        if (this.hasGivenUpReconnecting) {
                            return [2 /*return*/, false];
                        }
                        _a.label = 1;
                    case 1:
                        _a.trys.push([1, 3, , 4]);
                        return [4 /*yield*/, this.redisConnection.ping()];
                    case 2:
                        _a.sent();
                        return [2 /*return*/, true];
                    case 3:
                        error_1 = _a.sent();
                        return [2 /*return*/, false];
                    case 4: return [2 /*return*/];
                }
            });
        });
    };
    /**
     * Check if Redis has given up reconnecting
     */
    QueueManager.prototype.hasStoppedReconnecting = function () {
        return this.hasGivenUpReconnecting;
    };
    return QueueManager;
}());
exports.QueueManager = QueueManager;
