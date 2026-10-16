import {
  AudioPlayer,
  AudioPlayerStatus,
  AudioResource,
  VoiceConnection,
  VoiceConnectionStatus,
  createAudioPlayer,
  createAudioResource,
  entersState,
  getVoiceConnection,
  joinVoiceChannel,
} from "@discordjs/voice";
import { RedisConnectionFactory } from "@shared/utils/RedisConnectionFactory";
import type { GuildMember } from "discord.js";
import type { Redis } from "ioredis";
import { YouTube } from "youtube-sr";
import ytdl from "ytdl-core";

import logger from "../logger.js";

// Types
export interface Track {
  id: string;
  title: string;
  artist: string;
  url: string;
  duration: number;
  thumbnail?: string;
  requestedBy: string;
  requestedAt: string;
  platform: "youtube" | "soundcloud" | "direct";
  streamUrl?: string;
}

export interface SearchResult {
  id: string;
  title: string;
  artist: string;
  url: string;
  duration: number;
  thumbnail?: string;
  platform: "youtube" | "soundcloud" | "direct";
}

export interface MusicQueue {
  guildId: string;
  tracks: Track[];
  currentIndex: number;
  isPlaying: boolean;
  isPaused: boolean;
  volume: number;
  loopMode: "none" | "track" | "queue";
  shuffled: boolean;
  voiceChannelId?: string;
  textChannelId?: string;
}

export interface PlaybackStatus {
  isPlaying: boolean;
  isPaused: boolean;
  isConnected: boolean;
  currentTrack?: Track;
  queue: Track[];
  position: number;
  volume: number;
  loopMode: "none" | "track" | "queue";
  shuffled: boolean;
}

class MusicService {
  private get redis(): Redis {
    return RedisConnectionFactory.getSharedConnection();
  }

  private audioPlayers = new Map<string, AudioPlayer>();
  private voiceConnections = new Map<string, VoiceConnection>();
  private queues = new Map<string, MusicQueue>();
  private currentResources = new Map<string, AudioResource>();

  constructor() {
    logger.info("MusicService: Initialized with API-key-free YouTube support using shared Redis connection");
  }

  /**
   * Search for tracks using API-key-free methods (YouTube only)
   */
  async search(query: string, limit = 10): Promise<SearchResult[]> {
    const results: SearchResult[] = [];

    try {
      // Search YouTube using youtube-sr (no API key required)
      const youtubeResults = await YouTube.search(query, {
        limit: limit,
        type: "video",
      });

      for (const video of youtubeResults) {
        if (video.url && video.title) {
          results.push({
            id: video.id || "",
            title: video.title,
            artist: video.channel?.name || "Unknown Artist",
            url: video.url,
            duration: video.duration ? video.duration * 1000 : 0, // Convert to milliseconds
            thumbnail: video.thumbnail?.url,
            platform: "youtube",
          });
        }
      }

      return results.slice(0, limit);
    } catch (error) {
      logger.error("Search failed:", error);
      throw new Error("Failed to search for tracks");
    }
  }

  /**
   * Get detailed track info from URL
   */
  async getTrackInfo(url: string): Promise<Track | null> {
    try {
      // Check if it's a YouTube URL
      if (ytdl.validateURL(url)) {
        const info = await ytdl.getInfo(url);
        const videoDetails = info.videoDetails;

        return {
          id: videoDetails.videoId,
          title: videoDetails.title,
          artist: videoDetails.author.name,
          url: videoDetails.video_url,
          duration: parseInt(videoDetails.lengthSeconds) * 1000,
          thumbnail: videoDetails.thumbnails?.[0]?.url,
          requestedBy: "",
          requestedAt: new Date().toISOString(),
          platform: "youtube",
        };
      }

      // Check if it's a SoundCloud URL (basic check)
      if (url.includes("soundcloud.com")) {
        // For SoundCloud, we'll need to return basic info since we don't have API access
        const urlParts = url.split("/");
        const title = urlParts[urlParts.length - 1].replace(/-/g, " ");

        return {
          id: Math.random().toString(36).substring(7),
          title: title || "SoundCloud Track",
          artist: "SoundCloud Artist",
          url: url,
          duration: 180000, // Default 3 minutes
          thumbnail: undefined,
          requestedBy: "",
          requestedAt: new Date().toISOString(),
          platform: "soundcloud",
        };
      }

      // Check if it's a direct audio file URL
      if (this.isDirectAudioUrl(url)) {
        const filename = url.split("/").pop() || "Unknown Track";
        return {
          id: Math.random().toString(36).substring(7),
          title: filename.replace(/\.[^/.]+$/, ""), // Remove extension
          artist: "Direct File",
          url: url,
          duration: 180000, // Default 3 minutes
          thumbnail: undefined,
          requestedBy: "",
          requestedAt: new Date().toISOString(),
          platform: "direct",
        };
      }

      return null;
    } catch (error) {
      logger.error("Failed to get track info:", error);
      return null;
    }
  }

