import {
  ChannelType,
  EmbedBuilder,
  GuildDefaultMessageNotifications,
  GuildExplicitContentFilter,
  GuildMFALevel,
  SlashCommandBuilder,
} from "discord.js";

import logger from "../../logger.js";
import type { CommandConfig, CommandResponse } from "../_core/index.js";
import { GeneralCommand } from "../_core/specialized/GeneralCommand.js";

class ServerInfoCommand extends GeneralCommand {
  constructor() {
    const config: CommandConfig = {
      name: "serverinfo",
      description: "Display detailed information about the current server",
      category: "general",
      guildOnly: true,
      ephemeral: false,
    };

    super(config);
  }

  protected async execute(): Promise<CommandResponse> {
    try {
      const guild = this.guild;
      await guild.fetch();

      const members = await guild.members.fetch();
      const online = members.filter((m) => m.presence?.status === "online").size;
      const idle = members.filter((m) => m.presence?.status === "idle").size;
      const dnd = members.filter((m) => m.presence?.status === "dnd").size;
      const offline = members.size - online - idle - dnd;

      const textChannels = guild.channels.cache.filter((c) => c.type === ChannelType.GuildText).size;
      const voiceChannels = guild.channels.cache.filter((c) => c.type === ChannelType.GuildVoice).size;
      const categories = guild.channels.cache.filter((c) => c.type === ChannelType.GuildCategory).size;
      const threadChannels = guild.channels.cache.filter((c) => c.isThread()).size;

      const verificationLevels = {
        0: "None",
        1: "Low",
        2: "Medium",
        3: "High",
        4: "Very High",
      } as const;

      const boostTier = guild.premiumTier;
      const boostCount = guild.premiumSubscriptionCount ?? 0;

      const features = guild.features
        .map((f) => f.toLowerCase().replace(/_/g, " "))
        .map((s) => s.charAt(0).toUpperCase() + s.slice(1))
        .slice(0, 10);

      const embed = new EmbedBuilder()
        .setTitle(`📊 ${guild.name}`)
        .setColor(0x5865f2)
        .setThumbnail(guild.iconURL({ size: 256 }))
        .setTimestamp()
        .setFooter({ text: `Server ID: ${guild.id}`, iconURL: this.user.displayAvatarURL() });

      const bannerUrl = guild.bannerURL({ size: 1024 });
      if (bannerUrl) embed.setImage(bannerUrl);

      embed.addFields(
        { name: "👑 Owner", value: `<@${guild.ownerId}>`, inline: true },
        {
          name: "📅 Created",
          value: `<t:${String(Math.floor(guild.createdTimestamp / 1000))}:F>\n(<t:${String(Math.floor(guild.createdTimestamp / 1000))}:R>)`,
          inline: true,
        },
        { name: "🌍 Region", value: guild.preferredLocale, inline: true }
      );

      const humanMembers = members.filter((m) => !m.user.bot).size;
      const botMembers = members.filter((m) => m.user.bot).size;

      embed.addFields({
        name: "👥 Members",
        value: [
          `**Total:** ${String(guild.memberCount.toLocaleString())}`,
          `**Humans:** ${String(humanMembers.toLocaleString())}`,
          `**Bots:** ${String(botMembers.toLocaleString())}`,
          "",
          `🟢 Online: ${String(online)}`,
          `🟡 Idle: ${String(idle)}`,
          `🔴 DND: ${String(dnd)}`,
          `⚪ Offline: ${String(offline)}`,
        ].join("\n"),
        inline: true,
      });

      embed.addFields({
        name: "📝 Channels",
        value: [
          `**Total:** ${String(guild.channels.cache.size)}`,
          `**Text:** ${String(textChannels)}`,
          `**Voice:** ${String(voiceChannels)}`,
          `**Categories:** ${String(categories)}`,
          `**Threads:** ${String(threadChannels)}`,
        ].join("\n"),
        inline: true,
      });

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

      embed.addFields({
        name: "🚀 Boosts & Features",
        value: [
          `**Boost Tier:** ${String(boostTier)}`,
          `**Boost Count:** ${String(boostCount)}`,
          `**Roles:** ${String(guild.roles.cache.size)}`,
          `**Emojis:** ${String(guild.emojis.cache.size)}`,
          `**Stickers:** ${String(guild.stickers.cache.size)}`,
        ].join("\n"),
        inline: true,
      });

      if (features.length)
        embed.addFields({
          name: "✨ Features",
          value:
            features.join(", ") +
            (guild.features.length > 10 ? ` and ${String(guild.features.length - 10)} more...` : ""),
          inline: false,
        });

      if (guild.description) embed.setDescription(`*${guild.description}*`);

      await this.logCommandUsage("serverinfo");

      return { embeds: [embed], ephemeral: false };
    } catch (error) {
      logger.error("Error in serverinfo command:", error);
      return this.createGeneralError("Error", "Failed to fetch server info. Please try again.");
    }
  }
}

export default new ServerInfoCommand();

export const builder = new SlashCommandBuilder()
  .setName("serverinfo")
  .setDescription("Display detailed information about the current server")
  .setDefaultMemberPermissions(0);
