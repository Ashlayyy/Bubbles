import type { VoiceState } from "discord.js";

import { prisma } from "../database/index.js";
import logger from "../logger.js";

export async function trackVoiceStateChange(oldState: VoiceState, newState: VoiceState): Promise<void> {
  const member = newState.member ?? oldState.member;
  if (!member || member.user.bot) return;

  const guildId = newState.guild.id;
  const userId = member.id;
  const oldChannelId = oldState.channelId;
  const newChannelId = newState.channelId;

  if (oldChannelId === newChannelId) return;

  const now = new Date();

  try {
    if (oldChannelId) {
      const open = await prisma.voiceSession.findFirst({
        where: { guildId, userId, channelId: oldChannelId, leftAt: null },
        orderBy: { joinedAt: "desc" },
      });
      if (open) {
        await prisma.voiceSession.update({
          where: { id: open.id },
          data: {
            leftAt: now,
            durationMs: Math.max(0, now.getTime() - open.joinedAt.getTime()),
          },
        });
      }
    }

    if (newChannelId && newState.channel) {
      await prisma.voiceSession.create({
        data: {
          guildId,
          userId,
          channelId: newChannelId,
          channelName: newState.channel.name,
          joinedAt: now,
        },
      });
    }
  } catch (error) {
    logger.warn("Failed to persist voice session:", error);
  }
}
