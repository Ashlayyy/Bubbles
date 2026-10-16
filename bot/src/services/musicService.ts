import { ChannelType, GuildMember, type Guild, type VoiceBasedChannel } from "discord.js";
import { Player, QueryType, QueueRepeatMode, type GuildQueue, type Track } from "discord-player";
import { YoutubeiExtractor } from "discord-player-youtubei";
import ffmpegPath from "ffmpeg-static";

import { getGuildConfig } from "../database/GuildConfig.js";
import { prisma } from "../database/index.js";
import logger from "../logger.js";
import type Client from "../structures/Client.js";

export interface MusicTrackSnapshot {
  id: string;
  title: string;
  artist: string;
  url: string;
  thumbnail?: string;
  duration: number;
  requestedBy: string;
}

export interface MusicStatusSnapshot {
  playbackEnabled: true;
  isPlaying: boolean;
  isPaused: boolean;
  currentTrack: MusicTrackSnapshot | null;
  queue: MusicTrackSnapshot[];
  volume: number;
  repeatMode: "OFF" | "TRACK" | "QUEUE";
  shuffleEnabled: boolean;
  position: number;
  duration: number;
  voiceChannelId: string | null;
  textChannelId: string | null;
}

function asTrackSnapshot(track: Track | null | undefined): MusicTrackSnapshot | null {
  if (!track) return null;
  const requestedBy =
    (track.requestedBy && ("id" in track.requestedBy ? track.requestedBy.id : String(track.requestedBy))) || "unknown";
  return {
    id: track.id,
    title: track.title || "Unknown",
    artist: track.author || "Unknown Artist",
    url: track.url || "",
    thumbnail: track.thumbnail,
    duration: Math.round((track.durationMS || 0) / 1000),
    requestedBy: String(requestedBy),
  };
}

function repeatLabel(mode: QueueRepeatMode): "OFF" | "TRACK" | "QUEUE" {
  if (mode === QueueRepeatMode.TRACK) return "TRACK";
  if (mode === QueueRepeatMode.QUEUE) return "QUEUE";
  return "OFF";
}

function toRepeatMode(value: string | undefined): QueueRepeatMode {
  const normalized = (value ?? "OFF").toUpperCase();
  if (normalized === "TRACK" || normalized === "ONE") return QueueRepeatMode.TRACK;
  if (normalized === "QUEUE" || normalized === "ALL") return QueueRepeatMode.QUEUE;
  return QueueRepeatMode.OFF;
}

export class MusicService {
  private player: Player | null = null;
  private ready = false;

  constructor(private readonly client: Client) {}

  get isReady(): boolean {
    return this.ready && this.player !== null;
  }

  getPlayer(): Player | null {
    return this.player;
  }

  activeQueueCount(): number {
    return this.player?.nodes.cache.size ?? 0;
  }

  playingCount(): number {
    if (!this.player) return 0;
    let playing = 0;
    for (const queue of this.player.nodes.cache.values()) {
      if (queue.node.isPlaying()) playing += 1;
    }
    return playing;
  }

  async initialize(): Promise<void> {
    if (ffmpegPath) {
      process.env.FFMPEG_PATH = ffmpegPath;
    }

    this.player = new Player(this.client, {
      skipFFmpeg: false,
    });

    try {
      await (this.player.extractors.register as (extractor: unknown, options?: unknown) => Promise<unknown>)(
        YoutubeiExtractor,
        {}
      );
    } catch (error) {
      logger.error("Failed to register YouTube extractor:", error);
      throw error;
    }

    this.bindEvents();
    this.ready = true;
    logger.info("Music service initialized (discord-player + youtubei)");
  }

  private bindEvents(): void {
    if (!this.player) return;

    this.player.events.on("playerStart", (queue, track) => {
      void this.persistQueue(queue, track);
      logger.info(`Now playing in ${queue.guild.name}: ${track.title}`);
    });

    this.player.events.on("audioTrackAdd", (queue) => {
      void this.persistQueue(queue);
    });

    this.player.events.on("audioTracksAdd", (queue) => {
      void this.persistQueue(queue);
    });

    this.player.events.on("emptyQueue", (queue) => {
      void this.persistQueue(queue);
    });

    this.player.events.on("disconnect", (queue) => {
      void this.persistQueue(queue, null, { playing: false, paused: false, clear: true });
    });

    this.player.events.on("error", (queue, error) => {
      logger.error(`Music player error in ${queue.guild.id}:`, error);
    });

    this.player.events.on("playerError", (queue, error) => {
      logger.error(`Music playback error in ${queue.guild.id}:`, error);
    });
  }

