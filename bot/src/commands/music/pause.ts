import { EmbedBuilder, SlashCommandBuilder } from "discord.js";
import logger from "../../logger.js";
import type { CommandConfig, CommandResponse } from "../_core/index.js";
import { GeneralCommand } from "../_core/specialized/GeneralCommand.js";

class PauseCommand extends GeneralCommand {
  constructor() {
    const config: CommandConfig = {
      name: "pause",
      description: "Pause or resume music playback",
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

      // First get current status to determine if we should pause or resume
      const statusResponse = await fetch(`${musicApiUrl}/api/music/${this.guild.id}/status`, {
        method: "GET",
        headers: {
          Authorization: `Bearer ${process.env.API_TOKEN}`,
        },
      });

      if (!statusResponse.ok) {
        throw new Error(`API request failed: ${statusResponse.status}`);
      }

      const statusResult = (await statusResponse.json()) as any;

      if (!statusResult.success) {
        return this.createGeneralError("Music Error", "Failed to get music status");
      }

      const status = statusResult.data;

      if (!status.currentTrack) {
        return this.createGeneralError("No Music Playing", "There is no music currently playing to pause!");
      }

      // Determine action based on current state
      const action = status.isPaused ? "resume" : "pause";
      const endpoint = status.isPaused ? "resume" : "pause";

      // Make the pause/resume request
      const response = await fetch(`${musicApiUrl}/api/music/${this.guild.id}/${endpoint}`, {
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
        return this.createGeneralError("Music Error", result.error || `Failed to ${action} music`);
      }

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
        voiceChannel: member.voice.channel.id,
      });

      return { embeds: [embed], ephemeral: false };
    } catch (error) {
      logger.error("Error executing pause command:", error);
      return this.createGeneralError(
        "Error",
        "An error occurred while trying to control music playback. Please try again."
      );
    }
  }
}

export default new PauseCommand();

export const builder = new SlashCommandBuilder().setName("pause").setDescription("Pause or resume music playback");
