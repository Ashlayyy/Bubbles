import Redis from "ioredis";

/**
 * CooldownStore provides per-user per-command cooldown tracking backed by Redis so that cooldowns
 * survive bot restarts and are shared across shards.
 */
class CooldownStore {
  private redis: Redis;

  constructor() {
    this.redis = new Redis({
      host: process.env.REDIS_HOST ?? "localhost",
      port: parseInt(process.env.REDIS_PORT ?? "6379"),
      password: process.env.REDIS_PASSWORD,
    });
  }

  private getKey(userId: string, commandName: string): string {
    return `cooldown:${commandName}:${userId}`;
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
}

export const cooldownStore = new CooldownStore();
