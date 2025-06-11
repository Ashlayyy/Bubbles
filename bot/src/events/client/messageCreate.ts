import type { Prisma } from "@prisma/client";
import type { Message } from "discord.js";
import { Events } from "discord.js";

import { ClientEvent } from "../../structures/Event.js";

export default new ClientEvent(Events.MessageCreate, async (message: Message) => {
  // Ignore bot messages to prevent spam
  if (message.author.bot) return;

  // Only process messages in guilds
  if (!message.guild) return;

  const client = message.client as import("../../structures/Client.js").default;

  // Log the message creation
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
    },
  });
});
