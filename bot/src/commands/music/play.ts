import { EmbedBuilder, SlashCommandBuilder } from "discord.js";
import logger from "../../logger.js";
import { musicApiService } from "../../services/musicApiService.js";
import type { CommandConfig, CommandResponse } from "../_core/index.js";
import { GeneralCommand } from "../_core/specialized/GeneralCommand.js";

class PlayCommand extends GeneralCommand {
  constructor() {
    const config: CommandConfig = {
      name: "play",
      description: "Play music or add to queue",
      category: "music",
      ephemeral: false,
      guildOnly: true,
    };

    super(config);
  }

  protected async execute(): Promise<CommandResponse> {
    const query = this.getStringOption("query", true);

    // Check if user is in a voice channel
    if (!this.member.voice.channel) {
      return this.createGeneralError("Not in Voice Channel", "You must be in a voice channel to play music!");
    }

    try {
      // Check if API service is configured
      if (!musicApiService.isConfigured()) {
        return this.createGeneralError("Service Unavailable", "Music service is not properly configured.");
      }

      // Prepare play request
      const playRequest = {
        query,
        userId: this.user.id,
        username: this.user.username,
        voiceChannelId: this.member.voice.channel.id,
        textChannelId: this.channel.id,
      };

      // Use the API service to play music
      const result = await musicApiService.play(this.guild.id, playRequest);

      if (!result.success) {
        return this.createGeneralError("Music Error", result.error || "Failed to play music");
      }

      const musicData = result.data!;
      const track = musicData.track;
      const position = musicData.position;

      // Create response embed
      const embed = new EmbedBuilder().setTitle("🎵 Music").setColor("#00ff00").setTimestamp();

      const description = position === 1 ? `**Now playing:**\n${track.title}` : `**Added to queue:**\n${track.title}`;
      embed.setDescription(description);

      const fields = [
        { name: "👤 Artist", value: track.artist || "Unknown", inline: true },
        { name: "⏱️ Duration", value: this.formatDuration(track.duration), inline: true },
      ];

      if (position === 1) {
        fields.push({
          name: "🎤 Platform",
          value: track.platform.charAt(0).toUpperCase() + track.platform.slice(1),
          inline: true,
        });
      } else {
        fields.push({ name: "📍 Position", value: `#${position}`, inline: true });
      }

      embed.addFields(...fields);

      if (track.thumbnail) {
        embed.setThumbnail(track.thumbnail);
      }

      if (track.url) {
        embed.setURL(track.url);
      }

      embed.addFields({
        name: "👤 Requested by",
        value: this.user.username,
        inline: true,
      });

      // Log command usage
      logger.info("Music play command executed", {
        query,
        trackTitle: track.title,
        position,
        userId: this.user.id,
        guildId: this.guild.id,
      });

      return { embeds: [embed] };
    } catch (error) {
      logger.error("Error executing play command:", error);
      return this.createGeneralError("Error", "An error occurred while trying to play music. Please try again.");
    }
  }

  private formatDuration(milliseconds: number): string {
    const seconds = Math.floor(milliseconds / 1000);
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;

    if (minutes >= 60) {
      const hours = Math.floor(minutes / 60);
      const remainingMinutes = minutes % 60;
      return `${hours}:${remainingMinutes.toString().padStart(2, "0")}:${remainingSeconds.toString().padStart(2, "0")}`;
    }

    return `${minutes}:${remainingSeconds.toString().padStart(2, "0")}`;
  }
}

export default new PlayCommand();

export const builder = new SlashCommandBuilder()
  .setName("play")
  .setDescription("Play music or add to queue")
  .addStringOption((option) =>
    option.setName("query").setDescription("Song name, artist, or URL to play").setRequired(true)
  );