  private async persistQueue(
    queue: GuildQueue,
    startedTrack?: Track | null,
    opts: { playing?: boolean; paused?: boolean; clear?: boolean } = {}
  ): Promise<void> {
    try {
      const current = asTrackSnapshot(startedTrack === undefined ? queue.currentTrack : startedTrack);
      const tracks = opts.clear
        ? []
        : queue.tracks
            .toArray()
            .map((track) => asTrackSnapshot(track))
            .filter((track): track is MusicTrackSnapshot => Boolean(track));
      await prisma.musicQueue.upsert({
        where: { guildId: queue.guild.id },
        create: {
          guildId: queue.guild.id,
          channelId: queue.channel?.id,
          playing: opts.playing ?? queue.node.isPlaying(),
          paused: opts.paused ?? queue.node.isPaused(),
          volume: queue.node.volume,
          repeat: repeatLabel(queue.repeatMode),
          shuffle: false,
          currentTrack: current ? { ...current } : null,
          tracks: tracks.map((track) => ({ ...track })),
        },
        update: {
          channelId: queue.channel?.id,
          playing: opts.playing ?? queue.node.isPlaying(),
          paused: opts.paused ?? queue.node.isPaused(),
          volume: queue.node.volume,
          repeat: repeatLabel(queue.repeatMode),
          currentTrack: current ? { ...current } : null,
          tracks: tracks.map((track) => ({ ...track })),
        },
      });

      if (current && startedTrack) {
        await prisma.musicHistory.create({
          data: {
            guildId: queue.guild.id,
            title: current.title,
            artist: current.artist,
            url: current.url,
            thumbnail: current.thumbnail,
            duration: current.duration,
            requestedBy: current.requestedBy,
          },
        });
      }
    } catch (error) {
      logger.warn("Failed to persist music queue:", error);
    }
  }

  getStatus(guildId: string): MusicStatusSnapshot | null {
    const queue = this.player?.nodes.get(guildId);
    if (!queue) return null;
    const progress = queue.node.getTimestamp();
    const current = asTrackSnapshot(queue.currentTrack);
    return {
      playbackEnabled: true,
      isPlaying: queue.node.isPlaying(),
      isPaused: queue.node.isPaused(),
      currentTrack: current,
      queue: queue.tracks.toArray().map((track) => asTrackSnapshot(track)).filter((track): track is MusicTrackSnapshot => Boolean(track)),
      volume: queue.node.volume,
      repeatMode: repeatLabel(queue.repeatMode),
      shuffleEnabled: false,
      position: Math.round((progress?.current.value ?? 0) / 1000),
      duration: current?.duration ?? 0,
      voiceChannelId: queue.channel?.id ?? null,
      textChannelId: (queue.metadata as { textChannelId?: string } | undefined)?.textChannelId ?? null,
    };
  }

  async resolveVoiceChannel(
    guild: Guild,
    options: { voiceChannelId?: string; userId?: string } = {}
  ): Promise<VoiceBasedChannel> {
    if (options.voiceChannelId) {
      const channel = await guild.channels.fetch(options.voiceChannelId).catch(() => null);
      if (channel?.isVoiceBased()) return channel;
      throw new Error("That voice channel was not found.");
    }

    if (options.userId) {
      const member = await guild.members.fetch(options.userId).catch(() => null);
      if (member?.voice.channel) return member.voice.channel;
    }

    const occupied = guild.channels.cache.find(
      (channel): channel is VoiceBasedChannel =>
        channel.isVoiceBased() && channel.members.filter((member) => !member.user.bot).size > 0
    );
    if (occupied) return occupied;

    const config = await getGuildConfig(guild.id);
    if (config.musicChannelId) {
      const configured = await guild.channels.fetch(config.musicChannelId).catch(() => null);
      if (configured?.isVoiceBased()) return configured;
    }

    throw new Error("Join a voice channel, or pick one on the dashboard, then try again.");
  }

