import { ChannelType, EmbedBuilder, GuildPremiumTier, PermissionsBitField, SlashCommandBuilder } from "discord.js";

import logger from "../../logger.js";
import Command from "../../structures/Command.js";
import { PermissionLevel } from "../../structures/PermissionTypes.js";

export default new Command(
  new SlashCommandBuilder()
    .setName("serverinfo")
    .setDescription("ADMIN ONLY: Get detailed server information")
    .setDefaultMemberPermissions(PermissionsBitField.Flags.ModerateMembers),

  async (client, interaction) => {
    // Type guard to ensure this is a chat input command
    if (!interaction.isChatInputCommand()) return;
    if (!interaction.guild) return;

    try {
      const guild = interaction.guild;

      // Fetch owner and additional guild data
      const owner = await guild.fetchOwner().catch(() => null);
      const channels = await guild.channels.fetch();
      const roles = await guild.roles.fetch();
      const emojis = await guild.emojis.fetch();

      const embed = new EmbedBuilder()
        .setTitle(`🏰 ${guild.name}`)
        .setColor(0x3498db)
        .setThumbnail(guild.iconURL({ size: 256 }))
        .setTimestamp()
        .setFooter({
          text: `Server ID: ${guild.id}`,
          iconURL: interaction.user.displayAvatarURL(),
        });

      // Basic server info
      embed.addFields(
        {
          name: "👑 Owner",
          value: owner ? `${owner.user.username} (${owner.user.id})` : "Unknown",
          inline: true,
        },
        {
          name: "📅 Created",
          value: `<t:${Math.floor(guild.createdTimestamp / 1000)}:F>\n<t:${Math.floor(guild.createdTimestamp / 1000)}:R>`,
          inline: true,
        },
        {
          name: "🆔 Server ID",
          value: guild.id,
          inline: true,
        }
      );

      // Member statistics
      const totalMembers = guild.memberCount;
      const onlineMembers = guild.members.cache.filter(
        (member) => member.presence?.status && member.presence.status !== "offline"
      ).size;

      embed.addFields(
        {
          name: "👥 Members",
          value: `**Total:** ${totalMembers}\n**Online:** ${onlineMembers}`,
          inline: true,
        },
        {
          name: "🤖 Bots",
          value: guild.members.cache.filter((member) => member.user.bot).size.toString(),
          inline: true,
        },
        {
          name: "🔒 Verification",
          value: guild.verificationLevel.toString(),
          inline: true,
        }
      );

      // Channel statistics
      const channelStats = {
        text: channels.filter((channel) => channel?.type === ChannelType.GuildText).size,
        voice: channels.filter((channel) => channel?.type === ChannelType.GuildVoice).size,
        category: channels.filter((channel) => channel?.type === ChannelType.GuildCategory).size,
        stage: channels.filter((channel) => channel?.type === ChannelType.GuildStageVoice).size,
        forum: channels.filter((channel) => channel?.type === ChannelType.GuildForum).size,
        announcement: channels.filter((channel) => channel?.type === ChannelType.GuildAnnouncement).size,
      };

      const channelText = [
        `💬 Text: ${channelStats.text}`,
        `🔊 Voice: ${channelStats.voice}`,
        `📁 Categories: ${channelStats.category}`,
        channelStats.stage > 0 ? `🎭 Stage: ${channelStats.stage}` : null,
        channelStats.forum > 0 ? `🗣️ Forum: ${channelStats.forum}` : null,
        channelStats.announcement > 0 ? `📢 Announcement: ${channelStats.announcement}` : null,
      ]
        .filter(Boolean)
        .join("\n");

      embed.addFields({
        name: `📋 Channels (${channels.size})`,
        value: channelText,
        inline: true,
      });

      // Role and emoji information
      embed.addFields(
        {
          name: `🎭 Roles (${roles.size})`,
          value: `Highest: ${guild.roles.highest.name}`,
          inline: true,
        },
        {
          name: `😀 Emojis (${emojis.size})`,
          value: `Static: ${emojis.filter((emoji) => !emoji.animated).size}\nAnimated: ${emojis.filter((emoji) => emoji.animated).size}`,
          inline: true,
        }
      );

      // Server features
      if (guild.features.length > 0) {
        const featureNames: Record<string, string> = {
          ANIMATED_BANNER: "🎬 Animated Banner",
          ANIMATED_ICON: "🎭 Animated Icon",
          BANNER: "🏴 Server Banner",
          COMMERCE: "🛒 Commerce",
          COMMUNITY: "🏘️ Community Server",
          DISCOVERABLE: "🔍 Server Discovery",
          FEATURABLE: "⭐ Featurable",
          INVITE_SPLASH: "🌊 Invite Splash",
          MEMBER_VERIFICATION_GATE_ENABLED: "✋ Membership Screening",
          NEWS: "📰 News Channels",
          PARTNERED: "🤝 Discord Partner",
          PREVIEW_ENABLED: "👀 Preview Enabled",
          VANITY_URL: "🔗 Custom Invite Link",
          VERIFIED: "✅ Verified",
          VIP_REGIONS: "⚡ VIP Voice Regions",
          WELCOME_SCREEN_ENABLED: "👋 Welcome Screen",
        };

        const features = guild.features
          .map((feature) => featureNames[feature] || feature)
          .slice(0, 10) // Limit to prevent embed overflow
          .join("\n");

        embed.addFields({
          name: `✨ Features (${guild.features.length})`,
          value: features + (guild.features.length > 10 ? "\n*...and more*" : ""),
          inline: false,
        });
      }

      // Boost information
      if (guild.premiumTier !== GuildPremiumTier.None) {
        embed.addFields({
          name: "💎 Nitro Boost",
          value: `**Level:** ${guild.premiumTier}\n**Boosts:** ${guild.premiumSubscriptionCount ?? 0}`,
          inline: true,
        });
      }

      // Set banner if available
      if (guild.bannerURL()) {
        embed.setImage(guild.bannerURL({ size: 1024 }));
      }

      await interaction.reply({ embeds: [embed] });

      // Log command usage
      await client.logManager.log(guild.id, "COMMAND_SERVERINFO", {
        userId: interaction.user.id,
        channelId: interaction.channel?.id,
        metadata: {
          guildName: guild.name,
          memberCount: totalMembers,
          channelCount: channels.size,
          roleCount: roles.size,
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
    ephemeral: true,
    permissions: {
      level: PermissionLevel.ADMIN,
      discordPermissions: [PermissionsBitField.Flags.Administrator],
      isConfigurable: true,
    },
  }
);
