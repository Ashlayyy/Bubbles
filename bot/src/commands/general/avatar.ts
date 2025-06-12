import { ActionRowBuilder, ButtonBuilder, ButtonStyle, EmbedBuilder, SlashCommandBuilder } from "discord.js";

import logger from "../../logger.js";
import Command from "../../structures/Command.js";
import { PermissionLevel } from "../../structures/PermissionTypes.js";

export default new Command(
  new SlashCommandBuilder()
    .setName("avatar")
    .setDescription("Display a user's avatar in high quality")
    .addUserOption((opt) => opt.setName("user").setDescription("User to get avatar from (defaults to yourself)"))
    .addStringOption((opt) =>
      opt
        .setName("format")
        .setDescription("Image format")
        .addChoices(
          { name: "PNG", value: "png" },
          { name: "JPG", value: "jpg" },
          { name: "WebP", value: "webp" },
          { name: "GIF (animated)", value: "gif" }
        )
    )
    .addIntegerOption((opt) =>
      opt
        .setName("size")
        .setDescription("Image size")
        .addChoices(
          { name: "64px", value: 64 },
          { name: "128px", value: 128 },
          { name: "256px", value: 256 },
          { name: "512px", value: 512 },
          { name: "1024px", value: 1024 },
          { name: "2048px", value: 2048 },
          { name: "4096px", value: 4096 }
        )
    ),

  async (client, interaction) => {
    // Type guard to ensure this is a chat input command
    if (!interaction.isChatInputCommand()) return;
    if (!interaction.guild) return;

    const targetUser = interaction.options.getUser("user") ?? interaction.user;
    const format = interaction.options.getString("format") as "png" | "jpg" | "webp" | "gif" | null;
    const size = interaction.options.getInteger("size") ?? 1024;

    try {
      // Get member to check for server-specific avatar
      const member = await interaction.guild.members.fetch(targetUser.id).catch(() => null);

      const embed = new EmbedBuilder()
        .setTitle(`🖼️ ${targetUser.displayName}'s Avatar`)
        .setColor(member?.displayHexColor ?? 0x3498db)
        .setTimestamp()
        .setFooter({
          text: `Requested by ${interaction.user.username}`,
          iconURL: interaction.user.displayAvatarURL(),
        });

      // Determine which avatar to show
      let avatarURL: string;
      let avatarType: string;

      if (member?.avatar) {
        // Server-specific avatar
        avatarURL = member.displayAvatarURL({
          size: size as 64 | 128 | 256 | 512 | 1024 | 2048 | 4096,
          extension: format ?? (member.avatar.startsWith("a_") ? "gif" : "png"),
        });
        avatarType = "Server Avatar";
      } else {
        // Global avatar
        avatarURL = targetUser.displayAvatarURL({
          size: size as 64 | 128 | 256 | 512 | 1024 | 2048 | 4096,
          extension: format ?? (targetUser.avatar?.startsWith("a_") ? "gif" : "png"),
        });
        avatarType = "Global Avatar";
      }

      embed.setImage(avatarURL);
      embed.setDescription(`**${avatarType}** - ${size}px`);

      // Add download links for different formats and sizes
      const formats = ["png", "jpg", "webp"];
      if (targetUser.avatar?.startsWith("a_") || member?.avatar?.startsWith("a_")) {
        formats.push("gif");
      }

      const links = formats
        .map((fmt) => {
          const url = member?.avatar
            ? member.displayAvatarURL({ size: 4096, extension: fmt as "png" | "jpg" | "webp" | "gif" })
            : targetUser.displayAvatarURL({ size: 4096, extension: fmt as "png" | "jpg" | "webp" | "gif" });
          return `[${fmt.toUpperCase()}](${url})`;
        })
        .join(" • ");

      embed.addFields({
        name: "📥 Download Links (4096px)",
        value: links,
        inline: false,
      });

      // Create buttons for different views
      const row = new ActionRowBuilder<ButtonBuilder>();

      if (member?.avatar && member.avatar !== targetUser.avatar) {
        row.addComponents(
          new ButtonBuilder()
            .setLabel("Global Avatar")
            .setStyle(ButtonStyle.Secondary)
            .setCustomId(`avatar_global_${targetUser.id}`)
        );
      }

      if (targetUser.avatar?.startsWith("a_") || member?.avatar?.startsWith("a_")) {
        row.addComponents(
          new ButtonBuilder()
            .setLabel("GIF Version")
            .setStyle(ButtonStyle.Primary)
            .setCustomId(`avatar_gif_${targetUser.id}`)
        );
      }

      const components = row.components.length > 0 ? [row] : [];

      await interaction.reply({
        embeds: [embed],
        components,
      });

      // Log command usage
      await client.logManager.log(interaction.guild.id, "COMMAND_AVATAR", {
        userId: interaction.user.id,
        channelId: interaction.channel?.id,
        metadata: {
          targetUserId: targetUser.id,
          targetUsername: targetUser.username,
          format: format ?? "auto",
          size,
          hasServerAvatar: !!member?.avatar,
        },
      });
    } catch (error) {
      logger.error("Error in avatar command:", error);
      await interaction.reply({
        embeds: [
          new EmbedBuilder()
            .setColor(0xe74c3c)
            .setTitle("❌ Error")
            .setDescription("Failed to fetch avatar. Please try again.")
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
