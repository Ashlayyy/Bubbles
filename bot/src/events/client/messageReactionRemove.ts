import type { MessageReaction, PartialMessageReaction, PartialUser, User } from "discord.js";
import { Events } from "discord.js";

import { getReactionRoleByEmojiAndMessage, logReactionRoleAction } from "../../database/ReactionRoles.js";
import { ClientEvent } from "../../structures/Event.js";

export default new ClientEvent(
  Events.MessageReactionRemove,
  async (reaction: MessageReaction | PartialMessageReaction, user: User | PartialUser) => {
    if (!reaction.message.guild || user.bot) return;

    const client = reaction.client as import("../../structures/Client.js").default;

    if (reaction.partial) {
      try {
        reaction = await reaction.fetch();
      } catch (error) {
        return;
      }
    }

    if (user.partial) {
      try {
        user = await user.fetch();
      } catch (error) {
        return;
      }
    }

    const emoji = reaction.emoji.id ? `${reaction.emoji.id}:${reaction.emoji.name}` : reaction.emoji.name;

    if (!user.id || !reaction.message.id || !emoji) return;

    try {
      const reactionRole = await getReactionRoleByEmojiAndMessage(reaction.message.id, emoji);
      if (reactionRole && reaction.message.guild) {
        const guild = reaction.message.guild;
        const member = await guild.members.fetch(user.id).catch(() => null);

        if (member) {
          const rolesToRemove: string[] = [];
          const failedRoles: string[] = [];

          for (const roleId of reactionRole.roleIds) {
            const role = guild.roles.cache.get(roleId);
            if (!role) {
              failedRoles.push(roleId);
              continue;
            }

            const botMember = guild.members.me;
            if (!botMember) {
              failedRoles.push(roleId);
              continue;
            }

            if (role.position >= botMember.roles.highest.position) {
              failedRoles.push(roleId);
              continue;
            }

            if (member.roles.cache.has(roleId)) {
              rolesToRemove.push(roleId);
            }
          }

          if (rolesToRemove.length > 0) {
            try {
              await member.roles.remove(rolesToRemove, `Reaction role removal from message ${reaction.message.id}`);

              await logReactionRoleAction(client, {
                guildId: guild.id,
                userId: user.id,
                messageId: reaction.message.id,
                emoji,
                roleIds: rolesToRemove,
                action: "REMOVED",
              });
            } catch (error) {
              console.error(`Failed to remove reaction roles from ${user.tag}:`, error);
            }
          }

          if (failedRoles.length > 0) {
            console.warn(`Failed to remove some reaction roles from ${user.tag}. Role IDs: ${failedRoles.join(", ")}`);
          }
        }
      }
    } catch (error) {
      console.error("Error processing reaction role removal:", error);
    }

    if (!reaction.message.guild) return;
    await client.logManager.log(reaction.message.guild.id, "REACTION_REMOVE", {
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
