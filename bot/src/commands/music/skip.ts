import { EmbedBuilder, SlashCommandBuilder } from "discord.js";
import logger from "../../logger.js";
import { musicService } from "../../services/musicService.js";
import type { CommandConfig, CommandResponse } from "../_core/index.js";
import { GeneralCommand } from "../_core/specialized/GeneralCommand.js";

class SkipCommand extends GeneralCommand {
  constructor() {
    const config: CommandConfig = {
      name: "skip",
      description: "Skip the current track",
      category: "music",
      ephemeral: false,
      guildOnly: true,
    };

    super(config);
  }

  protected async execute(): Promise<CommandResponse> {
    // Check if user is in a voice channel
    const member = this.member;
    if (!member?.voice.channel) {
      return this.createGeneralError("Not in Voice Channel", "You must be in a voice channel to control music!");
    }

    try {
      if (!musicService.isAvailable()) {
        return this.createGeneralError("Service Unavailable", "Music service is currently unavailable.");
      }

      // Get current status
      const status = await musicService.getStatus(this.guild.id);

      if (!status || !status.currentTrack) {
        return this.createGeneralError("No Music Playing", "There is no music currently playing to skip!");
      }

      const skippedTrack = status.currentTrack;

      // Skip the current track
      const result = await musicService.skip(this.guild.id);

      if (!result) {
        return this.createGeneralError("Skip Failed", "Failed to skip the current track.");
      }

      // Get updated status to see what's playing next
      const newStatus = await musicService.getStatus(this.guild.id);
      const nextTrack = newStatus?.currentTrack;

      // Create success embed
      const embed = new EmbedBuilder()
        .setTitle("⏭️ Track Skipped")
        .setColor("#00ff00")
        .addFields(
          {
            name: "⏭️ Skipped Track",
            value: `${skippedTrack.title} - ${skippedTrack.artist}`,
            inline: false,
          },
          {
            name: "👤 Skipped by",
            value: this.formatUserDisplay(this.user),
            inline: true,
          }
        )
        .setTimestamp()
        .setFooter({
          text: `Skipped by ${this.user.username}`,
          iconURL: this.user.displayAvatarURL(),
        });

      // Add next track info if available
      if (nextTrack && newStatus?.isPlaying) {
        embed.setDescription(`Now playing: **${nextTrack.title}** by **${nextTrack.artist}**`);
        embed.addFields({
          name: "▶️ Now Playing",
          value: `${nextTrack.title} - ${nextTrack.artist}`,
          inline: true,
        });

        // Add thumbnail if available
        if (nextTrack.thumbnail) {
          embed.setThumbnail(nextTrack.thumbnail);
        }

        // Add queue info
        if (newStatus.queue.length > 1) {
          embed.addFields({
            name: "📊 Queue",
            value: `${newStatus.queue.length - 1} track(s) remaining`,
            inline: true,
          });
        }
      } else {
        embed.setDescription("Queue is now empty. Add more songs with `/music add`!");
        embed.addFields({
          name: "🎵 Queue Status",
          value: "Empty - Add songs with `/music add`",
          inline: true,
        });
      }

      await this.logCommandUsage("skip", {
        skippedTrack: skippedTrack.title,
        nextTrack: nextTrack?.title || "None",
        voiceChannel: member.voice.channel.id,
      });

      return { embeds: [embed], ephemeral: false };
    } catch (error) {
      logger.error("Error in skip command:", error);
      return this.createGeneralError("Error", "Failed to skip track.");
    }
  }
}

export default new SkipCommand();

export const builder = new SlashCommandBuilder().setName("skip").setDescription("Skip the current track");
