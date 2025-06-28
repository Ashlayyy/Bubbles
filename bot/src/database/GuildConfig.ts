import type { GuildConfig } from "@shared/database";
import { GuildConfigCacheManager } from "./GuildConfigCache.js";

import logger from "../logger.js";
import { prisma } from "./index.js";

export const defaults: Omit<GuildConfig, "guildId" | "id"> & {
  notify_user: boolean;
  reportChannelId: string | null;
  reportPingRoleId: string | null;
} = {
  maxMessagesCleared: 100,
  musicChannelId: "",
  defaultRepeatMode: 0,
  reactionRoleChannels: [],
  logReactionRoles: false,
  welcomeChannelId: null,
  goodbyeChannelId: null,
  welcomeEnabled: true,
  goodbyeEnabled: true,
  moderatorRoleIds: [],
  welcomeStats: {},
  ticketChannelId: null,
  ticketCategoryId: null,
  useTicketThreads: true,
  ticketOnCallRoleId: null,
  ticketSilentClaim: true,
  ticketAccessType: null,
  ticketAccessRoleId: null,
  ticketAccessPermission: null,
  ticketLogChannelId: null,
  reportChannelId: null,
  reportPingRoleId: null,
  logSettingsId: null,
  appealSettingsId: null,
  notify_user: false,
};
export const descriptions: Record<string, string> = {
  maxMessagesCleared: "Maximum number of messages `/clear` can delete in one command.",
  musicChannelId: "If specified, ALL music commands MUST be entered in this text channel!",
  defaultRepeatMode: "Default repeat mode of music player.",
  reactionRoleChannels: "Channels where reaction roles are allowed to be created.",
  logReactionRoles:
    "Enable database logging of reaction role activities. Use /logging command for channel-based logging.",
  notify_user: "Send direct messages to users for moderation actions by default.",
  reportChannelId: "Channel where user reports will be sent.",
  reportPingRoleId: "Role that will be pinged when a new user report is submitted.",
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
    const config = await GuildConfigCacheManager.getOrSetGuildConfig(guildId, async (): Promise<GuildConfig> => {
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

    // Ensure we have a valid GuildConfig with guildId
    if (!config.guildId) {
      throw new Error(`Invalid guild config returned for ${guildId}`);
    }

    return config;
  } catch (error) {
    logger.error(`Error getting guild config for ${guildId}:`, error);

    // Final fallback: create a default config directly
    logger.warn(`Creating emergency default config for guild ${guildId}`);
    try {
      const emergencyConfig = await prisma.guildConfig.create({
        data: {
          guildId,
          ...defaults,
        },
      });
      return emergencyConfig;
    } catch (createError) {
      logger.error("Failed to create emergency config:", createError);
      throw new Error(
        `Unable to get or create guild config for ${guildId}: ${error instanceof Error ? error.message : "Unknown error"}`
      );
    }
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

interface GuildConfigModule {
  defaults: typeof defaults;
  descriptions: typeof descriptions;
  getGuildConfig: typeof getGuildConfig;
  updateGuildConfig: typeof updateGuildConfig;
  deleteGuildConfig: typeof deleteGuildConfig;
}

const GuildConfigModule: GuildConfigModule = {
  defaults,
  descriptions,
  getGuildConfig,
  updateGuildConfig,
  deleteGuildConfig,
};

export default GuildConfigModule;