  /**
   * Join voice channel
   */
  async joinVoice(member: GuildMember): Promise<VoiceConnection> {
    const voiceChannel = member.voice.channel;
    if (!voiceChannel) {
      throw new Error("User is not in a voice channel");
    }

    const guildId = member.guild.id;
    let connection = getVoiceConnection(guildId);

    if (!connection) {
      connection = joinVoiceChannel({
        channelId: voiceChannel.id,
        guildId: guildId,
        adapterCreator: member.guild.voiceAdapterCreator,
      });

      this.voiceConnections.set(guildId, connection);

      // Set up event handlers
      connection.on(VoiceConnectionStatus.Ready, () => {
        logger.info(`Music: Connected to voice channel in guild ${guildId}`);
      });

      connection.on(VoiceConnectionStatus.Disconnected, () => {
        logger.info(`Music: Disconnected from voice channel in guild ${guildId}`);
        this.cleanup(guildId);
      });

      // Create audio player if it doesn't exist
      if (!this.audioPlayers.has(guildId)) {
        const player = createAudioPlayer();
        this.audioPlayers.set(guildId, player);
        connection.subscribe(player);

        // Set up player event handlers
        player.on(AudioPlayerStatus.Idle, () => {
          this.handleTrackEnd(guildId);
        });

        player.on("error", (error) => {
          logger.error(`Audio player error in guild ${guildId}:`, error);
          this.handleTrackEnd(guildId);
        });
      }
    }

    // Wait for connection to be ready
    try {
      await entersState(connection, VoiceConnectionStatus.Ready, 30000);
      return connection;
    } catch (error) {
      connection.destroy();
      throw new Error("Failed to connect to voice channel within 30 seconds");
    }
  }

  /**
   * Add track to queue
   */
  async addToQueue(guildId: string, track: Track, userId: string, username: string): Promise<number> {
    track.requestedBy = userId;
    track.requestedAt = new Date().toISOString();

    let queue = await this.getQueue(guildId);
    if (!queue) {
      queue = {
        guildId,
        tracks: [],
        currentIndex: -1,
        isPlaying: false,
        isPaused: false,
        volume: 50,
        loopMode: "none",
        shuffled: false,
      };
    }

    queue.tracks.push(track);
    await this.saveQueue(queue);

    // If nothing is playing, start playing
    if (!queue.isPlaying && queue.currentIndex === -1) {
      queue.currentIndex = 0;
      await this.saveQueue(queue);
      await this.playCurrentTrack(guildId);
    }

    return queue.tracks.length;
  }

  /**
   * Play current track using API-key-free methods
   */
  private async playCurrentTrack(guildId: string): Promise<void> {
    const queue = await this.getQueue(guildId);
    if (!queue || queue.currentIndex === -1 || queue.currentIndex >= queue.tracks.length) {
      return;
    }

    const track = queue.tracks[queue.currentIndex];
    const player = this.audioPlayers.get(guildId);
    if (!player) {
      throw new Error("No audio player found for guild");
    }

    try {
      let stream;

      if (track.platform === "youtube") {
        // Use ytdl-core for YouTube (no API key required)
        stream = ytdl(track.url, {
          filter: "audioonly",
          quality: "highestaudio",
          highWaterMark: 1 << 25, // 32MB buffer
        });
      } else {
        // For non-YouTube platforms, we can't stream without additional setup
        throw new Error(`Streaming for ${track.platform} requires additional configuration`);
      }

      const resource = createAudioResource(stream, {
        inlineVolume: true,
      });

      // Set volume
      if (resource.volume) {
        resource.volume.setVolume(queue.volume / 100);
      }

      this.currentResources.set(guildId, resource);
      player.play(resource);

      // Update queue status
      queue.isPlaying = true;
      queue.isPaused = false;
      await this.saveQueue(queue);

      logger.info(`Now playing: ${track.title} by ${track.artist} in guild ${guildId}`);
    } catch (error) {
      logger.error(`Failed to play track in guild ${guildId}:`, error);
      // Skip to next track
      await this.skip(guildId);
    }
  }

