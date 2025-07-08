import { EmbedBuilder, SlashCommandBuilder } from "discord.js";
import logger from "../../logger.js";
import { musicService } from "../../services/musicService.js";
import type { CommandConfig, CommandResponse } from "../_core/index.js";
import { GeneralCommand } from "../_core/specialized/GeneralCommand.js";

class PlayCommand extends GeneralCommand {
  constructor() {
    const config: CommandConfig = {
      name: "play",
      description: "Join voice channel and start music playback",
      category: "music",
      ephemeral: false,
      guildOnly: true,
    };

    super(config);
  }

  protected async execute(): Promise<CommandResponse> {
    try {
      if (!musicService.isAvailable()) {
        return this.createGeneralError("Service Unavailable", "Music service is currently unavailable.");
      }

      // Check if user is in voice channel
      const voiceChannel = this.member?.voice?.channel;
      if (!voiceChannel) {
        return this.createGeneralError("Not in Voice", "You need to be in a voice channel to use music commands!");
      }

      // Try to join the voice channel
      await musicService.joinVoice(this.member);

      // Get current status
      const status = await musicService.getStatus(this.guild.id);

      // Create response embed
      const embed = new EmbedBuilder().setTitle("🎵 Music Bot Connected").setColor("#00ff00").setTimestamp();

      if (status?.currentTrack && status.isPlaying) {
        const track = status.currentTrack;
        embed.setDescription(`**Now playing:**\n${track.title} by ${track.artist}`);

        if (track.thumbnail) {
          embed.setThumbnail(track.thumbnail);
        }

        embed.addFields(
          { name: "⏱️ Duration", value: this.formatDuration(track.duration), inline: true },
          {
            name: "🎤 Platform",
            value: track.platform.charAt(0).toUpperCase() + track.platform.slice(1),
            inline: true,
          },
          { name: "📍 Position", value: `${status.position + 1}/${status.queue.length}`, inline: true }
        );

        if (status.isPaused) {
          const currentDescription = embed.data.description || "";
          embed.setDescription(currentDescription + "\n\n⏸️ **Currently paused**");
        }
      } else if (status?.queue.length && status.queue.length > 0) {
        embed.setDescription("Connected to voice channel. Queue has tracks but nothing is playing.");
        embed.addFields({ name: "📊 Queue", value: `${status.queue.length} track(s) in queue`, inline: true });
      } else {
        embed.setDescription(
          "Connected to voice channel and ready to play music!\n\nUse `/music add <query>` to add songs to the queue."
        );
      }

      // Add voice channel info
      embed.addFields({
        name: "🔊 Voice Channel",
        value: voiceChannel.name,
        inline: true,
      });

      // Log command usage
      logger.info("Music play command executed - joined voice channel", {
        voiceChannelId: voiceChannel.id,
        userId: this.user.id,
        guildId: this.guild.id,
      });

      return { embeds: [embed] };
    } catch (error) {
      logger.error("Error in play command:", error);
      return this.createGeneralError("Error", "Failed to join voice channel or get music status.");
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
  .setDescription("Join voice channel and start music playback");
