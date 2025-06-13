import type { Message, MessageReaction, PartialMessage } from "discord.js";
import { Events } from "discord.js";

import { ClientEvent } from "../../structures/Event.js";

export default new ClientEvent(
  Events.MessageReactionRemoveAll,
  async (message: Message | PartialMessage, reactions: ReadonlyMap<string, MessageReaction>) => {
    // Only process messages in guilds
    if (!message.guild) return;

    const client = message.client as import("../../structures/Client.js").default;

    // Prepare reaction data
    const reactionData = Array.from(reactions.values()).map((reaction) => ({
      emoji: reaction.emoji.id ? `${reaction.emoji.id}:${reaction.emoji.name}` : reaction.emoji.name,
      count: reaction.count,
      users: reaction.users.cache.map((user) => user.id),
    }));

    // Log the reaction removal
    await client.logManager.log(message.guild.id, "REACTION_REMOVE_ALL", {
      channelId: message.channel.id,
      metadata: {
        messageId: message.id,
        authorId: message.author?.id,
        messageContent: message.content ?? "[Content not cached]",
        reactionCount: reactions.size,
        totalReactionUsers: Array.from(reactions.values()).reduce((total, reaction) => total + reaction.count, 0),
        reactions: reactionData,
        channelName: "name" in message.channel ? message.channel.name : "Unknown",
        timestamp: new Date().toISOString(),
      },
    });
  }
);
