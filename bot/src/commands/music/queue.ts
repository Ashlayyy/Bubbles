import { EmbedBuilder, SlashCommandBuilder } from "discord.js";
import logger from "../../logger.js";
import { musicService } from "../../services/musicService.js";
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
      // Get current status and queue
      const status = await musicService.getStatus(this.guild.id);

      if (!status || status.queue.length === 0) {
        return {
          embeds: [
            new EmbedBuilder()
              .setTitle("🎵 Music Queue")
              .setDescription("The queue is empty! Add songs with `/music add`")
              .setColor("#ffa500")
              .addFields({
                name: "📱 Quick Start",
                value: "Use `/music add <song name>` to add music to the queue!",
                inline: false,
              })
              .setTimestamp(),
          ],
          ephemeral: false,
        };
      }

      const queue = status.queue;
      const currentTrack = status.currentTrack;
      const isPlaying = status.isPlaying;
      const isPaused = status.isPaused;

      // Pagination
      const tracksPerPage = 10;
      const totalTracks = queue.length;
      const totalPages = Math.ceil(totalTracks / tracksPerPage);

      if (page > totalPages) {
        return this.createGeneralError("Invalid Page", `Page ${page} does not exist. Total pages: ${totalPages}`);
      }

      const startIndex = (page - 1) * tracksPerPage;
      const endIndex = startIndex + tracksPerPage;
      const pageTracks = queue.slice(startIndex, endIndex);

      // Calculate total queue duration
      const totalDuration = queue.reduce((sum, track) => sum + track.duration, 0);

      // Format queue tracks
      const queueText = pageTracks
        .map((track, index) => {
          const queuePosition = startIndex + index + 1;
          const duration = this.formatDuration(track.duration);
          const isCurrentTrack = currentTrack && track.id === currentTrack.id;
          const prefix = isCurrentTrack ? "▶️" : `**${queuePosition}.**`;

          return (
            `${prefix} ${track.title} - ${track.artist}\n` +
            `⏱️ ${duration} | 🎤 ${track.platform} | 👤 ${track.requestedBy || "Unknown"}`
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
            `**Status:** ${isPlaying ? (isPaused ? "Paused ⏸️" : "Playing ▶️") : "Stopped ⏹️"}\n` +
            `**Loop Mode:** ${status.loopMode === "none" ? "Off" : status.loopMode === "track" ? "Track 🔂" : "Queue 🔁"}\n` +
            `**Volume:** ${status.volume}%`,
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
            `🎤 ${currentTrack.platform} | 👤 Requested by ${currentTrack.requestedBy || "Unknown"}`,
          inline: true,
        });

        // Add thumbnail if available
        if (currentTrack.thumbnail) {
          embed.setThumbnail(currentTrack.thumbnail);
        }
      }

      // Add queue management hints
      if (queue.length > 1) {
        embed.addFields({
          name: "🎛️ Queue Controls",
          value:
            "Use `/skip` to skip current track\nUse `/remove <position>` to remove a track\nUse `/clear` to clear the queue",
          inline: false,
        });
      }

      await this.logCommandUsage("queue", {
        page,
        totalTracks,
        isPlaying,
        currentTrack: currentTrack?.title || null,
      });

      return { embeds: [embed], ephemeral: false };
    } catch (error) {
      logger.error("Error in queue command:", error);
      return this.createGeneralError("Error", "Failed to get queue information.");
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
