import { ActivityType, EmbedBuilder, PresenceStatus, SlashCommandBuilder } from "discord.js";

import logger from "../../logger.js";
import type { CommandConfig, CommandResponse } from "../_core/index.js";
import { GeneralCommand } from "../_core/specialized/GeneralCommand.js";

class UserInfoCommand extends GeneralCommand {
  constructor() {
    const config: CommandConfig = {
      name: "userinfo",
      description: "Display information about a user",
      category: "general",
      guildOnly: true,
      ephemeral: false,
    };

    super(config);
  }

  protected async execute(): Promise<CommandResponse> {
    const targetUser = this.getUserOption("user") ?? this.user;

    try {
      const member = await this.guild.members.fetch(targetUser.id).catch(() => null);

      const embed = new EmbedBuilder()
        .setTitle(`👤 ${targetUser.username}`)
        .setColor(member?.displayHexColor ?? 0x99aab5)
        .setThumbnail(targetUser.displayAvatarURL({ size: 256 }))
        .setTimestamp()
        .setFooter({ text: `User ID: ${targetUser.id}`, iconURL: this.user.displayAvatarURL() });

      embed.addFields(
        {
          name: "📋 Basic Info",
          value: [
            `**Username:** ${targetUser.username}`,
            `**Mention:** ${targetUser.toString()}`,
            `**Bot:** ${targetUser.bot ? "Yes" : "No"}`,
          ].join("\n"),
          inline: true,
        },
        {
          name: "📅 Account Created",
          value: `<t:${String(Math.floor(targetUser.createdTimestamp / 1000))}:F>\n(<t:${String(Math.floor(targetUser.createdTimestamp / 1000))}:R>)`,
          inline: true,
        }
      );

      if (member) {
        embed.addFields({
          name: "🏠 Server Info",
          value: [
            `**Joined:** <t:${String(Math.floor((member.joinedTimestamp ?? 0) / 1000))}:R>`,
            `**Nickname:** ${member.nickname ?? "None"}`,
            `**Highest Role:** ${member.roles.highest.toString()}`,
            `**Role Count:** ${String(member.roles.cache.size - 1)}`,
          ].join("\n"),
          inline: false,
        });

        if (member.presence) {
          const statusEmojis: Record<PresenceStatus, string> = {
            online: "🟢",
            idle: "🟡",
            dnd: "🔴",
            offline: "⚪",
            invisible: "⚪",
          };

          const statusText =
            statusEmojis[member.presence.status] +
            " " +
            member.presence.status.charAt(0).toUpperCase() +
            member.presence.status.slice(1);

          let activityText = "None";
          if (member.presence.activities.length) {
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
                activityText = activity.name;
            }
          }

          embed.addFields({
            name: "🎭 Status & Activity",
            value: [`**Status:** ${statusText}`, `**Activity:** ${activityText}`].join("\n"),
            inline: false,
          });
        }

        if (member.roles.cache.size > 1) {
          const roles = member.roles.cache
            .filter((r) => r.id !== this.guild.id)
            .sort((a, b) => b.position - a.position)
            .first(10)
            .map((r) => r.toString())
            .join(", ");

          if (roles)
            embed.addFields({
              name: `🎭 Roles (${String(member.roles.cache.size - 1)})`,
              value: roles + (member.roles.cache.size > 11 ? "..." : ""),
              inline: false,
            });
        }
      } else {
        embed.addFields({ name: "ℹ️ Server Status", value: "Not a member of this server", inline: false });
      }

      await this.logCommandUsage("userinfo", { target: targetUser.id });

      return { embeds: [embed], ephemeral: false };
    } catch (error) {
      logger.error("Error in userinfo command:", error);
      return this.createGeneralError("Error", "Failed to fetch user information. Please try again.");
    }
  }
}

export default new UserInfoCommand();

export const builder = new SlashCommandBuilder()
  .setName("userinfo")
  .setDescription("Display information about a user")
  .setDefaultMemberPermissions(0)
  .addUserOption((opt) => opt.setName("user").setDescription("User to get information about (defaults to yourself)"));
