import type { ReactionRole, ReactionRoleLog, ReactionRoleMessage } from "@prisma/client";

import { prisma } from "./index.js";

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
export async function logReactionRoleAction(data: {
  guildId: string;
  userId: string;
  messageId: string;
  emoji: string;
  roleIds: string[];
  action: "ADDED" | "REMOVED";
}): Promise<ReactionRoleLog | null> {
  // Check if logging is enabled for this guild
  const guildConfig = await prisma.guildConfig.findUnique({
    where: { guildId: data.guildId },
    select: { logReactionRoles: true },
  });

  if (!guildConfig?.logReactionRoles) {
    return null;
  }

  return await prisma.reactionRoleLog.create({
    data,
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
