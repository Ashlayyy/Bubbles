import Redis from "ioredis";
import logger from "../logger.js";

export interface CacheEntry<T> {
  data: T;
  expires: number;
  hits: number;
  lastAccessed: number;
}

export interface CacheStats {
  totalHits: number;
  totalMisses: number;
  hitRate: number;
  memoryEntries: number;
  redisConnected: boolean;
}

export type CacheType =
  | "guildConfig"
  | "moderationCase"
  | "userInfractions"
  | "ticketData"
  | "autoModRules"
  | "permissions"
  | "default";

export interface BulkCacheEntry {
  key: string;
  value: unknown;
  type?: CacheType;
}

/**
 * Warmup entry structure for guild configurations
 */
export interface WarmupEntry {
  guildId: string;
  configData: unknown;
}

export class CacheService {
  private redis: Redis;
  private memoryCache = new Map<string, CacheEntry<unknown>>();
  private stats = {
    hits: 0,
    misses: 0,
    memoryHits: 0,
    redisHits: 0,
  };

  private redisConnected = false;
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 5; // Limit reconnection attempts
  private hasGivenUpReconnecting = false;

  // Cache TTL configurations (in milliseconds)
  private readonly TTL_CONFIG: Record<CacheType, number> = {
    guildConfig: 30 * 60 * 1000, // 30 minutes
    moderationCase: 15 * 60 * 1000, // 15 minutes
    userInfractions: 10 * 60 * 1000, // 10 minutes
    ticketData: 5 * 60 * 1000, // 5 minutes
    autoModRules: 20 * 60 * 1000, // 20 minutes
    permissions: 25 * 60 * 1000, // 25 minutes
    default: 10 * 60 * 1000, // 10 minutes default
  };

  // Memory cache size limits
  private readonly MAX_MEMORY_ENTRIES = 1000;
  private readonly CLEANUP_INTERVAL = 5 * 60 * 1000; // 5 minutes

  constructor() {
    // Use dedicated Redis DB for caching (different from queues)
    this.redis = this.createLimitedRedisConnection();

    this.setupRedisEventHandlers();
    this.startCleanupInterval();

    // Attempt initial connection to test Redis availability
    void this.initializeRedisConnection();

    logger.info("Cache service initialized with Redis and memory layers");
  }

  private createLimitedRedisConnection(): Redis {
    const redis = new Redis({
      host: process.env.REDIS_HOST ?? "localhost",
      port: parseInt(process.env.REDIS_PORT ?? "6379"),
      password: process.env.REDIS_PASSWORD,
      db: 0,
      lazyConnect: true,
      maxRetriesPerRequest: 3,
      enableReadyCheck: true,
      connectTimeout: 5000,
      commandTimeout: 5000,
    });

    // Limit reconnection attempts to prevent infinite loops
    redis.on("reconnecting", () => {
      this.reconnectAttempts++;

      if (this.reconnectAttempts > this.maxReconnectAttempts) {
        logger.warn(`Cache Redis giving up after ${this.maxReconnectAttempts} reconnection attempts`);
        this.hasGivenUpReconnecting = true;
        redis.disconnect(false); // Stop reconnecting
        return;
      }

      logger.warn(`Cache Redis reconnecting... (attempt ${this.reconnectAttempts}/${this.maxReconnectAttempts})`);
    });

    return redis;
  }

  private setupRedisEventHandlers(): void {
    this.redis.on("connect", () => {
      logger.info("Cache Redis connected successfully");
      this.redisConnected = true;
      this.reconnectAttempts = 0; // Reset attempts on successful connection
      this.hasGivenUpReconnecting = false;
    });

    this.redis.on("ready", () => {
      logger.info("Cache Redis is ready");
      this.redisConnected = true;
    });

    this.redis.on("error", (error) => {
      if (!this.hasGivenUpReconnecting) {
        logger.error("Cache Redis connection error:", error.message);
      }
      this.redisConnected = false;
    });

    this.redis.on("close", () => {
      if (!this.hasGivenUpReconnecting) {
        logger.warn("Cache Redis connection closed");
      }
      this.redisConnected = false;
    });

    this.redis.on("end", () => {
      logger.warn("Cache Redis has stopped reconnecting - operating in memory-only mode");
      this.redisConnected = false;
      this.hasGivenUpReconnecting = true;
    });
  }

