import type { GuildConfig } from "@prisma/client";
import { getCachedGuildConfig, GuildConfigCacheManager } from "./GuildConfigCache.js";

import logger from "../logger.js";
import { prisma } from "./index.js";

export const defaults: Omit<GuildConfig, "guildId" | "id"> = {
  maxMessagesCleared: 100,
  musicChannelId: "",
  defaultRepeatMode: 0,
  reactionRoleChannels: [],
  logReactionRoles: false,
  welcomeChannelId: null,
  goodbyeChannelId: null,
  welcomeEnabled: true,
  goodbyeEnabled: true,
  ticketChannelId: null,
  ticketCategoryId: null,
  useTicketThreads: true,
  ticketOnCallRoleId: null,
  ticketSilentClaim: true,
  ticketAccessType: null,
  ticketAccessRoleId: null,
  ticketAccessPermission: null,
  ticketLogChannelId: null,
  logSettingsId: null,
  appealSettingsId: null,
};
export const descriptions: Record<string, string> = {
  maxMessagesCleared: "Maximum number of messages `/clear` can delete in one command.",
  musicChannelId: "If specified, ALL music commands MUST be entered in this text channel!",
  defaultRepeatMode: "Default repeat mode of music player.",
  reactionRoleChannels: "Channels where reaction roles are allowed to be created.",
  logReactionRoles:
    "Enable database logging of reaction role activities. Use /logging command for channel-based logging.",
};

/**
 * Get the guild config data corresponding to guildId.
 * If does not exist, generate based on defaults!
 * Now uses advanced caching for optimal performance.
 */
export async function getGuildConfig(guildId: string): Promise<GuildConfig> {
  logger.verbose("DB.getGuildConfig()", { guildId });

  try {
    // Use the new cache service with getOrSet pattern for atomic operation
    return await GuildConfigCacheManager.getOrSetGuildConfig(guildId, async () => {
      logger.verbose("DB.getGuildConfig(): Cache miss, fetching from database");

      const existingConfig = await prisma.guildConfig.findUnique({
        where: { guildId },
      });

      if (existingConfig) {
        logger.verbose("DB.getGuildConfig(): Found existing config in database");
        return existingConfig;
      }

      // Create default config if it doesn't exist
      logger.verbose("DB.getGuildConfig(): Creating new default config");
      const defaultConfig = await prisma.guildConfig.create({
        data: {
          guildId,
          ...defaults,
        },
      });

      return defaultConfig;
    });
  } catch (error) {
    logger.error(`Error getting guild config for ${guildId}:`, error);

    // Fallback to legacy cache check
    const cachedConfig = getCachedGuildConfig(guildId);
    if (cachedConfig) {
      logger.warn("Using legacy cached config as fallback");
      return cachedConfig;
    }

    throw error;
  }
}

/** Update the guild config document corresponding to guildId with the data in guildConfig. */
export async function updateGuildConfig(
  guildId: string,
  data: Partial<Omit<GuildConfig, "id" | "guildId">>
): Promise<GuildConfig> {
  logger.verbose("DB.updateGuildConfig()", { guildId, data });

  const existingConfig = await getGuildConfig(guildId);

  const updatedConfig = await prisma.guildConfig.update({
    where: {
      id: existingConfig.id,
    },
    data,
  });

  // Use the new async cache manager for proper invalidation
  await GuildConfigCacheManager.setGuildConfigCached(guildId, updatedConfig);
  logger.verbose("DB.updateGuildConfig(): Cache updated", { guildId });

  return updatedConfig;
}

/** Delete the guild config document corresponding to guildId. */
export async function deleteGuildConfig(guildId: string): Promise<void> {
  logger.verbose("DB.deleteGuildConfig()", { guildId });

  await prisma.guildConfig.delete({
    where: {
      guildId,
    },
  });

  // Use the new async cache manager for proper deletion
  await GuildConfigCacheManager.deleteGuildConfigCached(guildId);
  logger.verbose("DB.deleteGuildConfig(): Cache invalidated", { guildId });
}

// Reaction role specific functions
export async function updateReactionRoleSettings(
  guildId: string,
  settings: {
    reactionRoleChannels?: string[];
    logReactionRoles?: boolean;
  }
): Promise<GuildConfig> {
  return await updateGuildConfig(guildId, settings);
}

export async function getReactionRoleSettings(guildId: string): Promise<{
  reactionRoleChannels: string[];
  logReactionRoles: boolean;
}> {
  const config = await getGuildConfig(guildId);
  return {
    reactionRoleChannels: config.reactionRoleChannels,
    logReactionRoles: config.logReactionRoles,
  };
}

export async function setWelcomeChannel(guildId: string, channelId: string): Promise<GuildConfig> {
  return await updateGuildConfig(guildId, { welcomeChannelId: channelId });
}

export async function setGoodbyeChannel(guildId: string, channelId: string): Promise<GuildConfig> {
  return await updateGuildConfig(guildId, { goodbyeChannelId: channelId });
}

export default { defaults, descriptions, getGuildConfig, updateGuildConfig, deleteGuildConfig };
