import { EmbedBuilder, SlashCommandBuilder } from "discord.js";
import logger from "../../logger.js";
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
      const musicApiUrl = process.env.API_URL || "http://localhost:3001";

      // Make the skip request
      const response = await fetch(`${musicApiUrl}/api/music/${this.guild.id}/skip`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${process.env.API_TOKEN}`,
        },
        body: JSON.stringify({
          requestedBy: this.user.id,
          requestedByName: this.user.username,
        }),
      });

      if (!response.ok) {
        throw new Error(`API request failed: ${response.status}`);
      }

      const result = (await response.json()) as any;

      if (!result.success) {
        return this.createGeneralError("Music Error", result.error || "Failed to skip track");
      }

      const skippedTrack = result.data.skippedTrack;
      const nextTrack = result.data.nextTrack;

      // Create success embed
      const embed = new EmbedBuilder()
        .setTitle("⏭️ Track Skipped")
        .setColor("#00ff00")
        .addFields(
          {
            name: "⏭️ Skipped Track",
            value: skippedTrack ? `${skippedTrack.title} - ${skippedTrack.artist}` : "No track was playing",
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
      if (nextTrack) {
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
      } else {
        embed.setDescription("Queue is now empty. Add more songs with `/play`!");
        embed.addFields({
          name: "🎵 Queue Status",
          value: "Empty - Add songs with `/play`",
          inline: true,
        });
      }

      await this.logCommandUsage("skip", {
        skippedTrack: skippedTrack?.title || "None",
        nextTrack: nextTrack?.title || "None",
        voiceChannel: member.voice.channel.id,
      });

      return { embeds: [embed], ephemeral: false };
    } catch (error) {
      logger.error("Error executing skip command:", error);
      return this.createGeneralError("Error", "An error occurred while trying to skip the track. Please try again.");
    }
  }
}

export default new SkipCommand();

export const builder = new SlashCommandBuilder().setName("skip").setDescription("Skip the current track");