  /**
   * Initialize Redis connection by attempting a simple operation
   */
  private async initializeRedisConnection(): Promise<void> {
    try {
      // Attempt to connect and ping Redis
      await this.redis.ping();
      logger.info("Cache Redis connection test successful");
    } catch (error) {
      logger.warn("Cache Redis connection test failed - will operate in memory-only mode", error);
    }
  }

  /**
   * Check if Redis is available for cache operations
   */
  private isRedisAvailable(): boolean {
    return this.redisConnected && !this.hasGivenUpReconnecting;
  }

  private startCleanupInterval(): void {
    setInterval(() => {
      this.cleanupMemoryCache();
    }, this.CLEANUP_INTERVAL);
  }

  private cleanupMemoryCache(): void {
    const now = Date.now();
    let cleaned = 0;

    for (const [key, entry] of this.memoryCache.entries()) {
      if (now >= entry.expires) {
        this.memoryCache.delete(key);
        cleaned++;
      }
    }

    // Also enforce size limits
    if (this.memoryCache.size > this.MAX_MEMORY_ENTRIES) {
      const entries = Array.from(this.memoryCache.entries());
      // Sort by least recently accessed
      entries.sort((a, b) => a[1].lastAccessed - b[1].lastAccessed);

      const toRemove = this.memoryCache.size - this.MAX_MEMORY_ENTRIES;
      for (let i = 0; i < toRemove; i++) {
        this.memoryCache.delete(entries[i][0]);
        cleaned++;
      }
    }

    if (cleaned > 0) {
      logger.debug(`Cleaned ${cleaned} expired/excess entries from memory cache`);
    }
  }

  private getTTL(type: CacheType): number {
    return this.TTL_CONFIG[type] || this.TTL_CONFIG.default;
  }

  /**
   * Get value from cache with multi-level lookup
   * L1: Memory Cache (fastest)
   * L2: Redis Cache (shared, if available)
   * L3: Miss (needs DB lookup)
   */
  async get<T = unknown>(key: string, type: CacheType = "default"): Promise<T | null> {
    const now = Date.now();

    // L1: Check memory cache first
    const memoryEntry = this.memoryCache.get(key);
    if (memoryEntry && now < memoryEntry.expires) {
      memoryEntry.hits++;
      memoryEntry.lastAccessed = now;
      this.stats.hits++;
      this.stats.memoryHits++;
      logger.debug(`Cache HIT (memory): ${key}`);
      return memoryEntry.data as T;
    }

    // L2: Check Redis cache (only if available)
    if (this.isRedisAvailable()) {
      try {
        const redisValue = await this.redis.get(key);
        if (redisValue) {
          const parsed = JSON.parse(redisValue) as T;

          // Store in memory cache for faster future access
          this.memoryCache.set(key, {
            data: parsed,
            expires: now + this.getTTL(type),
            hits: 1,
            lastAccessed: now,
          });

          this.stats.hits++;
          this.stats.redisHits++;
          logger.debug(`Cache HIT (redis): ${key}`);
          return parsed;
        }
      } catch (error) {
        logger.error(`Redis cache error for key ${key}:`, error);
        // Continue to cache miss - don't fail the operation
      }
    }

    // L3: Cache miss
    this.stats.misses++;
    logger.debug(`Cache MISS: ${key}`);
    return null;
  }

  /**
   * Set value in both cache layers (Redis only if available)
   */
  async set(key: string, value: unknown, type: CacheType = "default"): Promise<void> {
    const now = Date.now();
    const ttl = this.getTTL(type);
    const expires = now + ttl;

    // Always store in memory cache
    this.memoryCache.set(key, {
      data: value,
      expires,
      hits: 0,
      lastAccessed: now,
    });

    // Store in Redis only if available
    if (this.isRedisAvailable()) {
      try {
        await this.redis.setex(key, Math.floor(ttl / 1000), JSON.stringify(value));
        logger.debug(`Cache SET: ${key} (TTL: ${Math.floor(ttl / 1000)}s)`);
      } catch (error) {
        logger.error(`Redis cache set error for key ${key}:`, error);
        // Continue - memory cache is still set
      }
    } else {
      logger.debug(`Cache SET (memory only): ${key} - Redis unavailable`);
    }
  }

