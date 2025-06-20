import type { MusicActionJob } from "@shared/types/queue";
import type Client from "../../structures/Client.js";
import { BaseProcessor, type ProcessorResult } from "./BaseProcessor.js";

interface QueueInterface {
  isPlaying(): boolean;
  addTrack(track: TrackInterface): void;
  node: {
    play(): Promise<void>;
    pause(): void;
    skip(): void;
    setVolume(volume: number): void;
  };
  currentTrack?: TrackInterface;
  tracks: { size: number };
  delete(): void;
}

interface TrackInterface {
  title: string;
  artist?: string;
  duration?: number;
  url?: string;
}

interface PlayerInterface {
  queues: {
    get(guildId: string): QueueInterface | undefined;
    create(guildId: string, options?: unknown): QueueInterface;
  };
  search(
    query: string,
    options: { requestedBy: string }
  ): Promise<{
    tracks?: TrackInterface[];
  }>;
  play(channel: unknown, query: string, options?: unknown): Promise<{ track?: TrackInterface | null }>;
}

interface MusicResult {
  track?: string;
  queued?: number;
  paused?: boolean;
  skipped?: string;
  next?: string;
  stopped?: boolean;
  volume?: number;
}

export class MusicProcessor extends BaseProcessor<MusicActionJob> {
  constructor(client: Client) {
    super(client, "MusicProcessor");
  }

  getJobTypes(): string[] {
    return ["PLAY_MUSIC", "PAUSE_MUSIC", "SKIP_MUSIC", "STOP_MUSIC", "SET_VOLUME"];
  }

  async processJob(job: MusicActionJob): Promise<ProcessorResult> {
    const { type, query, volume, guildId } = job;

    if (!guildId) {
      return {
        success: false,
        error: "Guild ID is required for music actions",
        timestamp: Date.now(),
      };
    }

    try {
      // Validate the guild exists
      const guild = await this.fetchGuild(guildId);

      // Get the music player
      const { useMainPlayer } = await import("discord-player");
      const player = useMainPlayer() as unknown as PlayerInterface;

      let result: MusicResult;

      switch (type) {
        case "PLAY_MUSIC":
          result = await this.playMusic(player, guild, query, job.userId);
          break;
        case "PAUSE_MUSIC":
          result = this.pauseMusic(player, guildId);
          break;
        case "SKIP_MUSIC":
          result = this.skipMusic(player, guildId);
          break;
        case "STOP_MUSIC":
          result = this.stopMusic(player, guildId);
          break;
        case "SET_VOLUME":
          result = this.setVolume(player, guildId, volume);
          break;
        default:
          return {
            success: false,
            error: `Unknown music action type: ${type}`,
            timestamp: Date.now(),
          };
      }

      return {
        success: true,
        data: {
          type,
          guildId,
          result,
        },
        timestamp: Date.now(),
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Unknown error";
      return {
        success: false,
        error: errorMessage,
        timestamp: Date.now(),
      };
    }
  }

  private async playMusic(
    player: PlayerInterface,
    guild: { id: string },
    query?: string,
    userId?: string
  ): Promise<MusicResult> {
    if (!query) {
      throw new Error("Query is required for playing music");
    }

    if (!userId) {
      throw new Error("User ID is required to resolve voice channel");
    }

    // Fetch member and ensure they are in a voice channel
    const member = await this.client.guilds.fetch(guild.id).then((g) => g.members.fetch(userId));

    const voiceChannel = member.voice.channel;
    if (!voiceChannel) {
      throw new Error("You need to join a voice channel first");
    }

    // Use the high-level play helper – this automatically creates/uses the queue and starts playback
    const { track } = (await player.play(voiceChannel as unknown, query, {
      requestedBy: member.user,
      nodeOptions: {
        // Provide minimal metadata so event handlers can safely short-circuit
        metadata: {
          requestedBy: member.user,
        },
      },
    })) as { track: TrackInterface | null };

    // Access the active queue to gather stats
    const queue = player.queues.get(guild.id);

    return {
      track: track?.title ?? "Unknown",
      queued: queue ? queue.tracks.size : 1,
    };
  }

  private pauseMusic(player: PlayerInterface, guildId: string): MusicResult {
    const queue = player.queues.get(guildId);
    if (!queue) {
      throw new Error("No music queue found for this guild");
    }

    if (!queue.isPlaying()) {
      throw new Error("No music is currently playing");
    }

    queue.node.pause();
    return { paused: true };
  }

  private skipMusic(player: PlayerInterface, guildId: string): MusicResult {
    const queue = player.queues.get(guildId);
    if (!queue) {
      throw new Error("No music queue found for this guild");
    }

    if (!queue.isPlaying()) {
      throw new Error("No music is currently playing");
    }

    const currentTrack = queue.currentTrack;
    queue.node.skip();

    return {
      skipped: currentTrack ? currentTrack.title : "Unknown track",
      next: queue.currentTrack ? queue.currentTrack.title : "Queue empty",
    };
  }

  private stopMusic(player: PlayerInterface, guildId: string): MusicResult {
    const queue = player.queues.get(guildId);
    if (!queue) {
      throw new Error("No music queue found for this guild");
    }

    queue.delete();
    return { stopped: true };
  }

  private setVolume(player: PlayerInterface, guildId: string, volume?: number): MusicResult {
    const queue = player.queues.get(guildId);
    if (!queue) {
      throw new Error("No music queue found for this guild");
    }

    if (volume === undefined || volume < 0 || volume > 100) {
      throw new Error("Volume must be between 0 and 100");
    }

    queue.node.setVolume(volume);
    return { volume };
  }

  protected getEventPrefix(): string {
    return "MUSIC";
  }

  protected getAdditionalEventData(job: MusicActionJob): Record<string, unknown> {
    return {
      ...super.getAdditionalEventData(job),
      musicAction: job.type,
      query: job.query,
      volume: job.volume,
    };
  }
}
