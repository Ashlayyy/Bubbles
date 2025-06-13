import type { MessageReaction, PartialMessageReaction, PartialUser, User } from "discord.js";
import { Events } from "discord.js";

import { getReactionRoleByEmojiAndMessage, logReactionRoleAction } from "../../database/ReactionRoles.js";
import { ClientEvent } from "../../structures/Event.js";

export default new ClientEvent(
  Events.MessageReactionAdd,
  async (reaction: MessageReaction | PartialMessageReaction, user: User | PartialUser) => {
    console.log(`[DEBUG] Processing reaction add event for user ${user.id}`);

    if (!reaction.message.guild || user.bot) {
      console.log(`[DEBUG] Skipping - No guild or bot user`);
      return;
    }

    const client = reaction.client as import("../../structures/Client.js").default;

    if (reaction.partial) {
      try {
        console.log(`[DEBUG] Fetching partial reaction`);
        reaction = await reaction.fetch();
      } catch (error) {
        console.error(`[DEBUG] Failed to fetch reaction:`, error);
        return;
      }
    }

    if (user.partial) {
      try {
        console.log(`[DEBUG] Fetching partial user`);
        user = await user.fetch();
      } catch (error) {
        console.error(`[DEBUG] Failed to fetch user:`, error);
        return;
      }
    }

    const emoji = reaction.emoji.id ? `${reaction.emoji.id}:${reaction.emoji.name}` : reaction.emoji.name;
    console.log(`[DEBUG] Processing emoji: ${emoji}`);

    if (!user.id || !reaction.message.id || !emoji) {
      console.log(`[DEBUG] Missing required data - user: ${user.id}, message: ${reaction.message.id}, emoji: ${emoji}`);
      return;
    }

    try {
      const reactionRole = await getReactionRoleByEmojiAndMessage(reaction.message.id, emoji);
      console.log(`[DEBUG] Found reaction role:`, reactionRole ? "yes" : "no");

      if (reactionRole && reaction.message.guild) {
        const guild = reaction.message.guild;
        const member = await guild.members.fetch(user.id).catch(() => null);
        console.log(`[DEBUG] Fetched member:`, member ? "yes" : "no");

        if (member) {
          const rolesToAdd = [];
          const failedRoles = [];

          for (const roleId of reactionRole.roleIds) {
            const role = guild.roles.cache.get(roleId);
            if (!role) {
              console.log(`[DEBUG] Role not found: ${roleId}`);
              failedRoles.push(roleId);
              continue;
            }

            const botMember = guild.members.me;
            if (!botMember) {
              console.log(`[DEBUG] Bot member not found`);
              failedRoles.push(roleId);
              continue;
            }

            if (role.position >= botMember.roles.highest.position) {
              console.log(`[DEBUG] Role hierarchy check failed for role: ${roleId}`);
              failedRoles.push(roleId);
              continue;
            }

            if (role.permissions.has("Administrator")) {
              console.log(`[DEBUG] Skipping admin role: ${roleId}`);
              failedRoles.push(roleId);
              continue;
            }

            if (!member.roles.cache.has(roleId)) {
              console.log(`[DEBUG] Adding role to queue: ${roleId}`);
              rolesToAdd.push(roleId);
            }
          }

          if (rolesToAdd.length > 0) {
            try {
              console.log(`[DEBUG] Assigning roles: ${rolesToAdd.join(", ")}`);
              await member.roles.add(rolesToAdd, `Reaction role assignment from message ${reaction.message.id}`);

              await logReactionRoleAction(client, {
                guildId: guild.id,
                userId: user.id,
                messageId: reaction.message.id,
                emoji,
                roleIds: rolesToAdd,
                action: "ADDED",
              });
              console.log(`[DEBUG] Successfully assigned and logged roles`);
            } catch (error) {
              console.error(`[DEBUG] Failed to assign roles:`, error);
            }
          }

          if (failedRoles.length > 0) {
            console.warn(`[DEBUG] Failed roles: ${failedRoles.join(", ")}`);
          }
        }
      }
    } catch (error) {
      console.error(`[DEBUG] Error in reaction role processing:`, error);
    }

    if (!reaction.message.guild) return;
    console.log(`[DEBUG] Logging reaction add event`);
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
    console.log(`[DEBUG] Reaction add event logged successfully`);
  }
);
