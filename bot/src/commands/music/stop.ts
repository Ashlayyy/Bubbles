import { EmbedBuilder, SlashCommandBuilder } from "discord.js";
import logger from "../../logger.js";
import { musicService } from "../../services/musicService.js";
import type { CommandConfig, CommandResponse } from "../_core/index.js";
import { GeneralCommand } from "../_core/specialized/GeneralCommand.js";

class StopCommand extends GeneralCommand {
  constructor() {
    const config: CommandConfig = {
      name: "stop",
      description: "Stop music playback and leave voice channel",
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

      // Get current status before stopping
      const status = await musicService.getStatus(this.guild.id);

      if (!status || (!status.isPlaying && status.queue.length === 0)) {
        return this.createGeneralError("Nothing Playing", "There is no music currently playing to stop!");
      }

      const stoppedTrack = status.currentTrack;
      const queueLength = status.queue.length;

      // Stop the music and leave voice channel
      await musicService.stop(this.guild.id);

      // Create success embed
      const embed = new EmbedBuilder()
        .setTitle("⏹️ Music Stopped")
        .setDescription("Music playback has been stopped and I have left the voice channel.")
        .setColor("#ff0000")
        .addFields(
          {
            name: "⏹️ Stopped",
            value: stoppedTrack ? `${stoppedTrack.title} - ${stoppedTrack.artist}` : "No track was playing",
            inline: false,
          },
          {
            name: "🗑️ Queue Cleared",
            value:
              queueLength > 0
                ? `${queueLength} track${queueLength === 1 ? "" : "s"} removed from queue`
                : "Queue was already empty",
            inline: true,
          },
          {
            name: "👤 Stopped by",
            value: this.formatUserDisplay(this.user),
            inline: true,
          },
          {
            name: "📱 Next Steps",
            value: "Use `/play` to join voice channel and `/music add` to start playing music again!",
            inline: false,
          }
        )
        .setTimestamp()
        .setFooter({
          text: `Stopped by ${this.user.username}`,
          iconURL: this.user.displayAvatarURL(),
        });

      // Add thumbnail if there was a stopped track
      if (stoppedTrack?.thumbnail) {
        embed.setThumbnail(stoppedTrack.thumbnail);
      }

      await this.logCommandUsage("stop", {
        stoppedTrack: stoppedTrack?.title || "None",
        clearedTracks: queueLength,
        voiceChannel: member.voice.channel.id,
      });

      return { embeds: [embed], ephemeral: false };
    } catch (error) {
      logger.error("Error in stop command:", error);
      return this.createGeneralError("Error", "Failed to stop music playback.");
    }
  }
}

export default new StopCommand();

export const builder = new SlashCommandBuilder()
  .setName("stop")
  .setDescription("Stop music playback and leave voice channel");
