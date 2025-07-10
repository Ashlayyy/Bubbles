import { RedisConnectionFactory } from "@shared/utils/RedisConnectionFactory";
import type { Redis } from "ioredis";

export class ThrottleError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ThrottleError";
  }
}

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

function getRedis(): Redis {
  return RedisConnectionFactory.getSharedConnection();
}

function getKey(guildId: string, moderatorId: string, actionType: string): string {
  return `modthrottle:${guildId}:${moderatorId}:${actionType}`;
}

/**
 * ModerationThrottle manages rate limiting for moderation actions to prevent abuse.
 * Uses Redis for shared state across bot instances.
 */
export const ModerationThrottle = {
  /**
   * Check if a moderation action is throttled for a user (backward compatible API).
   * @param guildId - The guild ID
   * @param moderatorId - The moderator user ID
   * @param actionType - The action type (e.g., 'BAN', 'KICK', 'TIMEOUT')
   * @throws ThrottleError if throttled
   */
  async check(guildId: string, moderatorId: string, actionType: string): Promise<void> {
    const rule = ACTION_RULES[actionType] ?? DEFAULT_RULE;
    const key = getKey(guildId, moderatorId, actionType);
    const now = Date.now();
    const windowStart = now - rule.windowMs;
    const redis = getRedis();

    // Remove expired entries and count current actions
    await redis.zremrangebyscore(key, 0, windowStart);
    const count = await redis.zcard(key);

    if (count >= rule.max) {
      throw new ThrottleError(
        `Please slow down – you can perform at most ${rule.max} ${actionType.toLowerCase()}(s) every ${
          rule.windowMs / 1000
        } seconds.`
      );
    }

    // Add current action
    await redis.zadd(key, now, `${now}-${Math.random()}`);
    await redis.expire(key, Math.ceil(rule.windowMs / 1000));
  },

  /**
   * Check if a moderation action is throttled for a user (new API).
   * @param userId - The user ID to check
   * @param action - The action type (e.g., 'ban', 'kick', 'mute')
   * @param windowMs - Time window in milliseconds
   * @param maxActions - Maximum actions allowed in the window
   * @returns Promise<boolean> - true if throttled, false if allowed
   */
  async isThrottled(userId: string, action: string, windowMs: number, maxActions: number): Promise<boolean> {
    const key = `modthrottle:${action}:${userId}`;
    const now = Date.now();
    const windowStart = now - windowMs;
    const redis = getRedis();

    // Remove expired entries and count current actions
    await redis.zremrangebyscore(key, 0, windowStart);
    const count = await redis.zcard(key);

    if (count >= maxActions) {
      return true; // Throttled
    }

    // Add current action
    await redis.zadd(key, now, `${now}-${Math.random()}`);
    await redis.expire(key, Math.ceil(windowMs / 1000));

    return false; // Not throttled
  },

  /**
   * Get the remaining cooldown time for a throttled action.
   * @param userId - The user ID
   * @param action - The action type
   * @param windowMs - Time window in milliseconds
   * @returns Promise<number> - Remaining time in milliseconds, 0 if not throttled
   */
  async getRemainingCooldown(userId: string, action: string, windowMs: number): Promise<number> {
    const key = `modthrottle:${action}:${userId}`;
    const redis = getRedis();
    const oldest = await redis.zrange(key, 0, 0, "WITHSCORES");

    if (oldest.length === 0) {
      return 0;
    }

    const oldestTimestamp = parseInt(oldest[1]);
    const remaining = oldestTimestamp + windowMs - Date.now();

    return Math.max(0, remaining);
  },

  /**
   * Clear throttle data for a user and action.
   * @param userId - The user ID
   * @param action - The action type
   */
  async clearThrottle(userId: string, action: string): Promise<void> {
    const key = `modthrottle:${action}:${userId}`;
    const redis = getRedis();
    await redis.del(key);
  },
};
