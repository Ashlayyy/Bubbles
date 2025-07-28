import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  EmbedBuilder,
  GuildMember,
  SlashCommandBuilder,
} from "discord.js";

import logger from "../../logger.js";
import type { CommandConfig, CommandResponse } from "../_core/index.js";
import { GeneralCommand } from "../_core/specialized/GeneralCommand.js";

class AvatarCommand extends GeneralCommand {
  constructor() {
    const config: CommandConfig = {
      name: "avatar",
      description: "Display a user's avatar in high quality",
      category: "general",
      ephemeral: true,
      guildOnly: true,
    };

    super(config);
  }

  protected async execute(): Promise<CommandResponse> {
    const targetUser = this.getUserOption("user") ?? this.user;
    const format = this.getStringOption("format") as "png" | "jpg" | "webp" | "gif" | undefined;
    const size = this.getIntegerOption("size") ?? 1024;

    try {
      const member: GuildMember | null = await this.guild.members.fetch(targetUser.id).catch(() => null);

      const embed = new EmbedBuilder()
        .setTitle(`🖼️ ${this.formatUserDisplay(targetUser)}'s Avatar`)
        .setColor(member?.displayHexColor ?? 0x3498db)
        .setTimestamp()
        .setFooter({ text: `Requested by ${this.user.username}`, iconURL: this.user.displayAvatarURL() });

      let avatarURL: string;
      let avatarType: string;

      if (member?.avatar) {
        avatarURL = member.displayAvatarURL({
          size: size as 64 | 128 | 256 | 512 | 1024 | 2048 | 4096,
          extension: format ?? (member.avatar.startsWith("a_") ? "gif" : "png"),
        });
        avatarType = "Server Avatar";
      } else {
        avatarURL = targetUser.displayAvatarURL({
          size: size as 64 | 128 | 256 | 512 | 1024 | 2048 | 4096,
          extension: format ?? (targetUser.avatar?.startsWith("a_") ? "gif" : "png"),
        });
        avatarType = "Global Avatar";
      }

      embed.setImage(avatarURL).setDescription(`**${avatarType}** - ${size}px`);

      const formats = ["png", "jpg", "webp"];
      if (targetUser.avatar?.startsWith("a_") || member?.avatar?.startsWith("a_")) formats.push("gif");

      const links = formats
        .map((fmt) => {
          const url = member?.avatar
            ? member.displayAvatarURL({ size: 4096, extension: fmt as "png" | "jpg" | "webp" | "gif" })
            : targetUser.displayAvatarURL({ size: 4096, extension: fmt as "png" | "jpg" | "webp" | "gif" });
          return `[${fmt.toUpperCase()}](${url})`;
        })
        .join(" • ");

      embed.addFields({ name: "📥 Download Links (4096px)", value: links, inline: false });

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

      await this.logCommandUsage("avatar", { target: targetUser.id, size, format: format ?? "auto" });

      return { embeds: [embed], components: row.components.length ? [row] : [], ephemeral: true };
    } catch (error) {
      logger.error("Error in avatar command:", error);
      return this.createGeneralError("Error", "Failed to fetch avatar. Please try again.");
    }
  }
}

export default new AvatarCommand();

export const builder = new SlashCommandBuilder()
  .setName("avatar")
  .setDescription("Display a user's avatar in high quality")
  .setDefaultMemberPermissions(0)
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
  );
