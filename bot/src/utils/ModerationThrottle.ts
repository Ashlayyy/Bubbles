// Basic in-memory rate-limit helper for moderation actions
// Will later be swapped for a distributed (Redis) version but keeps the same API.

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

// Map key → timestamps of recent actions
const buckets: Map<string, number[]> = new Map<string, number[]>();

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
  check(guildId: string, moderatorId: string, actionType: string): void {
    const rule = ACTION_RULES[actionType] ?? DEFAULT_RULE;
    const key = getKey(guildId, moderatorId, actionType);

    const now = Date.now();
    const windowStart = now - rule.windowMs;

    const timestamps = buckets.get(key) ?? [];
    // Remove expired timestamps
    const recent = timestamps.filter((ts) => ts >= windowStart);

    if (recent.length >= rule.max) {
      throw new ThrottleError(
        `Please slow down – you can perform at most ${rule.max} ${actionType.toLowerCase()}(s) every ${
          rule.windowMs / 1000
        } seconds.`
      );
    }

    // Record current action
    recent.push(now);
    buckets.set(key, recent);
  },
};
