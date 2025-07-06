import { EmbedBuilder, SlashCommandBuilder } from "discord.js";
import logger from "../../logger.js";
import type { CommandConfig, CommandResponse } from "../_core/index.js";
import { GeneralCommand } from "../_core/specialized/GeneralCommand.js";

class QueueCommand extends GeneralCommand {
  constructor() {
    const config: CommandConfig = {
      name: "queue",
      description: "View the current music queue",
      category: "music",
      ephemeral: false,
      guildOnly: true,
    };

    super(config);
  }

  protected async execute(): Promise<CommandResponse> {
    const page = this.getIntegerOption("page") || 1;

    // Validate page number
    if (page < 1) {
      return this.createGeneralError("Invalid Page", "Page number must be greater than 0.");
    }

    try {
      const musicApiUrl = process.env.API_URL || "http://localhost:3001";

      // Get current queue
      const response = await fetch(`${musicApiUrl}/api/music/${this.guild.id}/queue`, {
        method: "GET",
        headers: {
          Authorization: `Bearer ${process.env.API_TOKEN}`,
        },
      });

      if (!response.ok) {
        throw new Error(`API request failed: ${response.status}`);
      }

      const result = (await response.json()) as any;

      if (!result.success) {
        return this.createGeneralError("Music Error", result.error || "Failed to get queue");
      }

      const queueData = result.data;

      if (!queueData || queueData.length === 0) {
        return {
          embeds: [
            new EmbedBuilder()
              .setTitle("🎵 Music Queue")
              .setDescription("The queue is empty! Add songs with `/play`")
              .setColor("#ffa500")
              .addFields({
                name: "📱 Quick Start",
                value: "Use `/play <song name>` to add music to the queue!",
                inline: false,
              })
              .setTimestamp(),
          ],
          ephemeral: false,
        };
      }

      // Get music status for current track info
      const statusResponse = await fetch(`${musicApiUrl}/api/music/${this.guild.id}/status`, {
        method: "GET",
        headers: {
          Authorization: `Bearer ${process.env.API_TOKEN}`,
        },
      });

      let currentTrack: any = null;
      let isPlaying = false;
      let isPaused = false;

      if (statusResponse.ok) {
        const statusResult = (await statusResponse.json()) as any;
        if (statusResult.success) {
          currentTrack = statusResult.data.currentTrack;
          isPlaying = statusResult.data.isPlaying;
          isPaused = statusResult.data.isPaused;
        }
      }

      // Pagination
      const tracksPerPage = 10;
      const totalTracks = queueData.length;
      const totalPages = Math.ceil(totalTracks / tracksPerPage);

      if (page > totalPages) {
        return this.createGeneralError("Invalid Page", `Page ${page} does not exist. Total pages: ${totalPages}`);
      }

      const startIndex = (page - 1) * tracksPerPage;
      const endIndex = startIndex + tracksPerPage;
      const pageTracks = queueData.slice(startIndex, endIndex);

      // Calculate total queue duration
      const totalDuration = queueData.reduce((sum: number, track: any) => sum + (Number(track.duration) || 0), 0);

      // Format queue tracks
      const queueText = pageTracks
        .map((track: any, index: number) => {
          const queuePosition = startIndex + index + 1;
          const duration = this.formatDuration(track.duration || 0);
          const isCurrentTrack = currentTrack && track.title === currentTrack.title;
          const prefix = isCurrentTrack ? "▶️" : `**${queuePosition}.**`;

          return (
            `${prefix} ${track.title} - ${track.artist}\n` + `⏱️ ${duration} | 👤 ${track.requestedBy || "Unknown"}`
          );
        })
        .join("\n\n");

      // Create queue embed
      const embed = new EmbedBuilder()
        .setTitle("🎵 Music Queue")
        .setDescription(queueText || "No tracks to display")
        .setColor("#9932cc")
        .addFields({
          name: "📊 Queue Stats",
          value:
            `**Total Tracks:** ${totalTracks}\n` +
            `**Total Duration:** ${this.formatDuration(totalDuration)}\n` +
            `**Status:** ${isPlaying ? (isPaused ? "Paused ⏸️" : "Playing ▶️") : "Stopped ⏹️"}`,
          inline: true,
        })
        .setFooter({
          text: `Page ${page}/${totalPages} • Requested by ${this.user.username}`,
          iconURL: this.user.displayAvatarURL(),
        })
        .setTimestamp();

      // Add current track info if available
      if (currentTrack) {
        embed.addFields({
          name: "🎵 Now Playing",
          value:
            `**${currentTrack.title}** by **${currentTrack.artist}**\n` +
            `👤 Requested by ${currentTrack.requestedBy || "Unknown"}`,
          inline: true,
        });

        // Add thumbnail if available
        if (currentTrack.thumbnail) {
          embed.setThumbnail(currentTrack.thumbnail);
        }
      }

      await this.logCommandUsage("queue", {
        page,
        totalTracks,
        isPlaying,
        currentTrack: currentTrack?.title || null,
      });

      return { embeds: [embed], ephemeral: false };
    } catch (error) {
      logger.error("Error executing queue command:", error);
      return this.createGeneralError("Error", "An error occurred while fetching the queue. Please try again.");
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

export default new QueueCommand();

export const builder = new SlashCommandBuilder()
  .setName("queue")
  .setDescription("View the current music queue")
  .addIntegerOption((option) =>
    option.setName("page").setDescription("The page number to view").setRequired(false).setMinValue(1).setMaxValue(100)
  );
