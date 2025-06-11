import type { Message, PartialMessage } from "discord.js";
import { Events } from "discord.js";

import { ClientEvent } from "../../structures/Event.js";

export default new ClientEvent(
  Events.MessageUpdate,
  async (oldMessage: Message | PartialMessage, newMessage: Message | PartialMessage) => {
    // Only process messages in guilds
    if (!newMessage.guild) return;

    // Ignore bot messages to prevent spam
    if (newMessage.author?.bot) return;

    const client = newMessage.client as import("../../structures/Client.js").default;

    // Log the message edit
    await client.logManager.log(newMessage.guild.id, "MESSAGE_EDIT", {
      userId: newMessage.author?.id,
      channelId: newMessage.channel.id,
      before: {
        content: oldMessage.content,
        editedTimestamp: oldMessage.editedTimestamp,
      },
      after: {
        content: newMessage.content,
        editedTimestamp: newMessage.editedTimestamp,
      },
      metadata: {
        messageId: newMessage.id,
        timestamp: newMessage.editedTimestamp
          ? new Date(newMessage.editedTimestamp).toISOString()
          : new Date().toISOString(),
        wasContentChanged: oldMessage.content !== newMessage.content,
      },
    });
  }
);
