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
      ephemeral: true,
    };

    super(config);
  }

  protected async execute(): Promise<CommandResponse> {
    const targetUser = this.getUserOption("user") ?? this.user;

    try {
      const member = await this.guild.members.fetch(targetUser.id).catch(() => null);

      const embed = new EmbedBuilder()
        .setTitle(`👤 User Information: ${targetUser.username}`)
        .setColor(member?.displayHexColor ?? 0x7289da)
        .setThumbnail(targetUser.displayAvatarURL({ size: 256 }))
        .setTimestamp()
        .setFooter({
          text: `Requested by ${this.user.username} • User ID: ${targetUser.id}`,
          iconURL: this.user.displayAvatarURL(),
        });

      // Basic Information Section
      embed.addFields({
        name: "📋 Basic Information",
        value: [
          `**Username:** ${targetUser.username}`,
          `**Display Name:** ${targetUser.displayName}`,
          `**Mention:** ${targetUser.toString()}`,
          `**Account Type:** ${targetUser.bot ? "🤖 Bot" : "👤 User"}`,
          `**Created:** <t:${String(Math.floor(targetUser.createdTimestamp / 1000))}:R>`,
        ].join("\n"),
        inline: false,
      });

      if (member) {
        // Server Member Information
        const joinedTimestamp = member.joinedTimestamp ?? 0;
        const roles = member.roles.cache.filter((r) => r.id !== this.guild.id).sort((a, b) => b.position - a.position);

        const serverInfo = [
          `**Joined Server:** <t:${String(Math.floor(joinedTimestamp / 1000))}:R>`,
          `**Server Nickname:** ${member.nickname ?? "None"}`,
          `**Highest Role:** ${member.roles.highest.toString()}`,
          `**Total Roles:** ${String(roles.size)}`,
        ];

        // Add booster info if applicable
        if (member.premiumSince) {
          serverInfo.push(
            `**Server Booster:** 💎 Since <t:${String(Math.floor(member.premiumSince.getTime() / 1000))}:R>`
          );
        }

        embed.addFields({
          name: "🏠 Server Membership",
          value: serverInfo.join("\n"),
          inline: false,
        });

        // Presence and Activity Information
        if (member.presence) {
          const statusEmojis: Record<PresenceStatus, string> = {
            online: "🟢 Online",
            idle: "🟡 Idle",
            dnd: "🔴 Do Not Disturb",
            offline: "⚫ Offline",
            invisible: "⚫ Invisible",
          };

          const statusText = statusEmojis[member.presence.status] || "❓ Unknown";

          let activityText = "None";
          if (member.presence.activities.length) {
            const activity = member.presence.activities[0];
            const activityEmojis = {
              [ActivityType.Playing]: "🎮",
              [ActivityType.Streaming]: "📺",
              [ActivityType.Listening]: "🎵",
              [ActivityType.Watching]: "👀",
              [ActivityType.Competing]: "🏆",
              [ActivityType.Custom]: "💭",
            };

            const emoji = activityEmojis[activity.type] || "🔄";
            activityText = `${emoji} ${activity.name}`;

            if (activity.details) {
              activityText += `\n*${activity.details}*`;
            }
            if (activity.state) {
              activityText += `\n*${activity.state}*`;
            }
          }

          embed.addFields({
            name: "🎭 Status & Activity",
            value: [`**Status:** ${statusText}`, `**Activity:** ${activityText}`].join("\n"),
            inline: false,
          });
        }

        // Roles Section (if user has roles)
        if (roles.size > 0) {
          const roleList = roles
            .first(15) // Show max 15 roles
            .map((r) => r.toString())
            .join(", ");

          const roleValue = roles.size > 15 ? `${roleList}\n*...and ${roles.size - 15} more*` : roleList;

          embed.addFields({
            name: `🎭 Roles (${String(roles.size)})`,
            value: roleValue,
            inline: false,
          });
        }

        // Permissions Section (for admins/moderators)
        if (member.permissions.has("Administrator")) {
          embed.addFields({
            name: "🔒 Key Permissions",
            value: "👑 **Administrator** (All Permissions)",
            inline: false,
          });
        } else {
          const keyPerms: string[] = [];
          if (member.permissions.has("ManageGuild")) keyPerms.push("🏢 Manage Server");
          if (member.permissions.has("ManageChannels")) keyPerms.push("📋 Manage Channels");
          if (member.permissions.has("ManageRoles")) keyPerms.push("🎭 Manage Roles");
          if (member.permissions.has("ManageMessages")) keyPerms.push("💬 Manage Messages");
          if (member.permissions.has("KickMembers")) keyPerms.push("👢 Kick Members");
          if (member.permissions.has("BanMembers")) keyPerms.push("🔨 Ban Members");
          if (member.permissions.has("ModerateMembers")) keyPerms.push("⏰ Timeout Members");

          if (keyPerms.length > 0) {
            embed.addFields({
              name: "🔒 Key Permissions",
              value: keyPerms.join(", "),
              inline: false,
            });
          }
        }
      } else {
        // User is not in the server
        embed.addFields({
          name: "ℹ️ Server Status",
          value: "❌ **Not a member** of this server",
          inline: false,
        });
      }

      // Enhanced avatar link
      embed.addFields({
        name: "🖼️ Avatar Links",
        value: [
          `[Download Avatar](${targetUser.displayAvatarURL({ size: 4096 })})`,
          `[PNG](${targetUser.displayAvatarURL({ extension: "png", size: 1024 })}) • ` +
            `[JPG](${targetUser.displayAvatarURL({ extension: "jpg", size: 1024 })}) • ` +
            `[WebP](${targetUser.displayAvatarURL({ extension: "webp", size: 1024 })})`,
        ].join("\n"),
        inline: false,
      });

      await this.logCommandUsage("userinfo", { target: targetUser.id });

      return { embeds: [embed], ephemeral: true };
    } catch (error) {
      logger.error("Error in userinfo command:", error);
      return this.createGeneralError(
        "Information Unavailable",
        `❌ Unable to retrieve information for **${targetUser.username}**.\n\n` +
          `This might happen if:\n` +
          `• The user has restricted their profile\n` +
          `• There was a temporary Discord API issue\n` +
          `• The user account no longer exists\n\n` +
          `💡 **Tip:** Try again in a few moments.`
      );
    }
  }
}

export default new UserInfoCommand();

export const builder = new SlashCommandBuilder()
  .setName("userinfo")
  .setDescription("Display information about a user")
  .setDefaultMemberPermissions(0)
  .addUserOption((opt) => opt.setName("user").setDescription("User to get information about (defaults to yourself)"));
