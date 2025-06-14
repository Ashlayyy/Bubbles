import type { MessageReaction, PartialMessageReaction, PartialUser, User } from "discord.js";
import { Events } from "discord.js";

import { getReactionRoleByEmojiAndMessage } from "../../database/ReactionRoles.js";
import { parseEmoji } from "../../functions/general/emojis.js";
import { ClientEvent } from "../../structures/Event.js";

export default new ClientEvent(
  Events.MessageReactionAdd,
  async (reaction: MessageReaction | PartialMessageReaction, user: User | PartialUser) => {
    // Skip if no guild or bot user
    if (!reaction.message.guild || user.bot) return;

    const client = reaction.client as import("../../structures/Client.js").default;

    try {
      // Fetch partial reaction if needed
      if (reaction.partial) {
        await reaction.fetch();
      }

      // Fetch partial user if needed
      if (user.partial) {
        await user.fetch();
      }

      // Get emoji identifier for database lookup
      const emoji = parseEmoji(reaction.emoji.toString(), client);

      if (!emoji || !user.id || !reaction.message.id) {
        return;
      }

      // Check if this is a reaction role
      const reactionRole = await getReactionRoleByEmojiAndMessage(reaction.message.id, emoji.identifier);

      if (!reactionRole) return;

      // Get the member
      const member = await reaction.message.guild.members.fetch(user.id).catch(() => null);

      if (!member) return;

      // Process each role
      const rolesToAdd: string[] = [];

      for (const roleId of reactionRole.roleIds) {
        const role = reaction.message.guild.roles.cache.get(roleId);

        if (!role) continue;

        // Check bot permissions
        const botMember = reaction.message.guild.members.me;
        if (!botMember) continue;

        // Check role hierarchy
        if (role.position >= botMember.roles.highest.position) continue;

        // Don't assign admin roles via reaction roles
        if (role.permissions.has("Administrator")) continue;

        rolesToAdd.push(roleId);
      }

      if (rolesToAdd.length > 0) {
        // Add roles to member
        await member.roles.add(rolesToAdd);

        // Log the role assignment
        await client.logManager.log(reaction.message.guild.id, "MEMBER_ROLE_ADD", {
          userId: user.id,
          executorId: client.user?.id,
          reason: "Reaction role assignment",
          metadata: {
            roleIds: rolesToAdd,
            messageId: reaction.message.id,
            channelId: reaction.message.channel.id,
            emoji: emoji.name,
            timestamp: new Date().toISOString(),
          },
        });
      }

      // Log the reaction add event
      await client.logManager.log(reaction.message.guild.id, "MESSAGE_REACTION_ADD", {
        userId: user.id,
        channelId: reaction.message.channel.id,
        metadata: {
          messageId: reaction.message.id,
          emoji: emoji.name,
          emojiId: reaction.emoji.id ?? null,
          emojiIdentifier: emoji.identifier,
          isReactionRole: Boolean(reactionRole),
          rolesAssigned: rolesToAdd,
          timestamp: new Date().toISOString(),
        },
      });
    } catch (error) {
      console.error("Error in messageReactionAdd event:", error);
    }
  }
);
