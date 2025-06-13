import type { MessageReaction, PartialMessageReaction } from "discord.js";
import { Events } from "discord.js";

import { ClientEvent } from "../../structures/Event.js";

export default new ClientEvent(
  Events.MessageReactionRemoveEmoji,
  async (reaction: MessageReaction | PartialMessageReaction) => {
    // Only process reactions in guilds
    if (!reaction.message.guild) return;

    const client = reaction.client as import("../../structures/Client.js").default;

    // Ensure we have a full reaction object
    if (reaction.partial) {
      try {
        reaction = await reaction.fetch();
      } catch (error) {
        return; // Failed to fetch, skip this event
      }
    }

    // Get emoji identifier
    const emoji = reaction.emoji.id ? `${reaction.emoji.id}:${reaction.emoji.name}` : reaction.emoji.name;

    // Log the emoji reaction removal (guild already checked above)
    if (!reaction.message.guild) return;
    await client.logManager.log(reaction.message.guild.id, "REACTION_EMOJI_REMOVE", {
      metadata: {
        messageId: reaction.message.id,
        channelId: reaction.message.channel.id,
        emoji,
        emojiName: reaction.emoji.name,
        emojiId: reaction.emoji.id,
        animated: reaction.emoji.animated,
        previousCount: reaction.count,
        messageContent: reaction.message.content ?? "[Content not cached]",
        channelName: "name" in reaction.message.channel ? reaction.message.channel.name : "Unknown",
        timestamp: new Date().toISOString(),
      },
    });
  }
);
