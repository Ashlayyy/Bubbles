import { GuildConfig } from "@shared/database";
import logger from "../logger.js";
import { cacheService } from "../services/cacheService.js";

// Legacy compatibility functions for existing code
export function setCachedGuildConfig(guildId: string, config: GuildConfig): void {
  // Set in new cache service asynchronously (TTL: 5 minutes)
  cacheService.set(`guild:config:${guildId}`, config, 5 * 60 * 1000);
  logger.debug(`Cached guild config for ${guildId}`);
}

export function deleteCachedGuildConfig(guildId: string): void {
  // Delete from new cache service asynchronously
  void cacheService.delete(`guild:config:${guildId}`);
  logger.debug(`Deleted cached guild config for ${guildId}`);
}

// New async cache functions
// eslint-disable-next-line @typescript-eslint/no-extraneous-class
export class GuildConfigCacheManager {
  private static readonly CACHE_PREFIX = "guild:config:";

  /**
   * Get guild config from cache
   */
  static async getGuildConfigCached(guildId: string): Promise<GuildConfig | null> {
    return await cacheService.get<GuildConfig>(`${this.CACHE_PREFIX}${guildId}`);
  }

  /**
   * Set guild config in cache
   */
  static async setGuildConfigCached(guildId: string, config: GuildConfig): Promise<void> {
    cacheService.set(`${this.CACHE_PREFIX}${guildId}`, config, 5 * 60 * 1000); // 5 minutes TTL
  }

  /**
   * Delete guild config from cache
   */
  static async deleteGuildConfigCached(guildId: string): Promise<void> {
    cacheService.delete(`${this.CACHE_PREFIX}${guildId}`);
  }

  /**
   * Get or set guild config with cache
   */
  static async getOrSetGuildConfig(guildId: string, getter: () => Promise<GuildConfig>): Promise<GuildConfig> {
    return await cacheService.getOrSet(`${this.CACHE_PREFIX}${guildId}`, getter, 5 * 60 * 1000); // 5 minutes TTL
  }

  /**
   * Bulk cache multiple guild configs
   */
  static async bulkCacheGuildConfigs(configs: { guildId: string; config: GuildConfig }[]): Promise<void> {
    // Since setBulk doesn't exist, we'll use individual set calls
    for (const { guildId, config } of configs) {
      cacheService.set(`${this.CACHE_PREFIX}${guildId}`, config, 5 * 60 * 1000);
    }
    logger.info(`Bulk cached ${configs.length} guild configurations`);
  }

  /**
   * Clear all guild config caches
   */
  static async clearAllGuildConfigs(): Promise<void> {
    cacheService.invalidatePattern(`${this.CACHE_PREFIX}.*`);
    logger.info("Cleared all guild config caches");
  }

  /**
   * Warm up cache for active guilds
   */
  static async warmupGuildConfigs(
    guildIds: string[],
    configGetter: (guildId: string) => Promise<GuildConfig>
  ): Promise<void> {
    logger.info(`Warming up guild config cache for ${guildIds.length} guilds...`);

    const configs = await Promise.all(
      guildIds.map(async (guildId) => {
        try {
          const config = await configGetter(guildId);
          return { guildId, config };
        } catch (error) {
          logger.error(`Failed to warm up config for guild ${guildId}:`, error);
          return null;
        }
      })
    );

    const validConfigs = configs.filter((c): c is { guildId: string; config: GuildConfig } => c !== null);

    if (validConfigs.length > 0) {
      await this.bulkCacheGuildConfigs(validConfigs);
    }

    logger.info(`Guild config cache warmup completed: ${validConfigs.length}/${guildIds.length} successful`);
  }
}

export default GuildConfigCacheManager;
