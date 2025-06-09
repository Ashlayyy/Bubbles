import type { GuildConfig } from "@prisma/client";
import { deleteCachedGuildConfig, getCachedGuildConfig, setCachedGuildConfig } from "./GuildConfigCache.js";

import logger from "../logger.js";
import { prisma } from "./index.js";

export const defaults: Omit<GuildConfig, "guildId" | "id"> = {
  maxMessagesCleared: 100,
  musicChannelId: "",
  defaultRepeatMode: 0,
  reactionRoleChannels: [],
  logReactionRoles: false,
  reactionRoleLoggingEnabled: false,
  reactionRoleLogChannelId: null,
  welcomeChannelId: null,
  goodbyeChannelId: null,
};
export const descriptions: Record<string, string> = {
  maxMessagesCleared: "Maximum number of messages `/clear` can delete in one command call.",
  musicChannelId: "If specified, ALL music commands MUST be entered in this text channel!",
  defaultRepeatMode: "Default repeat mode of music player.",
};

/** Get the guild config data corresponding to guildId. If does not exist, generate based on defaults! */
export async function getGuildConfig(guildId: string): Promise<GuildConfig> {
  logger.verbose("DB.getGuildConfig()", { guildId });

  const cachedConfig = getCachedGuildConfig(guildId);
  if (cachedConfig) {
    logger.verbose("DB.getGuildConfig(): Found cached config");
    return cachedConfig;
  }

  const existingConfig = await prisma.guildConfig.findUnique({
    where: {
      guildId,
    },
  });

  if (existingConfig) {
    setCachedGuildConfig(guildId, existingConfig);
    return existingConfig;
  }

  // Create default config if it doesn't exist
  logger.verbose("DB.getGuildConfig(): Could not find match, creating a new one");
  const defaultConfig = await prisma.guildConfig.create({
    data: {
      guildId,
      ...defaults,
    },
  });

  setCachedGuildConfig(guildId, defaultConfig);
  return defaultConfig;
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

  setCachedGuildConfig(guildId, updatedConfig);
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

  deleteCachedGuildConfig(guildId);
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