  async play(options: {
    guildId: string;
    query: string;
    voiceChannelId?: string;
    userId?: string;
    textChannelId?: string;
    volume?: number;
  }): Promise<MusicStatusSnapshot> {
    if (!this.player) throw new Error("Music player is not ready.");
    const guild = await this.client.guilds.fetch(options.guildId);
    const voiceChannel = await this.resolveVoiceChannel(guild, options);
    const requestedBy = options.userId
      ? await this.client.users.fetch(options.userId).catch(() => this.client.user)
      : this.client.user;

    const result = await this.player.play(voiceChannel, options.query, {
      requestedBy: requestedBy ?? undefined,
      searchEngine: QueryType.AUTO,
      nodeOptions: {
        metadata: {
          guildId: guild.id,
          textChannelId: options.textChannelId,
          requestedBy: options.userId,
        },
        volume: options.volume ?? 50,
        selfDeaf: true,
        leaveOnEmpty: true,
        leaveOnEmptyCooldown: 30_000,
        leaveOnEnd: true,
        leaveOnEndCooldown: 300_000,
      },
    });

    if (!result.track) {
      throw new Error("No tracks found for that query.");
    }

    return this.getStatus(guild.id) ?? this.emptyStatus();
  }

  async pause(guildId: string): Promise<MusicStatusSnapshot> {
    const queue = this.requireQueue(guildId);
    queue.node.pause();
    return this.getStatus(guildId)!;
  }

  async resume(guildId: string): Promise<MusicStatusSnapshot> {
    const queue = this.requireQueue(guildId);
    queue.node.resume();
    return this.getStatus(guildId)!;
  }

  async skip(guildId: string): Promise<MusicStatusSnapshot> {
    const queue = this.requireQueue(guildId);
    queue.node.skip();
    return this.getStatus(guildId) ?? this.emptyStatus();
  }

  async stop(guildId: string): Promise<MusicStatusSnapshot> {
    const queue = this.player?.nodes.get(guildId);
    if (queue) {
      queue.node.stop();
      queue.delete();
    }
    await prisma.musicQueue.updateMany({
      where: { guildId },
      data: { playing: false, paused: false, currentTrack: null, tracks: [] },
    });
    return this.emptyStatus();
  }

  async setVolume(guildId: string, volume: number): Promise<MusicStatusSnapshot> {
    const queue = this.requireQueue(guildId);
    const clamped = Math.max(0, Math.min(100, Math.round(volume)));
    queue.node.setVolume(clamped);
    return this.getStatus(guildId)!;
  }

  async setRepeat(guildId: string, mode: string): Promise<MusicStatusSnapshot> {
    const queue = this.requireQueue(guildId);
    queue.setRepeatMode(toRepeatMode(mode));
    return this.getStatus(guildId)!;
  }

  async shuffle(guildId: string): Promise<MusicStatusSnapshot> {
    const queue = this.requireQueue(guildId);
    queue.tracks.shuffle();
    await this.persistQueue(queue);
    return this.getStatus(guildId)!;
  }

  async clear(guildId: string): Promise<MusicStatusSnapshot> {
    const queue = this.requireQueue(guildId);
    queue.tracks.clear();
    await this.persistQueue(queue);
    return this.getStatus(guildId)!;
  }

  private requireQueue(guildId: string): GuildQueue {
    const queue = this.player?.nodes.get(guildId);
    if (!queue) {
      throw new Error("Nothing is playing in this server.");
    }
    return queue;
  }

  emptyStatus(): MusicStatusSnapshot {
    return {
      playbackEnabled: true,
      isPlaying: false,
      isPaused: false,
      currentTrack: null,
      queue: [],
      volume: 50,
      repeatMode: "OFF",
      shuffleEnabled: false,
      position: 0,
      duration: 0,
      voiceChannelId: null,
      textChannelId: null,
    };
  }
}

export function memberVoiceChannel(member: GuildMember | null): VoiceBasedChannel | null {
  if (!member?.voice.channel) return null;
  if (member.voice.channel.type === ChannelType.GuildVoice || member.voice.channel.type === ChannelType.GuildStageVoice) {
    return member.voice.channel;
  }
  return member.voice.channel;
}
