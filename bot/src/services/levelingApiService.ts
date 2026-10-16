import { apiClient, type ApiResponse } from "./apiClient.js";

export interface LevelingUser {
  id: string;
  userId: string;
  guildId: string;
  level: number;
  xp: number;
  totalXp: number;
  rank: number;
  lastXpGain: string;
  multiplier: number;
  isIgnored: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface LevelingSettings {
  id: string;
  guildId: string;
  enabled: boolean;
  xpRate: number;
  levelUpChannel?: string;
  levelUpMessage?: string;
  announceLevelUp: boolean;
  ignoredChannels: string[];
  ignoredRoles: string[];
  xpCooldown: number;
  minMessageLength: number;
  maxXpPerMessage: number;
  minXpPerMessage: number;
  stackedRoles: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface LevelingReward {
  id: string;
  guildId: string;
  level: number;
  roleId: string;
  roleName: string;
  removeOthers: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface LevelingLeaderboard {
  users: LevelingUser[];
  pagination: {
    page: number;
    pages: number;
    total: number;
    limit: number;
  };
}

export interface UpdateUserXpRequest {
  amount: number;
  reason?: string;
}

export interface BulkUpdateRequest {
  userIds: string[];
  operation: "add" | "subtract" | "set";
  amount: number;
  reason?: string;
}

export interface CreateRewardRequest {
  level: number;
  roleId: string;
  removeOthers?: boolean;
}

export interface UpdateSettingsRequest {
  enabled?: boolean;
  xpRate?: number;
  levelUpChannel?: string;
  levelUpMessage?: string;
  announceLevelUp?: boolean;
  ignoredChannels?: string[];
  ignoredRoles?: string[];
  xpCooldown?: number;
  minMessageLength?: number;
  maxXpPerMessage?: number;
  minXpPerMessage?: number;
  stackedRoles?: boolean;
}

/**
 * Leveling API Service
 * Provides typed methods for all leveling-related API operations
 */
class LevelingApiService {
  private readonly basePath = "/api/leveling";

  /**
   * Get user's leveling data
   */
  async getUserData(guildId: string, userId: string): Promise<ApiResponse<LevelingUser>> {
    return await apiClient.get<ApiResponse<LevelingUser>>(`${this.basePath}/${guildId}/users/${userId}`);
  }

  /**
   * Get leaderboard for a guild
   */
  async getLeaderboard(guildId: string, page = 1, limit = 10): Promise<ApiResponse<LevelingLeaderboard>> {
    const params = {
      page: page.toString(),
      limit: limit.toString(),
    };
    return await apiClient.get<ApiResponse<LevelingLeaderboard>>(`${this.basePath}/${guildId}/leaderboard`, params);
  }

  /**
   * Update user's XP
   */
  async updateUserXp(guildId: string, userId: string, data: UpdateUserXpRequest): Promise<ApiResponse<LevelingUser>> {
    return await apiClient.patch<ApiResponse<LevelingUser>>(`${this.basePath}/${guildId}/users/${userId}`, data);
  }

  /**
   * Set user's XP to a specific amount
   */
  async setUserXp(guildId: string, userId: string, xp: number, reason?: string): Promise<ApiResponse<LevelingUser>> {
    return await apiClient.put<ApiResponse<LevelingUser>>(`${this.basePath}/${guildId}/users/${userId}`, {
      xp,
      reason,
    });
  }

  /**
   * Set user's level
   */
  async setUserLevel(
    guildId: string,
    userId: string,
    level: number,
    reason?: string
  ): Promise<ApiResponse<LevelingUser>> {
    return await apiClient.put<ApiResponse<LevelingUser>>(`${this.basePath}/${guildId}/users/${userId}/level`, {
      level,
      reason,
    });
  }

  /**
   * Reset user's XP
   */
  async resetUserXp(guildId: string, userId: string, reason?: string): Promise<ApiResponse<LevelingUser>> {
    return await apiClient.delete<ApiResponse<LevelingUser>>(
      `${this.basePath}/${guildId}/users/${userId}?reason=${encodeURIComponent(reason || "")}`
    );
  }

  /**
   * Bulk update users' XP
   */
  async bulkUpdateXp(
    guildId: string,
    data: BulkUpdateRequest
  ): Promise<ApiResponse<{ processed: number; failed: number }>> {
    return await apiClient.post<ApiResponse<{ processed: number; failed: number }>>(
      `${this.basePath}/${guildId}/bulk`,
      data
    );
  }

  /**
   * Reset all users' XP in a guild
   */
  async resetAllXp(guildId: string, reason?: string): Promise<ApiResponse<{ reset: number }>> {
    return await apiClient.delete<ApiResponse<{ reset: number }>>(
      `${this.basePath}/${guildId}/reset?reason=${encodeURIComponent(reason || "")}`
    );
  }

  /**
   * Get leveling settings for a guild
   */
  async getSettings(guildId: string): Promise<ApiResponse<LevelingSettings>> {
    return await apiClient.get<ApiResponse<LevelingSettings>>(`${this.basePath}/${guildId}/settings`);
  }

  /**
   * Update leveling settings
   */
  async updateSettings(guildId: string, data: UpdateSettingsRequest): Promise<ApiResponse<LevelingSettings>> {
    return await apiClient.patch<ApiResponse<LevelingSettings>>(`${this.basePath}/${guildId}/settings`, data);
  }

  /**
   * Get level rewards for a guild
   */
  async getRewards(guildId: string): Promise<ApiResponse<LevelingReward[]>> {
    return await apiClient.get<ApiResponse<LevelingReward[]>>(`${this.basePath}/${guildId}/rewards`);
  }

  /**
   * Create a new level reward
   */
  async createReward(guildId: string, data: CreateRewardRequest): Promise<ApiResponse<LevelingReward>> {
    return await apiClient.post<ApiResponse<LevelingReward>>(`${this.basePath}/${guildId}/rewards`, data);
  }

  /**
   * Delete a level reward
   */
  async deleteReward(guildId: string, rewardId: string): Promise<ApiResponse<void>> {
    return await apiClient.delete<ApiResponse<void>>(`${this.basePath}/${guildId}/rewards/${rewardId}`);
  }

  /**
   * Check if API client is configured
   */
  isConfigured(): boolean {
    return apiClient.isConfigured();
  }
}

// Export a singleton instance
export const levelingApiService = new LevelingApiService();

// Also export the class for testing
export { LevelingApiService };