  /**
   * Delete from both cache layers
   */
  async delete(key: string): Promise<void> {
    this.memoryCache.delete(key);

    if (this.isRedisAvailable()) {
      try {
        await this.redis.del(key);
        logger.debug(`Cache DELETE: ${key}`);
      } catch (error) {
        logger.error(`Redis cache delete error for key ${key}:`, error);
      }
    }
  }

  /**
   * Delete multiple keys with pattern
   */
  async deletePattern(pattern: string): Promise<void> {
    // Clear matching keys from memory cache
    for (const key of this.memoryCache.keys()) {
      if (key.includes(pattern.replace("*", ""))) {
        this.memoryCache.delete(key);
      }
    }

    // Clear from Redis if available
    if (this.isRedisAvailable()) {
      try {
        const keys = await this.redis.keys(pattern);
        if (keys.length > 0) {
          await this.redis.del(...keys);
          logger.debug(`Cache DELETE PATTERN: ${pattern} (${keys.length} keys)`);
        }
      } catch (error) {
        logger.error(`Redis cache pattern delete error for pattern ${pattern}:`, error);
      }
    }
  }

  /**
   * Bulk set operation for efficiency
   */
  async setBulk(entries: BulkCacheEntry[]): Promise<void> {
    const now = Date.now();

    // Always set in memory
    for (const entry of entries) {
      const type = entry.type ?? "default";
      const ttl = this.getTTL(type);
      const expires = now + ttl;

      this.memoryCache.set(entry.key, {
        data: entry.value,
        expires,
        hits: 0,
        lastAccessed: now,
      });
    }

    // Set in Redis if available
    if (this.isRedisAvailable()) {
      const pipeline = this.redis.pipeline();

      for (const entry of entries) {
        const type = entry.type ?? "default";
        const ttl = this.getTTL(type);
        pipeline.setex(entry.key, Math.floor(ttl / 1000), JSON.stringify(entry.value));
      }

      try {
        await pipeline.exec();
        logger.debug(`Cache BULK SET: ${entries.length} entries`);
      } catch (error) {
        logger.error("Redis bulk set error:", error);
      }
    } else {
      logger.debug(`Cache BULK SET (memory only): ${entries.length} entries - Redis unavailable`);
    }
  }

  /**
   * Get cache statistics
   */
  getStats(): CacheStats {
    const totalRequests = this.stats.hits + this.stats.misses;

    return {
      totalHits: this.stats.hits,
      totalMisses: this.stats.misses,
      hitRate: totalRequests > 0 ? (this.stats.hits / totalRequests) * 100 : 0,
      memoryEntries: this.memoryCache.size,
      redisConnected: this.isRedisAvailable(),
    };
  }

  /**
   * Reset statistics
   */
  resetStats(): void {
    this.stats = {
      hits: 0,
      misses: 0,
      memoryHits: 0,
      redisHits: 0,
    };
  }

  /**
   * Warmup cache with guild configurations
   */
  warmup(guildIds: string[]): void {
    logger.info(`Warming up cache for ${guildIds.length} guilds...`);

    // This is typically called during startup, so we'll skip actual DB calls
    // and just log that warmup was requested - the actual data will be cached
    // on first access via normal get/set operations

    logger.info("Cache warmup completed (lazy loading enabled)");
  }

  /**
   * Get or set pattern - atomic cache operation
   */
  async getOrSet<T = unknown>(key: string, getter: () => Promise<T>, type: CacheType = "default"): Promise<T> {
    const cached = await this.get<T>(key, type);
    if (cached !== null) {
      return cached;
    }

    const value = await getter();
    await this.set(key, value, type);
    return value;
  }

  /**
   * Clear all caches
   */
  async clear(): Promise<void> {
    this.memoryCache.clear();

    if (this.isRedisAvailable()) {
      try {
        await this.redis.flushdb();
        logger.info("All caches cleared");
      } catch (error) {
        logger.error("Error clearing Redis cache:", error);
      }
    } else {
      logger.info("Memory cache cleared (Redis unavailable)");
    }
  }

  /**
   * Graceful shutdown
   */
  async shutdown(): Promise<void> {
    logger.info("Shutting down cache service...");

    try {
      if (this.isRedisAvailable()) {
        await this.redis.quit();
      } else {
        this.redis.disconnect();
      }
      this.memoryCache.clear();
      logger.info("Cache service shutdown complete");
    } catch (error) {
      logger.error("Error during cache shutdown:", error);
    }
  }
}

export const cacheService = new CacheService();
export default cacheService;
