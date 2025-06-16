import {
  ChannelType,
  EmbedBuilder,
  GuildDefaultMessageNotifications,
  GuildExplicitContentFilter,
  GuildMFALevel,
  SlashCommandBuilder,
} from "discord.js";

import logger from "../../logger.js";
import Command from "../../structures/Command.js";
import { PermissionLevel } from "../../structures/PermissionTypes.js";

export default new Command(
  new SlashCommandBuilder()
    .setName("serverinfo")
    .setDescription("Display detailed information about the current server"),

  async (client, interaction) => {
    // Type guard to ensure this is a chat input command
    if (!interaction.isChatInputCommand()) return;
    if (!interaction.guild) return;

    try {
      const guild = interaction.guild;

      // Fetch guild to get complete information
      await guild.fetch();

      // Count members by status
      const members = await guild.members.fetch();
      const online = members.filter((member) => member.presence?.status === "online").size;
      const idle = members.filter((member) => member.presence?.status === "idle").size;
      const dnd = members.filter((member) => member.presence?.status === "dnd").size;
      const offline = members.size - online - idle - dnd;

      // Count channels by type
      const textChannels = guild.channels.cache.filter((channel) => channel.type === ChannelType.GuildText).size;
      const voiceChannels = guild.channels.cache.filter((channel) => channel.type === ChannelType.GuildVoice).size;
      const categories = guild.channels.cache.filter((channel) => channel.type === ChannelType.GuildCategory).size;
      const threadChannels = guild.channels.cache.filter((channel) => channel.isThread()).size;

      // Get verification level
      const verificationLevels = {
        0: "None",
        1: "Low",
        2: "Medium",
        3: "High",
        4: "Very High",
      };

      // Get boost level info
      const boostTier = guild.premiumTier;
      const boostCount = guild.premiumSubscriptionCount ?? 0;

      // Features
      const features = guild.features
        .map((feature) => {
          const formatted = feature.toLowerCase().replace(/_/g, " ");
          return formatted.charAt(0).toUpperCase() + formatted.slice(1);
        })
        .slice(0, 10); // Limit to 10 features

      const embed = new EmbedBuilder()
        .setTitle(`📊 ${guild.name}`)
        .setColor(0x5865f2)
        .setThumbnail(guild.iconURL({ size: 256 }))
        .setTimestamp()
        .setFooter({
          text: `Server ID: ${guild.id}`,
          iconURL: interaction.user.displayAvatarURL(),
        });

      // Add banner if available
      const bannerUrl = guild.bannerURL({ size: 1024 });
      if (bannerUrl) {
        embed.setImage(bannerUrl);
      }

      // Basic server info
      embed.addFields(
        {
          name: "👑 Owner",
          value: `<@${guild.ownerId}>`,
          inline: true,
        },
        {
          name: "📅 Created",
          value: `<t:${Math.floor(guild.createdTimestamp / 1000)}:F>\n(<t:${Math.floor(guild.createdTimestamp / 1000)}:R>)`,
          inline: true,
        },
        {
          name: "🌍 Region",
          value: guild.preferredLocale,
          inline: true,
        }
      );

      // Member statistics
      const humanMembers = members.filter((member) => !member.user.bot).size;
      const botMembers = members.filter((member) => member.user.bot).size;

      embed.addFields({
        name: "👥 Members",
        value: [
          `**Total:** ${guild.memberCount.toLocaleString()}`,
          `**Humans:** ${humanMembers.toLocaleString()}`,
          `**Bots:** ${botMembers.toLocaleString()}`,
          ``,
          `🟢 Online: ${online}`,
          `🟡 Idle: ${idle}`,
          `🔴 DND: ${dnd}`,
          `⚪ Offline: ${offline}`,
        ].join("\n"),
        inline: true,
      });

      // Channel statistics
      embed.addFields({
        name: "📝 Channels",
        value: [
          `**Total:** ${guild.channels.cache.size}`,
          `**Text:** ${textChannels}`,
          `**Voice:** ${voiceChannels}`,
          `**Categories:** ${categories}`,
          `**Threads:** ${threadChannels}`,
        ].join("\n"),
        inline: true,
      });

      // Server settings
      const explicitFilter =
        guild.explicitContentFilter === GuildExplicitContentFilter.Disabled
          ? "Disabled"
          : guild.explicitContentFilter === GuildExplicitContentFilter.MembersWithoutRoles
            ? "Members without roles"
            : "All members";
      const notifications =
        guild.defaultMessageNotifications === GuildDefaultMessageNotifications.AllMessages
          ? "All messages"
          : "Only mentions";

      embed.addFields({
        name: "⚙️ Settings",
        value: [
          `**Verification:** ${verificationLevels[guild.verificationLevel as keyof typeof verificationLevels]}`,
          `**Explicit Filter:** ${explicitFilter}`,
          `**Default Notifications:** ${notifications}`,
          `**2FA Required:** ${guild.mfaLevel === GuildMFALevel.Elevated ? "Yes" : "No"}`,
        ].join("\n"),
        inline: true,
      });

      // Boosts and features
      embed.addFields({
        name: "🚀 Boosts & Features",
        value: [
          `**Boost Tier:** ${boostTier}`,
          `**Boost Count:** ${boostCount}`,
          `**Roles:** ${guild.roles.cache.size}`,
          `**Emojis:** ${guild.emojis.cache.size}`,
          `**Stickers:** ${guild.stickers.cache.size}`,
        ].join("\n"),
        inline: true,
      });

      // Server features (if any)
      if (features.length > 0) {
        embed.addFields({
          name: "✨ Features",
          value: features.join(", ") + (guild.features.length > 10 ? ` and ${guild.features.length - 10} more...` : ""),
          inline: false,
        });
      }

      // Add description if available
      if (guild.description) {
        embed.setDescription(`*${guild.description}*`);
      }

      await interaction.reply({ embeds: [embed] });

      // Log command usage
      await client.logManager.log(guild.id, "COMMAND_SERVERINFO", {
        userId: interaction.user.id,
        channelId: interaction.channel?.id,
        metadata: {
          memberCount: guild.memberCount,
          channelCount: guild.channels.cache.size,
          roleCount: guild.roles.cache.size,
        },
      });
    } catch (error) {
      logger.error("Error in serverinfo command:", error);
      await interaction.reply({
        embeds: [
          new EmbedBuilder()
            .setColor(0xe74c3c)
            .setTitle("❌ Error")
            .setDescription("Failed to fetch server information. Please try again.")
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
