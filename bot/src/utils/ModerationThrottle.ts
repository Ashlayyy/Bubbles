// Basic in-memory rate-limit helper for moderation actions
// Will later be swapped for a distributed (Redis) version but keeps the same API.

import Redis from "ioredis";

interface RateLimitRule {
  /** Time window in milliseconds */
  windowMs: number;
  /** Max allowed actions in the window */
  max: number;
}

const DEFAULT_RULE: RateLimitRule = { windowMs: 5_000, max: 1 };

// Custom rules per action type; fall back to DEFAULT_RULE if missing.
const ACTION_RULES: Record<string, RateLimitRule> = {
  BAN: { windowMs: 5_000, max: 1 },
  KICK: { windowMs: 5_000, max: 2 },
  TIMEOUT: { windowMs: 5_000, max: 3 },
};

const redis = new Redis({
  host: process.env.REDIS_HOST ?? "localhost",
  port: parseInt(process.env.REDIS_PORT ?? "6379"),
  password: process.env.REDIS_PASSWORD,
});

function getKey(guildId: string, moderatorId: string, actionType: string): string {
  return `${guildId}:${moderatorId}:${actionType}`;
}

export class ThrottleError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ThrottleError";
  }
}

export const ModerationThrottle = {
  async check(guildId: string, moderatorId: string, actionType: string): Promise<void> {
    const rule = ACTION_RULES[actionType] ?? DEFAULT_RULE;
    const key = getKey(guildId, moderatorId, actionType);

    const now = Date.now();
    const windowStart = now - rule.windowMs;

    // Use Redis sorted set per key; score = timestamp
    // Remove expired entries, then count
    await redis.zremrangebyscore(key, 0, windowStart);
    const count = await redis.zcard(key);
    if (count >= rule.max) {
      throw new ThrottleError(
        `Please slow down – you can perform at most ${rule.max} ${actionType.toLowerCase()}(s) every ${
          rule.windowMs / 1000
        } seconds.`
      );
    }

    await redis.zadd(key, Date.now(), `${now}`);
    // Set TTL slightly longer than window for cleanup
    await redis.pexpire(key, rule.windowMs + 1000);
  },
};
