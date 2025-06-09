import { GuildConfig } from "@prisma/client";

const guildConfigCache = new Map<string, GuildConfig>();

export function getCachedGuildConfig(guildId: string): GuildConfig | undefined {
  return guildConfigCache.get(guildId);
}

export function setCachedGuildConfig(guildId: string, config: GuildConfig): void {
  guildConfigCache.set(guildId, config);
}

export function deleteCachedGuildConfig(guildId: string): void {
  guildConfigCache.delete(guildId);
}
