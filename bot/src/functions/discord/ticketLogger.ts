import type { Prisma } from "@shared/database";
import { EmbedBuilder, type Guild } from "discord.js";

import { getGuildConfig } from "../../database/GuildConfig.js";
import { prisma } from "../../database/index.js";
import logger from "../../logger.js";

export interface TicketLogData {
  ticketId?: string;
  ticketNumber?: number;
  userId: string;
  channelId?: string;
  action: string;
  details?: string;
  metadata?: Record<string, unknown>;
}

export async function logTicketEvent(
  guild: Guild,
  eventType: "CREATE" | "CLOSE" | "CLAIM" | "ASSIGN" | "MESSAGE" | "UPDATE",
  data: TicketLogData
): Promise<void> {
  try {
    const config = await getGuildConfig(guild.id);

    if (!config.ticketLogChannelId) {
      return;
    }
    const channelId = config.ticketLogChannelId as string;
    const logChannel = guild.channels.cache.get(channelId);
    if (!logChannel?.isTextBased()) {
      logger.warn(`Ticket log channel ${config.ticketLogChannelId ?? "undefined"} not found or not text-based`);
      return;
    }
    let embed: EmbedBuilder;

    switch (eventType) {
      case "CREATE":
        embed = new EmbedBuilder()
          .setColor(0x2ecc71)
          .setTitle("🎫 Ticket Created")
          .addFields(
            { name: "👤 User", value: `<@${data.userId}>`, inline: true },
            {
              name: "🎫 Ticket",
              value: `#${data.ticketNumber?.toString().padStart(4, "0") ?? "Unknown"}`,
              inline: true,
            },
            { name: "📍 Channel", value: data.channelId ? `<#${data.channelId}>` : "Unknown", inline: true }
          );

        if (data.metadata?.title && typeof data.metadata.title === "string") {
          embed.addFields({ name: "📋 Title", value: data.metadata.title, inline: false });
        }
        if (data.metadata?.category && typeof data.metadata.category === "string") {
          embed.addFields({ name: "📝 Category", value: data.metadata.category, inline: true });
        }
        if (data.metadata?.useThreads !== undefined) {
          embed.addFields({ name: "🧵 Type", value: data.metadata.useThreads ? "Thread" : "Channel", inline: true });
        }
        break;

      case "CLOSE":
        embed = new EmbedBuilder()
          .setColor(0xe74c3c)
          .setTitle("🔒 Ticket Closed")
          .addFields(
            { name: "👤 Closed by", value: `<@${data.userId}>`, inline: true },
            {
              name: "🎫 Ticket",
              value: `#${data.ticketNumber?.toString().padStart(4, "0") ?? "Unknown"}`,
              inline: true,
            },
            { name: "👨‍💼 Role", value: data.metadata?.isStaff ? "Staff" : "User", inline: true }
          );

        if (data.details) {
          embed.addFields({ name: "📝 Reason", value: data.details, inline: false });
        }
        break;

      case "CLAIM":
        embed = new EmbedBuilder()
          .setColor(0x3498db)
          .setTitle("✋ Ticket Claimed")
          .addFields(
            { name: "👨‍💼 Claimed by", value: `<@${data.userId}>`, inline: true },
            {
              name: "🎫 Ticket",
              value: `#${data.ticketNumber?.toString().padStart(4, "0") ?? "Unknown"}`,
              inline: true,
            },
            { name: "🤫 Silent", value: data.metadata?.silent ? "Yes" : "No", inline: true }
          );
        break;

      case "ASSIGN":
        embed = new EmbedBuilder()
          .setColor(0xf39c12)
          .setTitle("👥 Ticket Assigned")
          .addFields(
            { name: "👤 Assigned by", value: `<@${data.userId}>`, inline: true },
            {
              name: "🎫 Ticket",
              value: `#${data.ticketNumber?.toString().padStart(4, "0") ?? "Unknown"}`,
              inline: true,
            },
            {
              name: "👨‍💼 Assigned to",
              value:
                data.metadata?.assignedTo && typeof data.metadata.assignedTo === "string"
                  ? `<@${data.metadata.assignedTo}>`
                  : "Unknown",
              inline: true,
            }
          );
        break;

      case "MESSAGE":
        // For high-traffic message logging, we might want to batch or filter these
        return; // Skip individual message logging to prevent spam

      case "UPDATE":
        embed = new EmbedBuilder()
          .setColor(0x9b59b6)
          .setTitle("📝 Ticket Updated")
          .addFields(
            { name: "👤 Updated by", value: `<@${data.userId}>`, inline: true },
            {
              name: "🎫 Ticket",
              value: `#${data.ticketNumber?.toString().padStart(4, "0") ?? "Unknown"}`,
              inline: true,
            }
          );

        if (data.details) {
          embed.addFields({ name: "📋 Changes", value: data.details, inline: false });
        }
        break;

      default:
        logger.warn(`Unknown ticket event type: ${eventType}`);
        return;
    }

    embed.setTimestamp();

    // Add ticket channel link if available
    if (data.channelId) {
      embed.addFields({ name: "🔗 Channel", value: `<#${data.channelId}>`, inline: true });
    }

    await logChannel.send({ embeds: [embed] });

    // Also save to database for persistent logging
    if (data.ticketId) {
      await prisma.ticketMessage
        .create({
          data: {
            ticketId: data.ticketId,
            messageId: "system",
            userId: data.userId,
            content: `System: ${eventType} - ${data.action}`,
            attachments: [],
            embeds: [embed.toJSON() as Prisma.InputJsonValue],
            isSystemMsg: true,
          },
        })
        .catch(() => {
          // Ignore database errors for system messages if ticket doesn't exist
        });
    }
  } catch (error) {
    logger.error("Failed to log ticket event:", error);
  }
}

export async function logTicketSystemMessage(ticketId: string, content: string, userId?: string): Promise<void> {
  try {
    await prisma.ticketMessage.create({
      data: {
        ticketId,
        messageId: "system",
        userId: userId ?? "system",
        content,
        attachments: [],
        embeds: [],
        isSystemMsg: true,
      },
    });
  } catch (error) {
    logger.error("Failed to log ticket system message:", error);
  }
}
