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
  private cache = new Map<string, CacheEntry<any>>();
  private readonly defaultTTL: number;
  private readonly maxSize: number;
  private readonly keyPrefix: string;
  private stats = { hits: 0, misses: 0 };

  constructor(options: CacheOptions = {}) {
    this.defaultTTL = (options.defaultTTL ?? 5) * 60 * 1000;
    this.maxSize = options.maxSize ?? 1000;
    this.keyPrefix = options.keyPrefix ?? "bot-cache";

    // Clean up expired entries every minute
    setInterval(() => {
      this.cleanup();
    }, 60 * 1000);
  }

  /**
   * Get value from cache
   */
  get(key: string): any {
    const fullKey = this.buildKey(key);
    const entry = this.cache.get(fullKey);

    if (!entry) {
      this.stats.misses++;
      return null;
    }

    // Check if expired
    if (Date.now() - entry.timestamp > entry.ttl) {
      this.cache.delete(fullKey);
      this.stats.misses++;
      return null;
    }

    this.stats.hits++;
    return entry.data;
  }

  /**
   * Set value in cache
   */
  set(key: string, value: any, ttl?: number): void {
    const fullKey = this.buildKey(key);
    const entry: CacheEntry<any> = {
      data: value,
      timestamp: Date.now(),
      ttl: ttl ?? this.defaultTTL,
    };

    // If cache is full, remove oldest entry
    if (this.cache.size >= this.maxSize) {
      const oldestKey = this.cache.keys().next().value;
      if (oldestKey) {
        this.cache.delete(oldestKey);
      }
    }

    this.cache.set(fullKey, entry);
  }

  /**
   * Delete value from cache
   */
  delete(key: string): boolean {
    const fullKey = this.buildKey(key);
    return this.cache.delete(fullKey);
  }

  /**
   * Clear all cache entries
   */
  clear(): void {
    this.cache.clear();
    this.stats.hits = 0;
    this.stats.misses = 0;
    logger.info("Cache cleared");
  }

  /**
   * Check if key exists in cache
   */
  has(key: string): boolean {
    const fullKey = this.buildKey(key);
    const entry = this.cache.get(fullKey);

    if (!entry) {
      return false;
    }

    // Check if expired
    if (Date.now() - entry.timestamp > entry.ttl) {
      this.cache.delete(fullKey);
      return false;
    }

    return true;
  }

  /**
   * Get cache statistics
   */
  getStats(): CacheStats {
    const totalRequests = this.stats.hits + this.stats.misses;
    const hitRatio = totalRequests > 0 ? this.stats.hits / totalRequests : 0;

    return {
      hits: this.stats.hits,
      misses: this.stats.misses,
      hitRatio: Math.round(hitRatio * 100) / 100,
      totalKeys: this.cache.size,
      memoryUsage: this.calculateMemoryUsage(),
    };
  }

  /**
   * Get or set value with async function
   */
  async getOrSet<T>(key: string, fetchFunction: () => Promise<T>, ttl?: number): Promise<T> {
    const cached = this.get(key) as T | null;
    if (cached !== null) {
      return cached;
    }

    const value = await fetchFunction();
    this.set(key, value, ttl);
    return value;
  }

  /**
   * Invalidate cache entries by pattern
   */
  invalidatePattern(pattern: string): number {
    const regex = new RegExp(pattern);
    let count = 0;

    for (const key of this.cache.keys()) {
      if (regex.test(key)) {
        this.cache.delete(key);
        count++;
      }
    }

    logger.info(`Invalidated ${String(count)} cache entries matching pattern: ${pattern}`);
    return count;
  }

  /**
   * Warm up cache with common data
   */
  warmUp(guildId: string): void {
    logger.info("Warming up cache for guild", { guildId });

    // This could be implemented to pre-fetch common data
    // For now, we'll just log the intent
    logger.info("Cache warm-up completed for guild", { guildId });
  }

  /**
   * Build full cache key with prefix
   */
  private buildKey(key: string): string {
    return `${this.keyPrefix}:${key}`;
  }

  /**
   * Clean up expired entries
   */
  private cleanup(): void {
    const now = Date.now();
    let cleanedCount = 0;

    for (const [key, entry] of this.cache.entries()) {
      if (now - entry.timestamp > entry.ttl) {
        this.cache.delete(key);
        cleanedCount++;
      }
    }

    if (cleanedCount > 0) {
      logger.debug(`Cleaned up ${String(cleanedCount)} expired cache entries`);
    }
  }

  /**
   * Calculate approximate memory usage
   */
  private calculateMemoryUsage(): number {
    // Rough estimate of memory usage in bytes
    let size = 0;
    for (const [key, entry] of this.cache.entries()) {
      size += key.length * 2; // Unicode chars are 2 bytes
      size += JSON.stringify(entry.data).length * 2;
      size += 16; // Approximate overhead per entry
    }
    return size;
  }
}

// Export singleton instance
export const cacheService = new CacheService({
  defaultTTL: 5 * 60 * 1000, // 5 minutes
  maxSize: 1000,
  keyPrefix: "bubbles-bot",
});

// Export class for testing
export { CacheService };
