import type { MessageReaction, PartialMessageReaction, PartialUser, User } from "discord.js";

import { getReactionRoleByEmojiAndMessage, logReactionRoleAction } from "../../database/ReactionRoles.js";
import logger from "../../logger.js";
import { ClientEvent } from "../../structures/Event.js";

export default new ClientEvent(
  "messageReactionRemove",
  async (reaction: MessageReaction | PartialMessageReaction, user: User | PartialUser) => {
    // Ignore bot reactions
    if (user.bot) return;

    // Ensure we have a full reaction object
    if (reaction.partial) {
      try {
        reaction = await reaction.fetch();
      } catch (error) {
        logger.error("Failed to fetch partial reaction:", error);
        return;
      }
    }

    // Ensure we have a full user object
    if (user.partial) {
      try {
        user = await user.fetch();
      } catch (error) {
        logger.error("Failed to fetch partial user:", error);
        return;
      }
    }

    // Only process reactions in guilds
    if (!reaction.message.guild) return;

    const guildId = reaction.message.guild.id;
    const messageId = reaction.message.id;

    // Get emoji identifier (unicode or custom emoji)
    const emoji = reaction.emoji.id ? `${reaction.emoji.id}:${reaction.emoji.name}` : reaction.emoji.name;
    if (!emoji) return;

    try {
      // Check if this is a reaction role
      const reactionRole = await getReactionRoleByEmojiAndMessage(messageId, emoji);
      if (!reactionRole) return;

      // Get guild member
      const member = await reaction.message.guild.members.fetch(user.id).catch(() => null);
      if (!member) return;

      // Get roles to remove (only remove roles the user actually has)
      const rolesToRemove = reactionRole.roleIds.filter((roleId: string) => member.roles.cache.has(roleId));

      if (rolesToRemove.length === 0) return; // User doesn't have any of these roles

      try {
        // Remove roles from user
        await member.roles.remove(rolesToRemove);

        logger.info(`Removed ${rolesToRemove.length} role(s) from user ${user.tag} (${user.id}) in guild ${guildId}`);

        // Log the action if enabled
        await logReactionRoleAction(reaction.client, {
          guildId,
          userId: user.id,
          messageId,
          emoji,
          roleIds: rolesToRemove,
          action: "REMOVED",
        });
      } catch (error) {
        logger.error(`Failed to remove roles from user ${user.tag} (${user.id}):`, error);
      }
    } catch (error) {
      logger.error("Error in messageReactionRemove handler:", error);
    }
  }
);
