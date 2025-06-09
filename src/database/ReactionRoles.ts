import type { ReactionRole, ReactionRoleLog, ReactionRoleMessage } from "@prisma/client";
import { PrismaClient } from "@prisma/client";
import {
  ChatInputCommandInteraction,
  Client,
  EmbedBuilder,
  MessageContextMenuCommandInteraction,
  TextChannel,
} from "discord.js";
import { parseEmoji } from "../functions/general/emojis.js";
import logger from "../logger.js";

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
  // Check if logging is enabled for this guild
  const guildConfig = await prisma.guildConfig.findUnique({
    where: { guildId: data.guildId },
    select: { logReactionRoles: true, reactionRoleLoggingEnabled: true, reactionRoleLogChannelId: true },
  });

  if (guildConfig?.reactionRoleLoggingEnabled && guildConfig.reactionRoleLogChannelId) {
    try {
      const channel = await client.channels.fetch(guildConfig.reactionRoleLogChannelId);
      if (channel instanceof TextChannel) {
        const user = await client.users.fetch(data.userId);
        const reactionRole = await prisma.reactionRole.findFirst({
          where: { messageId: data.messageId, emoji: data.emoji },
          select: { channelId: true },
        });

        const roles = data.roleIds.map((id) => `<@&${id}>`).join(", ");
        const actionText = data.action === "ADDED" ? "gained" : "lost";
        const embed = new EmbedBuilder()
          .setColor(data.action === "ADDED" ? "Green" : "Red")
          .setTitle("Reaction Role Update")
          .setDescription(`<@${user.id}> has ${actionText} the following role(s): ${roles}`)
          .addFields(
            { name: "User", value: `${user.tag} (${user.id})`, inline: true },
            { name: "Action", value: data.action, inline: true },
            {
              name: "Source Message",
              value: reactionRole?.channelId
                ? `[Jump to message](https://discord.com/channels/${data.guildId}/${reactionRole.channelId}/${data.messageId})`
                : "Could not determine message.",
            }
          )
          .setFooter({ text: `User ID: ${user.id}` })
          .setTimestamp();

        await channel.send({ embeds: [embed] });
      }
    } catch (error) {
      logger.error("Failed to send reaction role log message:", error);
    }
  }

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
      ...data,
      reactionRoleId: reactionRole.id,
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

  return prisma.reactionRole.create({
    data: {
      messageId,
      emoji: emoji.identifier,
      roleIds: [roleId],
      guildId: interaction.guildId,
      channelId: interaction.channelId,
      createdBy: interaction.user.id,
    },
  });
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

  // Use soft delete approach for consistency
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
