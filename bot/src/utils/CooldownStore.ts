import { RedisConnectionFactory } from "@shared/utils/RedisConnectionFactory";
import type { Redis } from "ioredis";

/**
 * CooldownStore provides per-user per-command cooldown tracking backed by Redis so that cooldowns
 * survive bot restarts and are shared across shards.
 * Extended to support guild-level rate limiting via requestToken API.
 */
class CooldownStore {
  private get redis(): Redis {
    return RedisConnectionFactory.getSharedConnection();
  }

  private getKey(userId: string, commandName: string): string {
    return `cooldown:${commandName}:${userId}`;
  }

  private getGuildKey(guildId: string, commandName: string): string {
    return `cooldown:guild:${commandName}:${guildId}`;
  }

  /**
   * Try to consume a cooldown token. Returns true if token consumed (no cooldown active),
   * false if still on cooldown.
   */
  async tryConsume(userId: string, commandName: string, cooldownMs: number): Promise<boolean> {
    const key = this.getKey(userId, commandName);
    // Use SETNX with expiry: only set if not existing
    const result = await this.redis.set(key, "1", "PX", cooldownMs, "NX");
    return result === "OK";
  }

  /** Get remaining cooldown in ms or 0 if none */
  async getRemaining(userId: string, commandName: string): Promise<number> {
    const key = this.getKey(userId, commandName);
    const ttl = await this.redis.pttl(key);
    return ttl < 0 ? 0 : ttl;
  }

  /**
   * Request a token for rate limiting. Supports both user-level and guild-level limits.
   * Returns true if token granted, false if rate limited.
   */
  async requestToken(params: {
    userId?: string;
    guildId?: string;
    commandName?: string;
    cooldownMs?: number;
  }): Promise<boolean> {
    const { userId, guildId, commandName = "default", cooldownMs = 1000 } = params;

    if (userId && guildId) {
      // Check both user and guild limits
      const userKey = this.getKey(userId, commandName);
      const guildKey = this.getGuildKey(guildId, commandName);

      const [userResult, guildResult] = await Promise.all([
        this.redis.set(userKey, "1", "PX", cooldownMs, "NX"),
        this.redis.set(guildKey, "1", "PX", cooldownMs, "NX"),
      ]);

      return userResult === "OK" && guildResult === "OK";
    } else if (userId) {
      // User-only limit
      return await this.tryConsume(userId, commandName, cooldownMs);
    } else if (guildId) {
      // Guild-only limit
      const key = this.getGuildKey(guildId, commandName);
      const result = await this.redis.set(key, "1", "PX", cooldownMs, "NX");
      return result === "OK";
    }

    return false;
  }
}

export const cooldownStore = new CooldownStore();
