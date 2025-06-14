import type { ReactionRole, ReactionRoleLog, ReactionRoleMessage } from "@prisma/client";
import { PrismaClient } from "@prisma/client";
import { ChatInputCommandInteraction, MessageContextMenuCommandInteraction } from "discord.js";
import { parseEmoji } from "../functions/general/emojis.js";
import logger from "../logger.js";
import type Client from "../structures/Client.js";

const prisma = new PrismaClient();

// ReactionRole operations
export async function createReactionRole(data: {
  guildId: string;
  channelId: string;
  messageId: string;
  emoji: string;
  roleIds: string[];
  createdBy: string;
}): Promise<ReactionRole> {
  return await prisma.reactionRole.create({
    data,
  });
}

export async function getReactionRolesByMessage(messageId: string): Promise<ReactionRole[]> {
  return await prisma.reactionRole.findMany({
    where: {
      messageId,
      isActive: true,
    },
  });
}

export async function getReactionRoleByEmojiAndMessage(messageId: string, emoji: string): Promise<ReactionRole | null> {
  return await prisma.reactionRole.findUnique({
    where: {
      messageId_emoji: {
        messageId,
        emoji,
      },
      isActive: true,
    },
  });
}

export async function deleteReactionRole(messageId: string, emoji: string): Promise<void> {
  await prisma.reactionRole.update({
    where: {
      messageId_emoji: {
        messageId,
        emoji,
      },
    },
    data: {
      isActive: false,
    },
  });
}

export async function deleteAllReactionRolesByMessage(messageId: string): Promise<void> {
  await prisma.reactionRole.updateMany({
    where: {
      messageId,
    },
    data: {
      isActive: false,
    },
  });
}

// ReactionRoleMessage operations
export async function createReactionRoleMessage(data: {
  guildId: string;
  channelId: string;
  messageId: string;
  title: string;
  description?: string;
  embedColor?: string;
  createdBy: string;
}): Promise<ReactionRoleMessage> {
  return await prisma.reactionRoleMessage.create({
    data,
  });
}

export async function getReactionRoleMessage(messageId: string): Promise<ReactionRoleMessage | null> {
  return await prisma.reactionRoleMessage.findUnique({
    where: {
      messageId,
      isActive: true,
    },
  });
}

export async function getReactionRoleMessagesByGuild(guildId: string): Promise<ReactionRoleMessage[]> {
  return await prisma.reactionRoleMessage.findMany({
    where: {
      guildId,
      isActive: true,
    },
    orderBy: {
      createdAt: "desc",
    },
  });
}

export async function updateReactionRoleMessage(
  messageId: string,
  data: {
    title?: string;
    description?: string;
    embedColor?: string;
  }
): Promise<ReactionRoleMessage> {
  return await prisma.reactionRoleMessage.update({
    where: {
      messageId,
    },
    data: {
      ...data,
      updatedAt: new Date(),
    },
  });
}

export async function deleteReactionRoleMessage(messageId: string): Promise<void> {
  // Soft delete the message and all associated reactions
  await prisma.reactionRoleMessage.update({
    where: {
      messageId,
    },
    data: {
      isActive: false,
    },
  });

  await deleteAllReactionRolesByMessage(messageId);
}

// ReactionRoleLog operations
export async function logReactionRoleAction(
  client: Client,
  data: {
    guildId: string;
    userId: string;
    messageId: string;
    emoji: string;
    roleIds: string[];
    action: "ADDED" | "REMOVED";
  }
): Promise<ReactionRoleLog | null> {
  // Use the new LogManager for logging instead of direct channel approach
  try {
    const reactionRole = await prisma.reactionRole.findFirst({
      where: { messageId: data.messageId, emoji: data.emoji },
      select: { channelId: true },
    });

    // Get role information for logging
    const guild = await client.guilds.fetch(data.guildId);
    const roles = await Promise.all(
      data.roleIds.map(async (roleId) => {
        try {
          const role = await guild.roles.fetch(roleId);
          return role?.name ?? "Unknown Role";
        } catch {
          return "Unknown Role";
        }
      })
    );

    // Log using the new LogManager system
    const logType = data.action === "ADDED" ? "REACTION_ROLE_ADDED" : "REACTION_ROLE_REMOVED";
    await client.logManager.log(data.guildId, logType, {
      userId: data.userId,
      channelId: reactionRole?.channelId,
      roleId: data.roleIds[0], // Use first role ID
      metadata: {
        emoji: data.emoji,
        roleName: roles[0],
        roleNames: roles,
        messageId: data.messageId,
        action: data.action,
        messageUrl: reactionRole?.channelId
          ? `https://discord.com/channels/${data.guildId}/${reactionRole.channelId}/${data.messageId}`
          : null,
      },
    });
  } catch (error) {
    logger.error("Failed to log reaction role action:", error);
    // Log the error using LogManager too
    try {
      await client.logManager.log(data.guildId, "REACTION_ROLE_ERROR", {
        userId: data.userId,
        metadata: {
          error: error instanceof Error ? error.message : "Unknown error",
          action: data.action,
          emoji: data.emoji,
          messageId: data.messageId,
        },
      });
    } catch (logError) {
      logger.error("Failed to log reaction role error:", logError);
    }
  }

  // Still create database log entry if enabled
  const guildConfig = await prisma.guildConfig.findUnique({
    where: { guildId: data.guildId },
    select: { logReactionRoles: true },
  });

  if (!guildConfig?.logReactionRoles) {
    return null;
  }

  // Find the reaction role to get the ID
  const reactionRole = await prisma.reactionRole.findUnique({
    where: {
      messageId_emoji: {
        messageId: data.messageId,
        emoji: data.emoji,
      },
    },
  });

  if (!reactionRole) {
    logger.warn("Trying to log action for non-existent reaction role", data);
    return null;
  }

  return await prisma.reactionRoleLog.create({
    data: {
      guildId: data.guildId,
      userId: data.userId,
      messageId: data.messageId,
      emoji: data.emoji,
      roleId: data.roleIds[0], // Use first role ID
      action: data.action === "ADDED" ? "ADD" : "REMOVE",
    },
  });
}

