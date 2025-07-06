import { EmbedBuilder, SlashCommandBuilder } from "discord.js";
import logger from "../../logger.js";
import type { CommandConfig, CommandResponse } from "../_core/index.js";
import { GeneralCommand } from "../_core/specialized/GeneralCommand.js";

class StopCommand extends GeneralCommand {
  constructor() {
    const config: CommandConfig = {
      name: "stop",
      description: "Stop music playback and clear the queue",
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

      // Make the stop request
      const response = await fetch(`${musicApiUrl}/api/music/${this.guild.id}/stop`, {
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
        return this.createGeneralError("Music Error", result.error || "Failed to stop music");
      }

      const stoppedTrack = result.data.stoppedTrack;
      const clearedTracks = result.data.clearedTracks || 0;

      // Create success embed
      const embed = new EmbedBuilder()
        .setTitle("⏹️ Music Stopped")
        .setDescription("Music playback has been stopped and the queue has been cleared.")
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
              clearedTracks > 0
                ? `${clearedTracks} track${clearedTracks === 1 ? "" : "s"} removed from queue`
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
            value: "Use `/play` to start playing music again!",
            inline: false,
          }
        )
        .setTimestamp()
        .setFooter({
          text: `Stopped by ${this.user.username}`,
          iconURL: this.user.displayAvatarURL(),
        });

      await this.logCommandUsage("stop", {
        stoppedTrack: stoppedTrack?.title || "None",
        clearedTracks,
        voiceChannel: member.voice.channel.id,
      });

      return { embeds: [embed], ephemeral: false };
    } catch (error) {
      logger.error("Error executing stop command:", error);
      return this.createGeneralError("Error", "An error occurred while trying to stop music. Please try again.");
    }
  }
}

export default new StopCommand();

export const builder = new SlashCommandBuilder()
  .setName("stop")
  .setDescription("Stop music playback and clear the queue");
