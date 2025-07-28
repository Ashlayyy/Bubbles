import { apiClient, type ApiResponse } from "./apiClient.js";

export interface MusicStatus {
  isPlaying: boolean;
  isPaused: boolean;
  isConnected: boolean;
  volume: number;
  currentTrack?: Track;
  queue: Track[];
  position: number;
  duration: number;
  voiceChannelId?: string;
  textChannelId?: string;
  loopMode: "none" | "track" | "queue";
  shuffle: boolean;
}

export interface Track {
  id: string;
  title: string;
  artist: string;
  url: string;
  duration: number;
  thumbnail?: string;
  requestedBy: string;
  requestedAt: string;
  platform: "youtube" | "spotify" | "soundcloud" | "url";
}

export interface PlayRequest {
  query: string;
  userId: string;
  username: string;
  voiceChannelId: string;
  textChannelId: string;
  platform?: "youtube" | "spotify" | "soundcloud";
  playNext?: boolean;
}

export interface QueueResponse {
  tracks: Track[];
  currentTrack?: Track;
  totalDuration: number;
  totalTracks: number;
  isPlaying: boolean;
  isPaused: boolean;
}

export interface VolumeRequest {
  volume: number;
  userId: string;
}

export interface SeekRequest {
  position: number;
  userId: string;
}

export interface LoopRequest {
  mode: "none" | "track" | "queue";
  userId: string;
}

export interface ShuffleRequest {
  enable: boolean;
  userId: string;
}

/**
 * Music API Service
 * Provides typed methods for all music-related API operations
 */
class MusicApiService {
  private readonly basePath = "/api/music";

  /**
   * Play a track or playlist
   */
  async play(guildId: string, data: PlayRequest): Promise<ApiResponse<{ track: Track; position: number }>> {
    return await apiClient.post<ApiResponse<{ track: Track; position: number }>>(
      `${this.basePath}/${guildId}/play`,
      data
    );
  }

  /**
   * Pause the current track
   */
  async pause(guildId: string, userId: string): Promise<ApiResponse<MusicStatus>> {
    return await apiClient.post<ApiResponse<MusicStatus>>(`${this.basePath}/${guildId}/pause`, { userId });
  }

  /**
   * Resume the current track
   */
  async resume(guildId: string, userId: string): Promise<ApiResponse<MusicStatus>> {
    return await apiClient.post<ApiResponse<MusicStatus>>(`${this.basePath}/${guildId}/resume`, { userId });
  }

  /**
   * Stop playback and clear queue
   */
  async stop(guildId: string, userId: string): Promise<ApiResponse<{ stopped: boolean }>> {
    return await apiClient.post<ApiResponse<{ stopped: boolean }>>(`${this.basePath}/${guildId}/stop`, { userId });
  }

  /**
   * Skip to the next track
   */
  async skip(guildId: string, userId: string): Promise<ApiResponse<{ skipped: Track; next?: Track }>> {
    return await apiClient.post<ApiResponse<{ skipped: Track; next?: Track }>>(`${this.basePath}/${guildId}/skip`, {
      userId,
    });
  }

  /**
   * Go back to the previous track
   */
  async previous(guildId: string, userId: string): Promise<ApiResponse<{ previous: Track; current: Track }>> {
    return await apiClient.post<ApiResponse<{ previous: Track; current: Track }>>(
      `${this.basePath}/${guildId}/previous`,
      { userId }
    );
  }

  /**
   * Get the current queue
   */
  async getQueue(guildId: string): Promise<ApiResponse<QueueResponse>> {
    return await apiClient.get<ApiResponse<QueueResponse>>(`${this.basePath}/${guildId}/queue`);
  }

  /**
   * Get the current music status
   */
  async getStatus(guildId: string): Promise<ApiResponse<MusicStatus>> {
    return await apiClient.get<ApiResponse<MusicStatus>>(`${this.basePath}/${guildId}/status`);
  }

  /**
   * Clear the entire queue
   */
  async clearQueue(guildId: string, userId: string): Promise<ApiResponse<{ cleared: number }>> {
    return await apiClient.delete<ApiResponse<{ cleared: number }>>(
      `${this.basePath}/${guildId}/queue?userId=${userId}`
    );
  }

