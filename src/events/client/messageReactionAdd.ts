import type { MessageReaction, PartialMessageReaction, PartialUser, User } from "discord.js";

import { getReactionRoleByEmojiAndMessage, logReactionRoleAction } from "../../database/ReactionRoles.js";
import logger from "../../logger.js";
import { ClientEvent } from "../../structures/Event.js";

export default new ClientEvent(
  "messageReactionAdd",
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

      // Get roles to add
      const rolesToAdd = reactionRole.roleIds.filter((roleId: string) => !member.roles.cache.has(roleId));

      if (rolesToAdd.length === 0) return; // User already has all roles

      try {
        // Add roles to user
        await member.roles.add(rolesToAdd);

        logger.info(`Added ${rolesToAdd.length} role(s) to user ${user.tag} (${user.id}) in guild ${guildId}`);

        // Log the action if enabled
        await logReactionRoleAction(reaction.client, {
          guildId,
          userId: user.id,
          messageId,
          emoji,
          roleIds: rolesToAdd,
          action: "ADDED",
        });
      } catch (error) {
        logger.error(`Failed to add roles to user ${user.tag} (${user.id}):`, error);

        // Try to remove the reaction if we can't assign the role
        try {
          await reaction.users.remove(user.id);
        } catch (removeError) {
          logger.error("Failed to remove reaction after role assignment failure:", removeError);
        }
      }
    } catch (error) {
      logger.error("Error in messageReactionAdd handler:", error);
    }
  }
);
