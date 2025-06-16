import { ActivityType, EmbedBuilder, PresenceStatus, SlashCommandBuilder } from "discord.js";

import logger from "../../logger.js";
import Command from "../../structures/Command.js";
import { PermissionLevel } from "../../structures/PermissionTypes.js";

export default new Command(
  new SlashCommandBuilder()
    .setName("userinfo")
    .setDescription("Display information about a user")
    .addUserOption((opt) => opt.setName("user").setDescription("User to get information about (defaults to yourself)")),

  async (client, interaction) => {
    if (!interaction.isChatInputCommand()) return;
    if (!interaction.guild) return;

    const targetUser = interaction.options.getUser("user") ?? interaction.user;

    try {
      const member = await interaction.guild.members.fetch(targetUser.id).catch(() => null);

      const embed = new EmbedBuilder()
        .setTitle(`👤 ${targetUser.displayName}`)
        .setColor(member?.displayHexColor ?? 0x99aab5)
        .setThumbnail(targetUser.displayAvatarURL({ size: 256 }))
        .setTimestamp()
        .setFooter({
          text: `User ID: ${targetUser.id}`,
          iconURL: interaction.user.displayAvatarURL(),
        });

      // Basic user info
      embed.addFields(
        {
          name: "📋 Basic Info",
          value: [
            `**Username:** ${targetUser.username}`,
            `**Display Name:** ${targetUser.displayName}`,
            `**Mention:** ${targetUser.toString()}`,
            `**Bot:** ${targetUser.bot ? "Yes" : "No"}`,
          ].join("\n"),
          inline: true,
        },
        {
          name: "📅 Account Created",
          value: `<t:${Math.floor(targetUser.createdTimestamp / 1000)}:F>\n(<t:${Math.floor(targetUser.createdTimestamp / 1000)}:R>)`,
          inline: true,
        }
      );

      // Server-specific info if member
      if (member) {
        embed.addFields({
          name: "🏠 Server Info",
          value: [
            `**Joined:** <t:${Math.floor((member.joinedTimestamp ?? 0) / 1000)}:R>`,
            `**Nickname:** ${member.nickname ?? "None"}`,
            `**Highest Role:** ${member.roles.highest.toString()}`,
            `**Role Count:** ${member.roles.cache.size - 1}`, // -1 for @everyone
          ].join("\n"),
          inline: false,
        });

        // Add status and activity if available
        if (member.presence) {
          const statusEmojis: Record<PresenceStatus, string> = {
            online: "🟢",
            idle: "🟡",
            dnd: "🔴",
            offline: "⚪",
            invisible: "⚪",
          };

          const statusEmoji = statusEmojis[member.presence.status] ?? "⚪";
          const statusText =
            statusEmoji + " " + member.presence.status.charAt(0).toUpperCase() + member.presence.status.slice(1);

          let activityText = "None";
          if (member.presence.activities.length > 0) {
            const activity = member.presence.activities[0];
            switch (activity.type) {
              case ActivityType.Playing:
                activityText = `🎮 Playing ${activity.name}`;
                break;
              case ActivityType.Streaming:
                activityText = `📺 Streaming ${activity.name}`;
                break;
              case ActivityType.Listening:
                activityText = `🎵 Listening to ${activity.name}`;
                break;
              case ActivityType.Watching:
                activityText = `📺 Watching ${activity.name}`;
                break;
              case ActivityType.Competing:
                activityText = `🏆 Competing in ${activity.name}`;
                break;
              default:
                activityText = activity.name ?? "Unknown activity";
            }
          }

          embed.addFields({
            name: "🎭 Status & Activity",
            value: [`**Status:** ${statusText}`, `**Activity:** ${activityText}`].join("\n"),
            inline: false,
          });
        }

        // Show some roles (limit to prevent embed overflow)
        if (member.roles.cache.size > 1) {
          const roles = member.roles.cache
            .filter((role) => role.id !== interaction.guild!.id) // Remove @everyone
            .sort((a, b) => b.position - a.position)
            .first(10)
            ?.map((role) => role.toString())
            .join(", ");

          if (roles) {
            embed.addFields({
              name: `🎭 Roles (${member.roles.cache.size - 1})`,
              value: roles + (member.roles.cache.size > 11 ? "..." : ""),
              inline: false,
            });
          }
        }
      } else {
        embed.addFields({
          name: "ℹ️ Server Status",
          value: "Not a member of this server",
          inline: false,
        });
      }

      await interaction.reply({ embeds: [embed] });

      // Log command usage
      await client.logManager.log(interaction.guild.id, "COMMAND_USERINFO", {
        userId: interaction.user.id,
        channelId: interaction.channel?.id,
        metadata: {
          targetUserId: targetUser.id,
          targetUsername: targetUser.username,
          isMember: !!member,
        },
      });
    } catch (error) {
      logger.error("Error in userinfo command:", error);
      await interaction.reply({
        embeds: [
          new EmbedBuilder()
            .setColor(0xe74c3c)
            .setTitle("❌ Error")
            .setDescription("Failed to fetch user information. Please try again.")
            .setTimestamp(),
        ],
        ephemeral: true,
      });
    }
  },
  {
    permissions: {
      level: PermissionLevel.PUBLIC,
      isConfigurable: true,
    },
  }
);