  /**
   * Remove a specific track from the queue
   */
  async removeTrack(guildId: string, trackId: string, userId: string): Promise<ApiResponse<{ removed: Track }>> {
    return await apiClient.delete<ApiResponse<{ removed: Track }>>(
      `${this.basePath}/${guildId}/queue/${trackId}?userId=${userId}`
    );
  }

  /**
   * Shuffle the queue
   */
  async shuffle(guildId: string, data: ShuffleRequest): Promise<ApiResponse<{ shuffled: boolean; queue: Track[] }>> {
    return await apiClient.post<ApiResponse<{ shuffled: boolean; queue: Track[] }>>(
      `${this.basePath}/${guildId}/shuffle`,
      data
    );
  }

  /**
   * Set loop mode
   */
  async setLoop(guildId: string, data: LoopRequest): Promise<ApiResponse<{ loopMode: string }>> {
    return await apiClient.post<ApiResponse<{ loopMode: string }>>(`${this.basePath}/${guildId}/loop`, data);
  }

  /**
   * Set volume
   */
  async setVolume(guildId: string, data: VolumeRequest): Promise<ApiResponse<{ volume: number }>> {
    return await apiClient.post<ApiResponse<{ volume: number }>>(`${this.basePath}/${guildId}/volume`, data);
  }

  /**
   * Seek to a position in the current track
   */
  async seek(guildId: string, data: SeekRequest): Promise<ApiResponse<{ position: number }>> {
    return await apiClient.post<ApiResponse<{ position: number }>>(`${this.basePath}/${guildId}/seek`, data);
  }

  /**
   * Jump to a specific track in the queue
   */
  async jumpTo(
    guildId: string,
    trackIndex: number,
    userId: string
  ): Promise<ApiResponse<{ jumped: Track; previous: Track }>> {
    return await apiClient.post<ApiResponse<{ jumped: Track; previous: Track }>>(`${this.basePath}/${guildId}/jump`, {
      index: trackIndex,
      userId,
    });
  }

  /**
   * Move a track to a different position in the queue
   */
  async moveTrack(
    guildId: string,
    fromIndex: number,
    toIndex: number,
    userId: string
  ): Promise<ApiResponse<{ moved: Track; queue: Track[] }>> {
    return await apiClient.post<ApiResponse<{ moved: Track; queue: Track[] }>>(`${this.basePath}/${guildId}/move`, {
      from: fromIndex,
      to: toIndex,
      userId,
    });
  }

  /**
   * Get music history for the guild
   */
  async getHistory(
    guildId: string,
    page = 1,
    limit = 20
  ): Promise<
    ApiResponse<{
      tracks: Track[];
      pagination: {
        page: number;
        pages: number;
        total: number;
        limit: number;
      };
    }>
  > {
    const params = {
      page: page.toString(),
      limit: limit.toString(),
    };
    return await apiClient.get<
      ApiResponse<{
        tracks: Track[];
        pagination: {
          page: number;
          pages: number;
          total: number;
          limit: number;
        };
      }>
    >(`${this.basePath}/${guildId}/history`, params);
  }

  /**
   * Get music statistics for the guild
   */
  async getStats(guildId: string): Promise<
    ApiResponse<{
      totalTracks: number;
      totalDuration: number;
      topPlatforms: { platform: string; count: number }[];
      topRequesters: { userId: string; username: string; count: number }[];
      mostPlayed: Track[];
    }>
  > {
    return await apiClient.get<
      ApiResponse<{
        totalTracks: number;
        totalDuration: number;
        topPlatforms: { platform: string; count: number }[];
        topRequesters: { userId: string; username: string; count: number }[];
        mostPlayed: Track[];
      }>
    >(`${this.basePath}/${guildId}/stats`);
  }

  /**
   * Check if API client is configured
   */
  isConfigured(): boolean {
    return apiClient.isConfigured();
  }
}

// Export a singleton instance
export const musicApiService = new MusicApiService();

// Also export the class for testing
export { MusicApiService };