  /**
   * Handle track end
   */
  private async handleTrackEnd(guildId: string): Promise<void> {
    const queue = await this.getQueue(guildId);
    if (!queue) return;

    // Handle loop modes
    if (queue.loopMode === "track") {
      // Replay current track
      await this.playCurrentTrack(guildId);
      return;
    }

    // Move to next track
    queue.currentIndex++;

    // Handle queue loop
    if (queue.loopMode === "queue" && queue.currentIndex >= queue.tracks.length) {
      queue.currentIndex = 0;
    }

    // Check if queue is finished
    if (queue.currentIndex >= queue.tracks.length) {
      queue.isPlaying = false;
      queue.currentIndex = -1;
      await this.saveQueue(queue);
      return;
    }

    await this.saveQueue(queue);
    await this.playCurrentTrack(guildId);
  }

  /**
   * Pause playback (smart toggle)
   */
  async pause(guildId: string): Promise<boolean> {
    const player = this.audioPlayers.get(guildId);
    const queue = await this.getQueue(guildId);

    if (!player || !queue) {
      return false;
    }

    if (queue.isPaused) {
      // Resume if already paused (smart toggle)
      player.unpause();
      queue.isPaused = false;
      await this.saveQueue(queue);
      return false; // Returning false means we resumed
    } else {
      // Pause if playing
      player.pause();
      queue.isPaused = true;
      await this.saveQueue(queue);
      return true; // Returning true means we paused
    }
  }

  /**
   * Resume playback
   */
  async resume(guildId: string): Promise<boolean> {
    const player = this.audioPlayers.get(guildId);
    const queue = await this.getQueue(guildId);

    if (!player || !queue || !queue.isPaused) {
      return false;
    }

    player.unpause();
    queue.isPaused = false;
    await this.saveQueue(queue);
    return true;
  }

  /**
   * Skip to next track
   */
  async skip(guildId: string): Promise<Track | null> {
    const queue = await this.getQueue(guildId);
    if (!queue || queue.currentIndex === -1) {
      return null;
    }

    const currentTrack = queue.tracks[queue.currentIndex];

    // Stop current playback
    const player = this.audioPlayers.get(guildId);
    if (player) {
      player.stop();
    }

    return currentTrack;
  }

  /**
   * Stop playback and leave voice channel
   */
  async stop(guildId: string): Promise<void> {
    const connection = this.voiceConnections.get(guildId);
    const player = this.audioPlayers.get(guildId);

    if (player) {
      player.stop();
    }

    if (connection) {
      connection.destroy();
    }

    // Clear queue
    await this.redis.del(`queue:${guildId}`);
    this.cleanup(guildId);
  }

  /**
   * Get queue for guild
   */
  async getQueue(guildId: string): Promise<MusicQueue | null> {
    try {
      const cached = this.queues.get(guildId);
      if (cached) {
        return cached;
      }

      const data = await this.redis.get(`queue:${guildId}`);
      if (data) {
        const queue = JSON.parse(data) as MusicQueue;
        this.queues.set(guildId, queue);
        return queue;
      }

      return null;
    } catch (error) {
      logger.error("Failed to get queue:", error);
      return null;
    }
  }

  /**
   * Save queue to Redis
   */
  private async saveQueue(queue: MusicQueue): Promise<void> {
    try {
      this.queues.set(queue.guildId, queue);
      await this.redis.set(`queue:${queue.guildId}`, JSON.stringify(queue), "EX", 86400); // 24 hours TTL
    } catch (error) {
      logger.error("Failed to save queue:", error);
    }
  }

