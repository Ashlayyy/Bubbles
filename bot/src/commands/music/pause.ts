import { EmbedBuilder, SlashCommandBuilder } from "discord.js";
import logger from "../../logger.js";
import { musicService } from "../../services/musicService.js";
import type { CommandConfig, CommandResponse } from "../_core/index.js";
import { GeneralCommand } from "../_core/specialized/GeneralCommand.js";

class MusicPauseCommand extends GeneralCommand {
  constructor() {
    const config: CommandConfig = {
      name: "pause",
      description: "Pause or resume music playback (smart toggle)",
      category: "music",
      ephemeral: false,
      guildOnly: true,
    };

    super(config);
  }

  protected async execute(): Promise<CommandResponse> {
    // Check if user is in a voice channel
    const voiceChannel = this.member?.voice?.channel;
    if (!voiceChannel) {
      return this.createGeneralError("Not in Voice Channel", "You must be in a voice channel to control music!");
    }

    try {
      if (!musicService.isAvailable()) {
        return this.createGeneralError("Service Unavailable", "Music service is currently unavailable.");
      }

      // Get current status
      const status = await musicService.getStatus(this.guild.id);

      if (!status || !status.currentTrack) {
        return this.createGeneralError("No Music Playing", "There is no music currently playing to pause!");
      }

      // Smart pause/resume toggle - returns true if paused, false if resumed
      const wasPaused = await musicService.pause(this.guild.id);
      const action = wasPaused ? "pause" : "resume";

      // Create success embed
      const embed = new EmbedBuilder()
        .setTitle(action === "pause" ? "⏸️ Music Paused" : "▶️ Music Resumed")
        .setDescription(
          action === "pause"
            ? `Paused **${status.currentTrack.title}** by **${status.currentTrack.artist}**`
            : `Resumed **${status.currentTrack.title}** by **${status.currentTrack.artist}**`
        )
        .setColor(action === "pause" ? "#ffa500" : "#00ff00")
        .addFields(
          {
            name: "🎵 Current Track",
            value: `${status.currentTrack.title} - ${status.currentTrack.artist}`,
            inline: true,
          },
          {
            name: "👤 Action by",
            value: this.formatUserDisplay(this.user),
            inline: true,
          },
          {
            name: "📱 Controls",
            value:
              action === "pause"
                ? "Use `/pause` again to resume playback"
                : "Use `/pause` to pause again, or `/skip` to skip track",
            inline: false,
          }
        )
        .setTimestamp()
        .setFooter({
          text: `${action === "pause" ? "Paused" : "Resumed"} by ${this.user.username}`,
          iconURL: this.user.displayAvatarURL(),
        });

      // Add thumbnail if available
      if (status.currentTrack.thumbnail) {
        embed.setThumbnail(status.currentTrack.thumbnail);
      }

      await this.logCommandUsage("pause", {
        action,
        trackTitle: status.currentTrack.title,
        voiceChannel: voiceChannel.id,
      });

      return { embeds: [embed], ephemeral: false };
    } catch (error) {
      logger.error("Error in pause command:", error);
      return this.createGeneralError("Error", "Failed to toggle playback.");
    }
  }
}

export default new MusicPauseCommand();

export const builder = new SlashCommandBuilder()
  .setName("pause")
  .setDescription("Pause or resume music playback (smart toggle)");
