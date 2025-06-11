import type { MessageReaction, PartialMessageReaction, PartialUser, User } from "discord.js";
import { Events } from "discord.js";

import { ClientEvent } from "../../structures/Event.js";

export default new ClientEvent(
  Events.MessageReactionAdd,
  async (reaction: MessageReaction | PartialMessageReaction, user: User | PartialUser) => {
    // Only process reactions in guilds and ignore bot reactions
    if (!reaction.message.guild || user.bot) return;

    const client = reaction.client as import("../../structures/Client.js").default;

    // Ensure we have full objects
    if (reaction.partial) {
      try {
        reaction = await reaction.fetch();
      } catch (error) {
        return; // Failed to fetch, skip this event
      }
    }

    if (user.partial) {
      try {
        user = await user.fetch();
      } catch (error) {
        return; // Failed to fetch, skip this event
      }
    }

    // Get emoji identifier
    const emoji = reaction.emoji.id ? `${reaction.emoji.id}:${reaction.emoji.name}` : reaction.emoji.name;

    // Log the reaction add (we already checked guild exists above)
    if (!reaction.message.guild) return;
    await client.logManager.log(reaction.message.guild.id, "REACTION_ADD", {
      userId: user.id,
      metadata: {
        messageId: reaction.message.id,
        channelId: reaction.message.channel.id,
        emoji,
        emojiName: reaction.emoji.name,
        emojiId: reaction.emoji.id,
        animated: reaction.emoji.animated,
        messageContent: reaction.message.content ?? "[Content not cached]",
        channelName: "name" in reaction.message.channel ? reaction.message.channel.name : "Unknown",
        timestamp: new Date().toISOString(),
      },
    });
  }
);