  /**
   * Get current playback status
   */
  async getStatus(guildId: string): Promise<PlaybackStatus | null> {
    const queue = await this.getQueue(guildId);
    const connection = this.voiceConnections.get(guildId);

    if (!queue) {
      return null;
    }

    const currentTrack = queue.currentIndex >= 0 ? queue.tracks[queue.currentIndex] : undefined;

    return {
      isPlaying: queue.isPlaying,
      isPaused: queue.isPaused,
      isConnected: !!connection && connection.state.status === VoiceConnectionStatus.Ready,
      currentTrack,
      queue: queue.tracks,
      position: queue.currentIndex,
      volume: queue.volume,
      loopMode: queue.loopMode,
      shuffled: queue.shuffled,
    };
  }

  /**
   * Set volume
   */
  async setVolume(guildId: string, volume: number): Promise<boolean> {
    if (volume < 0 || volume > 100) {
      return false;
    }

    const queue = await this.getQueue(guildId);
    if (!queue) {
      return false;
    }

    queue.volume = volume;
    await this.saveQueue(queue);

    // Apply to current resource
    const resource = this.currentResources.get(guildId);
    if (resource && resource.volume) {
      resource.volume.setVolume(volume / 100);
    }

    return true;
  }

  /**
   * Set loop mode
   */
  async setLoopMode(guildId: string, mode: "none" | "track" | "queue"): Promise<boolean> {
    const queue = await this.getQueue(guildId);
    if (!queue) {
      return false;
    }

    queue.loopMode = mode;
    await this.saveQueue(queue);
    return true;
  }

  /**
   * Shuffle queue
   */
  async shuffle(guildId: string): Promise<boolean> {
    const queue = await this.getQueue(guildId);
    if (!queue || queue.tracks.length <= 1) {
      return false;
    }

    // Save current track
    const currentTrack = queue.currentIndex >= 0 ? queue.tracks[queue.currentIndex] : null;

    // Remove current track temporarily
    if (currentTrack && queue.currentIndex >= 0) {
      queue.tracks.splice(queue.currentIndex, 1);
    }

    // Shuffle remaining tracks
    for (let i = queue.tracks.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [queue.tracks[i], queue.tracks[j]] = [queue.tracks[j], queue.tracks[i]];
    }

    // Put current track back at the beginning
    if (currentTrack) {
      queue.tracks.unshift(currentTrack);
      queue.currentIndex = 0;
    }

    queue.shuffled = !queue.shuffled;
    await this.saveQueue(queue);
    return true;
  }

  /**
   * Remove track from queue
   */
  async removeTrack(guildId: string, position: number): Promise<Track | null> {
    const queue = await this.getQueue(guildId);
    if (!queue || position < 0 || position >= queue.tracks.length) {
      return null;
    }

    const removedTrack = queue.tracks.splice(position, 1)[0];

    // Adjust current index if necessary
    if (position < queue.currentIndex) {
      queue.currentIndex--;
    } else if (position === queue.currentIndex) {
      // If we removed the currently playing track, skip to next
      const player = this.audioPlayers.get(guildId);
      if (player) {
        player.stop();
      }
    }

    await this.saveQueue(queue);
    return removedTrack;
  }

  /**
   * Clear entire queue
   */
  async clearQueue(guildId: string): Promise<number> {
    const queue = await this.getQueue(guildId);
    if (!queue) {
      return 0;
    }

    const trackCount = queue.tracks.length;
    queue.tracks = [];
    queue.currentIndex = -1;
    queue.isPlaying = false;

    // Stop current playback
    const player = this.audioPlayers.get(guildId);
    if (player) {
      player.stop();
    }

    await this.saveQueue(queue);
    return trackCount;
  }

  /**
   * Helper methods
   */
  private isDirectAudioUrl(url: string): boolean {
    const audioExtensions = [".mp3", ".wav", ".ogg", ".m4a", ".aac", ".flac"];
    return audioExtensions.some((ext) => url.toLowerCase().includes(ext));
  }

  /**
   * Cleanup resources for a guild
   */
  private cleanup(guildId: string): void {
    this.voiceConnections.delete(guildId);
    this.audioPlayers.delete(guildId);
    this.queues.delete(guildId);
    this.currentResources.delete(guildId);
  }

  /**
   * Check if service is available
   */
  isAvailable(): boolean {
    return true; // Always available since it's local and API-key-free
  }
}

// Export singleton instance
export const musicService = new MusicService();
