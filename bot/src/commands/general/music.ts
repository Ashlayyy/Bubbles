import {
  SlashCommandBuilder,
  type ChatInputCommandInteraction,
  type GuildMember,
} from "discord.js";

import type { CommandConfig, CommandResponse } from "../_core/index.js";
import { GeneralCommand } from "../_core/specialized/GeneralCommand.js";

class MusicCommand extends GeneralCommand {
  constructor() {
    const config: CommandConfig = {
      name: "music",
      description: "Play and control music in a voice channel",
      category: "general",
      ephemeral: false,
      guildOnly: true,
    };

    super(config);
  }

  protected async execute(): Promise<CommandResponse> {
    if (!this.isSlashCommand()) {
      throw new Error("This command only supports slash command format");
    }

    const interaction = this.interaction as ChatInputCommandInteraction;
    const subcommand = interaction.options.getSubcommand();
    const music = this.client.musicService;

    if (!music?.isReady) {
      return this.createGeneralError("Music Unavailable", "The music player is still starting up. Try again in a moment.");
    }

    try {
      switch (subcommand) {
        case "play":
          return await this.handlePlay();
        case "pause":
          await music.pause(this.guild.id);
          return this.createGeneralSuccess("Paused", "Playback paused.");
        case "resume":
          await music.resume(this.guild.id);
          return this.createGeneralSuccess("Resumed", "Playback resumed.");
        case "skip":
          await music.skip(this.guild.id);
          return this.createGeneralSuccess("Skipped", "Skipped to the next track.");
        case "stop":
          await music.stop(this.guild.id);
          return this.createGeneralSuccess("Stopped", "Left the voice channel and cleared the queue.");
        case "queue":
          return this.handleQueue();
        case "nowplaying":
          return this.handleNowPlaying();
        case "volume": {
          const volume = this.getIntegerOption("level", true);
          const status = await music.setVolume(this.guild.id, volume);
          return this.createGeneralSuccess("Volume", `Volume set to ${status.volume}%.`);
        }
        default:
          return this.createGeneralError("Unknown subcommand", "Use `/music play` to start.");
      }
    } catch (error) {
      return this.createGeneralError(
        "Music Error",
        error instanceof Error ? error.message : "Something went wrong with playback."
      );
    }
  }

  private async handlePlay(): Promise<CommandResponse> {
    const query = this.getStringOption("query", true);
    const member = this.member as GuildMember;
    const status = await this.client.musicService!.play({
      guildId: this.guild.id,
      query,
      voiceChannelId: member.voice.channelId ?? undefined,
      userId: this.user.id,
      textChannelId: this.channel.id,
    });

    const track = status.currentTrack;
    const queued = status.isPlaying && status.queue.length > 0 && status.queue.at(-1);
    if (queued && track && queued.url !== track.url) {
      return this.createGeneralSuccess("Queued", `**${queued.title}** by ${queued.artist} was added to the queue.`);
    }
    return this.createGeneralSuccess(
      "Now playing",
      track ? `**${track.title}** by ${track.artist}` : `Playing \`${query}\`.`
    );
  }

  private handleQueue(): CommandResponse {
    const status = this.client.musicService!.getStatus(this.guild.id);
    if (!status?.currentTrack && status?.queue.length === 0) {
      return this.createGeneralInfo("Queue", "The queue is empty.");
    }
    const lines = [
      status?.currentTrack ? `**Now playing:** ${status.currentTrack.title} — ${status.currentTrack.artist}` : null,
      ...(status?.queue.slice(0, 10).map((track, index) => `${index + 1}. ${track.title} — ${track.artist}`) ?? []),
    ].filter(Boolean);
    if ((status?.queue.length ?? 0) > 10) {
      lines.push(`…and ${status!.queue.length - 10} more`);
    }
    return this.createGeneralInfo("Queue", lines.join("\n"));
  }

  private handleNowPlaying(): CommandResponse {
    const status = this.client.musicService!.getStatus(this.guild.id);
    if (!status?.currentTrack) {
      return this.createGeneralInfo("Now playing", "Nothing is playing right now.");
    }
    const track = status.currentTrack;
    const pos = formatDuration(status.position);
    const dur = formatDuration(status.duration);
    return this.createGeneralInfo(
      "Now playing",
      `**${track.title}** by ${track.artist}\n${status.isPaused ? "Paused" : "Playing"} • ${pos} / ${dur} • volume ${status.volume}%`
    );
  }
}

function formatDuration(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs.toString().padStart(2, "0")}`;
}

export default new MusicCommand();

export const builder = new SlashCommandBuilder()
  .setName("music")
  .setDescription("Play and control music in a voice channel")
  .addSubcommand((sub) =>
    sub
      .setName("play")
      .setDescription("Play a song or add it to the queue")
      .addStringOption((option) =>
        option.setName("query").setDescription("Song name or URL").setRequired(true)
      )
  )
  .addSubcommand((sub) => sub.setName("pause").setDescription("Pause playback"))
  .addSubcommand((sub) => sub.setName("resume").setDescription("Resume playback"))
  .addSubcommand((sub) => sub.setName("skip").setDescription("Skip the current track"))
  .addSubcommand((sub) => sub.setName("stop").setDescription("Stop playback and leave the voice channel"))
  .addSubcommand((sub) => sub.setName("queue").setDescription("Show the current queue"))
  .addSubcommand((sub) => sub.setName("nowplaying").setDescription("Show the track that is playing"))
  .addSubcommand((sub) =>
    sub
      .setName("volume")
      .setDescription("Set playback volume")
      .addIntegerOption((option) =>
        option.setName("level").setDescription("Volume 0-100").setRequired(true).setMinValue(0).setMaxValue(100)
      )
  );
