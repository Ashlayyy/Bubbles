import { RedisConnectionFactory } from "../../../shared/src/utils/RedisConnectionFactory";
import logger from "../logger.js";

/**
 * Cache entry with TTL support
 */
interface CacheEntry<T> {
  data: T;
  timestamp: number;
  ttl: number;
}

/**
 * Cache configuration options
 */
interface CacheOptions {
  defaultTTL?: number; // in milliseconds
  maxSize?: number;
  keyPrefix?: string;
}

/**
 * Cache statistics for monitoring
 */
export interface CacheStats {
  hits: number;
  misses: number;
  hitRatio: number;
  totalKeys: number;
  memoryUsage: number;
}

/**
 * Cache Service
 * Provides intelligent caching for API responses with TTL support
 */
class CacheService {
  private readonly redis = RedisConnectionFactory.getSharedConnection();
  private readonly defaultTTL: number;
  private readonly keyPrefix: string;

  constructor(options: CacheOptions = {}) {
    this.defaultTTL = (options.defaultTTL ?? 5) * 60 * 1000;
    this.keyPrefix = options.keyPrefix ?? "bubbles-bot";
  }

  private buildKey(key: string): string {
    return `${this.keyPrefix}:${key}`;
  }

  async get<T = any>(key: string): Promise<T | null> {
    const fullKey = this.buildKey(key);
    try {
      const value = await this.redis.get(fullKey);
      if (value === null) {
        logger.debug(`[CacheService] MISS for key: ${fullKey}`);
        return null;
      }
      logger.debug(`[CacheService] HIT for key: ${fullKey}`);
      return JSON.parse(value) as T;
    } catch (err) {
      logger.error(`[CacheService] ERROR on GET for key: ${fullKey}`, err);
      return null;
    }
  }

  async set(key: string, value: any, ttl?: number): Promise<void> {
    const fullKey = this.buildKey(key);
    try {
      await this.redis.set(fullKey, JSON.stringify(value), "PX", ttl ?? this.defaultTTL);
      logger.debug(`[CacheService] SET for key: ${fullKey} (ttl: ${ttl ?? this.defaultTTL}ms)`);
    } catch (err) {
      logger.error(`[CacheService] ERROR on SET for key: ${fullKey}`, err);
    }
  }

  async delete(key: string): Promise<boolean> {
    const fullKey = this.buildKey(key);
    try {
      const result = await this.redis.del(fullKey);
      logger.debug(`[CacheService] DEL for key: ${fullKey}`);
      return result > 0;
    } catch (err) {
      logger.error(`[CacheService] ERROR on DEL for key: ${fullKey}`, err);
      return false;
    }
  }

  async has(key: string): Promise<boolean> {
    const fullKey = this.buildKey(key);
    try {
      const exists = await this.redis.exists(fullKey);
      return exists === 1;
    } catch (err) {
      logger.error(`[CacheService] ERROR on EXISTS for key: ${fullKey}`, err);
      return false;
    }
  }

  async getOrSet<T>(key: string, fetchFunction: () => Promise<T>, ttl?: number): Promise<T> {
    const cached = await this.get<T>(key);
    if (cached !== null) {
      return cached;
    }
    const value = await fetchFunction();
    await this.set(key, value, ttl);
    return value;
  }

  async invalidatePattern(pattern: string): Promise<number> {
    // Redis doesn't support direct pattern deletion, so we scan and delete
    const scanPattern = `${this.keyPrefix}:${pattern.replace("*", "")}*`;
    let cursor = "0";
    let count = 0;
    do {
      const [nextCursor, keys] = await this.redis.scan(cursor, "MATCH", scanPattern, "COUNT", 100);
      cursor = nextCursor;
      if (keys.length > 0) {
        await this.redis.del(...keys);
        count += keys.length;
      }
    } while (cursor !== "0");
    logger.info(`[CacheService] Invalidated ${count} cache entries matching pattern: ${pattern}`);
    return count;
  }

  // Restored for compatibility: getStats, clear, warmUp
  async getStats(): Promise<{ totalKeys: number; memoryUsage: number }> {
    try {
      const info = await this.redis.info("memory");
      const regex = /used_memory:(\d+)/;
      const match = regex.exec(info);
      const memoryUsage = match ? parseInt(match[1], 10) : 0;
      const keys = await this.redis.keys(`${this.keyPrefix}:*`);
      return {
        totalKeys: keys.length,
        memoryUsage,
      };
    } catch (err) {
      logger.error("[CacheService] ERROR on getStats", err);
      return { totalKeys: 0, memoryUsage: 0 };
    }
  }

  async clear(): Promise<void> {
    await this.invalidatePattern("*");
    logger.info("[CacheService] Cleared all cache entries");
  }

  async warmUp(guildId: string): Promise<void> {
    logger.info(`[CacheService] Warm-up called for guild: ${guildId}`);
    // No-op for Redis, but kept for compatibility
    return;
  }
}

export const cacheService = new CacheService();

// Export class for testing
export { CacheService };
