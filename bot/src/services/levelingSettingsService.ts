import { prisma } from "../database/index.js";
import { CacheService } from "./cacheService.js";

export interface GuildLevelingSettings {
  enabled: boolean;
  xpPerMessage: number;
  xpCooldown: number; // seconds
  levelUpChannel: string | null;
  levelUpMessage: string | null;
  ignoredChannels: string[];
  ignoredRoles: string[];
  multiplierRoles: Array<{ roleId: string; multiplier: number }>;
  stackMultipliers: boolean;
  minMessageLength: number;
}

const DEFAULT_SETTINGS: GuildLevelingSettings = {
  enabled: true,
  xpPerMessage: 15,
  xpCooldown: 60,
  levelUpChannel: null,
  levelUpMessage: "Congratulations {user}! You reached level {level}! 🎉",
  ignoredChannels: [],
  ignoredRoles: [],
  multiplierRoles: [],
  stackMultipliers: false,
  minMessageLength: 0,
};

class LevelingSettingsService {
  private cache = new CacheService({ keyPrefix: "bubbles-bot:leveling", defaultTTL: 5 * 60 * 1000 });

  private cacheKey(guildId: string): string {
    return `settings:${guildId}`;
  }

  async getSettings(guildId: string): Promise<GuildLevelingSettings> {
    const key = this.cacheKey(guildId);
    const cached = await this.cache.get<GuildLevelingSettings>(key);
    if (cached) return cached;

    const db = await prisma.levelingSettings.findUnique({ where: { guildId } });
    const settings: GuildLevelingSettings = db
      ? {
          enabled: db.enabled,
          xpPerMessage: db.xpPerMessage,
          xpCooldown: db.xpCooldown,
          levelUpChannel: db.levelUpChannel ?? null,
          levelUpMessage: db.levelUpMessage ?? null,
          ignoredChannels: db.ignoredChannels ?? [],
          ignoredRoles: db.ignoredRoles ?? [],
          multiplierRoles: (db.multiplierRoles as any) ?? [],
          stackMultipliers: db.stackMultipliers ?? false,
          minMessageLength: db.minMessageLength ?? 0,
        }
      : { ...DEFAULT_SETTINGS };

    await this.cache.set(key, settings);
    return settings;
  }

  async updateSettings(guildId: string, patch: Partial<GuildLevelingSettings>): Promise<GuildLevelingSettings> {
    const existing = await this.getSettings(guildId);
    const updated: GuildLevelingSettings = { ...existing, ...patch };

    await prisma.levelingSettings.upsert({
      where: { guildId },
      update: {
        enabled: updated.enabled,
        xpPerMessage: updated.xpPerMessage,
        xpCooldown: updated.xpCooldown,
        levelUpChannel: updated.levelUpChannel ?? null,
        levelUpMessage: updated.levelUpMessage ?? null,
        ignoredChannels: updated.ignoredChannels,
        ignoredRoles: updated.ignoredRoles,
        multiplierRoles: updated.multiplierRoles as unknown as any,
        stackMultipliers: updated.stackMultipliers,
        minMessageLength: updated.minMessageLength,
      },
      create: {
        guildId,
        enabled: updated.enabled,
        xpPerMessage: updated.xpPerMessage,
        xpCooldown: updated.xpCooldown,
        levelUpChannel: updated.levelUpChannel ?? null,
        levelUpMessage: updated.levelUpMessage ?? null,
        ignoredChannels: updated.ignoredChannels,
        ignoredRoles: updated.ignoredRoles,
        multiplierRoles: updated.multiplierRoles as unknown as any,
        stackMultipliers: updated.stackMultipliers,
        minMessageLength: updated.minMessageLength,
      },
    });

    await this.cache.set(this.cacheKey(guildId), updated);
    return updated;
  }

  async invalidate(guildId: string): Promise<void> {
    await this.cache.delete(this.cacheKey(guildId));
  }
}

export const levelingSettingsService = new LevelingSettingsService();
