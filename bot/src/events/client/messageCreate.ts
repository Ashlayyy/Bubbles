import type { Prisma } from "@prisma/client";
import type { Message } from "discord.js";
import { Events } from "discord.js";

import { prisma } from "../../database/index.js";
import { ClientEvent } from "../../structures/Event.js";

export default new ClientEvent(Events.MessageCreate, async (message: Message) => {
  // Ignore bot messages for general logging to prevent spam
  if (message.author.bot) return;

  // Only process messages in guilds
  if (!message.guild) return;

  const client = message.client as import("../../structures/Client.js").default;

  // Check if this message is in a ticket channel/thread
  const ticket = await prisma.ticket.findFirst({
    where: {
      guildId: message.guild.id,
      channelId: message.channel.id,
      status: { in: ["OPEN", "PENDING"] },
    },
  });

  if (ticket) {
    // This is a ticket message - save it to TicketMessage table
    try {
      await prisma.ticketMessage.create({
        data: {
          ticketId: ticket.id,
          messageId: message.id,
          userId: message.author.id,
          content: message.content || "",
          attachments: message.attachments.map((att) => att.url),
          embeds: message.embeds.map((embed) => embed.toJSON()) as Prisma.InputJsonValue[],
          isSystemMsg: false,
        },
      });

      // Update ticket last activity
      await prisma.ticket.update({
        where: { id: ticket.id },
        data: { lastActivity: new Date() },
      });
    } catch (error) {
      console.error("Failed to log ticket message:", error);
    }
  }

  // Process auto-moderation rules
  const { AutoModService } = await import("../../services/autoModService.js");
  await AutoModService.processMessage(client, message);

  // Log the message creation to general logging system
  await client.logManager.log(message.guild.id, "MESSAGE_CREATE", {
    userId: message.author.id,
    channelId: message.channel.id,
    content: message.content,
    attachments: message.attachments.map((att) => att.url),
    embeds: message.embeds.map((embed) => embed.toJSON()) as Prisma.InputJsonValue[],
    metadata: {
      messageId: message.id,
      timestamp: message.createdAt.toISOString(),
      hasAttachments: message.attachments.size > 0,
      hasEmbeds: message.embeds.length > 0,
      isTicketMessage: Boolean(ticket),
    },
  });
});