export async function getReactionRoleLogs(
  guildId: string,
  options?: {
    userId?: string;
    messageId?: string;
    limit?: number;
  }
): Promise<ReactionRoleLog[]> {
  return await prisma.reactionRoleLog.findMany({
    where: {
      guildId,
      ...(options?.userId && { userId: options.userId }),
      ...(options?.messageId && { messageId: options.messageId }),
    },
    orderBy: {
      timestamp: "desc",
    },
    take: options?.limit ?? 100,
  });
}

export async function addReactionRole(
  interaction: ChatInputCommandInteraction | MessageContextMenuCommandInteraction,
  messageId: string,
  emojiRaw: string,
  roleId: string
): Promise<ReactionRole | null> {
  if (!interaction.guildId || !interaction.channelId) {
    throw new Error("Interaction is not in a guild context.");
  }

  const emoji = parseEmoji(emojiRaw, interaction.client);
  if (!emoji) {
    // Could not parse emoji
    return null;
  }

  const result = await prisma.reactionRole.create({
    data: {
      messageId,
      emoji: emoji.identifier,
      roleIds: [roleId],
      guildId: interaction.guildId,
      channelId: interaction.channelId,
      createdBy: interaction.user.id,
    },
  });

  // Log the configuration addition
  try {
    const guild = await interaction.client.guilds.fetch(interaction.guildId);
    const role = await guild.roles.fetch(roleId);

    await (interaction.client as Client).logManager.log(interaction.guildId, "REACTION_ROLE_CONFIG_ADD", {
      userId: interaction.user.id,
      channelId: interaction.channelId,
      roleId: roleId,
      executorId: interaction.user.id,
      metadata: {
        emoji: emojiRaw,
        roleName: role?.name ?? "Unknown Role",
        messageId: messageId,
        messageUrl: `https://discord.com/channels/${interaction.guildId}/${interaction.channelId}/${messageId}`,
      },
    });
  } catch (error) {
    logger.error("Failed to log reaction role config addition:", error);
  }

  return result;
}

export async function removeReactionRole(
  client: Client,
  messageId: string,
  emojiRaw: string
): Promise<{ count: number }> {
  const emoji = parseEmoji(emojiRaw, client);
  if (!emoji) {
    // Or handle error appropriately
    return { count: 0 };
  }

  // Get the reaction role info before removing it for logging
  const reactionRole = await prisma.reactionRole.findFirst({
    where: {
      messageId,
      emoji: emoji.identifier,
      isActive: true,
    },
  });

  const result = await prisma.reactionRole.updateMany({
    where: {
      messageId,
      emoji: emoji.identifier,
      isActive: true, // Only update active records
    },
    data: {
      isActive: false,
    },
  });

  // Log the configuration removal
  if (reactionRole && result.count > 0) {
    try {
      const guild = await client.guilds.fetch(reactionRole.guildId);
      const role = await guild.roles.fetch(reactionRole.roleIds[0]);

      await client.logManager.log(reactionRole.guildId, "REACTION_ROLE_CONFIG_REMOVE", {
        channelId: reactionRole.channelId,
        roleId: reactionRole.roleIds[0],
        metadata: {
          emoji: emojiRaw,
          roleName: role?.name ?? "Unknown Role",
          messageId: messageId,
          messageUrl: `https://discord.com/channels/${reactionRole.guildId}/${reactionRole.channelId}/${messageId}`,
        },
      });
    } catch (error) {
      logger.error("Failed to log reaction role config removal:", error);
    }
  }

  return { count: result.count };
}

// Add utility function for permanent cleanup of soft-deleted records
export async function permanentlyDeleteReactionRoles(guildId?: string, olderThanDays = 30): Promise<{ count: number }> {
  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - olderThanDays);

  const result = await prisma.reactionRole.deleteMany({
    where: {
      isActive: false,
      createdAt: {
        lt: cutoffDate,
      },
      ...(guildId && { guildId }),
    },
  });

  return { count: result.count };
}
