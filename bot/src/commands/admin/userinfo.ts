import { EmbedBuilder, SlashCommandBuilder } from "discord.js";

import logger from "../../logger.js";
import Command from "../../structures/Command.js";
import { PermissionLevel } from "../../structures/PermissionTypes.js";

export default new Command(
  new SlashCommandBuilder()
    .setName("userinfo")
    .setDescription("Display detailed information about a user")
    .addUserOption((opt) => opt.setName("user").setDescription("User to get information about (defaults to yourself)"))
    .addBooleanOption((opt) => opt.setName("detailed").setDescription("Show additional technical details")),

  async (client, interaction) => {
    // Type guard to ensure this is a chat input command
    if (!interaction.isChatInputCommand()) return;
    if (!interaction.guild) return;

    const targetUser = interaction.options.getUser("user") ?? interaction.user;
    const detailed = interaction.options.getBoolean("detailed") ?? false;

    try {
      // Get member object if user is in guild
      const member = await interaction.guild.members.fetch(targetUser.id).catch(() => null);

      const embed = new EmbedBuilder()
        .setTitle(`👤 ${targetUser.displayName} User Information`)
        .setColor(member?.displayHexColor ?? 0x3498db)
        .setThumbnail(targetUser.displayAvatarURL({ size: 256 }))
        .setTimestamp();

      // Basic user info
      embed.addFields(
        {
          name: "📝 Username",
          value: `${targetUser.username}${targetUser.discriminator !== "0" ? `#${targetUser.discriminator}` : ""}`,
          inline: true,
        },
        {
          name: "🆔 User ID",
          value: targetUser.id,
          inline: true,
        },
        {
          name: "🤖 Bot Account",
          value: targetUser.bot ? "Yes" : "No",
          inline: true,
        }
      );

      embed.addFields({
        name: "📅 Account Created",
        value: `<t:${Math.floor(targetUser.createdTimestamp / 1000)}:F>\n<t:${Math.floor(targetUser.createdTimestamp / 1000)}:R>`,
        inline: true,
      });

      // Member-specific info if user is in guild
      if (member) {
        embed.addFields(
          {
            name: "📅 Joined Server",
            value: member.joinedTimestamp
              ? `<t:${Math.floor(member.joinedTimestamp / 1000)}:F>\n<t:${Math.floor(member.joinedTimestamp / 1000)}:R>`
              : "Unknown",
            inline: true,
          },
          {
            name: "📱 Display Name",
            value: member.displayName !== targetUser.username ? member.displayName : "Same as username",
            inline: true,
          }
        );

        // Roles information
        const guildId = interaction.guild.id;
        const roles = member.roles.cache
          .filter((role) => role.id !== guildId) // Exclude @everyone
          .sort((a, b) => b.position - a.position)
          .map((role) => `<@&${role.id}>`)
          .slice(0, 20); // Limit to prevent embed overflow

        if (roles.length > 0) {
          embed.addFields({
            name: `🎭 Roles (${member.roles.cache.size - 1})`,
            value: roles.join(" ") + (member.roles.cache.size > 21 ? "\n*...and more*" : ""),
            inline: false,
          });
        } else {
          embed.addFields({
            name: "🎭 Roles",
            value: "No roles assigned",
            inline: false,
          });
        }

        // Key dates and status
        const statusEmoji: Record<string, string> = {
          online: "🟢",
          idle: "🟡",
          dnd: "🔴",
          offline: "⚫",
          invisible: "⚫",
        };

        const status = member.presence?.status ?? "offline";
        const highestRoleValue = member.roles.highest.id !== guildId ? `<@&${member.roles.highest.id}>` : "@everyone";
        const roleColor = member.displayHexColor;

        embed.addFields(
          {
            name: "📊 Status",
            value: `${statusEmoji[status]} ${status.charAt(0).toUpperCase() + status.slice(1)}`,
            inline: true,
          },
          {
            name: "🏆 Highest Role",
            value: highestRoleValue,
            inline: true,
          },
          {
            name: "🎨 Role Color",
            value: roleColor,
            inline: true,
          }
        );

        // Voice state
        if (member.voice.channel) {
          embed.addFields({
            name: "🔊 Voice Channel",
            value: `<#${member.voice.channel.id}>${member.voice.mute ? " (Muted)" : ""}${member.voice.deaf ? " (Deafened)" : ""}`,
            inline: true,
          });
        }

        // Activity (if any)
        if (member.presence?.activities && member.presence.activities.length > 0) {
          const activity = member.presence.activities[0];
          const activityTypes: Record<number, string> = {
            0: "🎮 Playing",
            1: "📺 Streaming",
            2: "🎵 Listening to",
            3: "📺 Watching",
            4: "🔧 Custom Status",
            5: "🏆 Competing in",
          };

          embed.addFields({
            name: "🎯 Activity",
            value: `${activityTypes[activity.type] || "🔹"} ${activity.name}${activity.details ? `\n${activity.details}` : ""}`,
            inline: true,
          });
        }

        if (detailed) {
          // Detailed member information
          const permissions = member.permissions.toArray();
          const keyPerms = permissions.filter((perm) =>
            [
              "Administrator",
              "ManageGuild",
              "ManageRoles",
              "ManageChannels",
              "ManageMessages",
              "BanMembers",
              "KickMembers",
            ].includes(perm)
          );

          if (keyPerms.length > 0) {
            embed.addFields({
              name: "🔐 Key Permissions",
              value: keyPerms.map((p) => `\`${p}\``).join(", "),
              inline: false,
            });
          }

          // Booster info
          if (member.premiumSince) {
            embed.addFields({
              name: "💎 Server Booster",
              value: `Since <t:${Math.floor(member.premiumSince.getTime() / 1000)}:F>`,
              inline: true,
            });
          }

          // Timeout info
          const timeoutUntil = member.communicationDisabledUntil;
          if (member.isCommunicationDisabled()) {
            embed.addFields({
              name: "🔇 Timeout",
              value: timeoutUntil ? `Until <t:${Math.floor(timeoutUntil.getTime() / 1000)}:F>` : "Yes",
              inline: true,
            });
          }
        }
      } else {
        embed.addFields({
          name: "❌ Server Member",
          value: "User is not in this server",
          inline: false,
        });
      }

      // User flags (badges)
      const flags = targetUser.flags?.toArray() ?? [];
      if (flags.length > 0) {
        const flagEmojis: Record<string, string> = {
          Staff: "👨‍💼",
          Partner: "🤝",
          Hypesquad: "⚡",
          BugHunterLevel1: "🐛",
          BugHunterLevel2: "🐛",
          HypesquadOnlineHouse1: "🏠",
          HypesquadOnlineHouse2: "🏠",
          HypesquadOnlineHouse3: "🏠",
          PremiumEarlySupporter: "⭐",
          VerifiedDeveloper: "👨‍💻",
          CertifiedModerator: "🛡️",
          VerifiedBot: "✅",
          ActiveDeveloper: "🔧",
        };

        embed.addFields({
          name: "🏅 Badges",
          value: flags
            .map((flag: string) => `${flagEmojis[flag] ?? "🎖️"} ${flag.replace(/([A-Z])/g, " $1").trim()}`)
            .join("\n"),
          inline: false,
        });
      }

      // Set footer
      embed.setFooter({
        text: `Requested by ${interaction.user.username}`,
        iconURL: interaction.user.displayAvatarURL(),
      });

      await interaction.reply({ embeds: [embed] });

      // Log command usage
      await client.logManager.log(interaction.guild.id, "COMMAND_USERINFO", {
        userId: interaction.user.id,
        channelId: interaction.channel?.id,
        metadata: {
          targetUserId: targetUser.id,
          targetUsername: targetUser.username,
          detailed,
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
