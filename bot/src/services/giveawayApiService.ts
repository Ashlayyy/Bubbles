import { apiClient, type ApiResponse, type PaginatedResponse } from "./apiClient.js";

export interface GiveawayData {
  id: string;
  title: string;
  prize: string;
  description?: string;
  requirements?: string;
  winnerCount: number;
  entryCount: number;
  status: "active" | "ended" | "cancelled";
  endTime: string;
  createdAt: string;
  updatedAt: string;
  createdBy: string;
  guildId: string;
  entries?: GiveawayEntry[];
  winners?: GiveawayWinner[];
}

export interface GiveawayEntry {
  id: string;
  userId: string;
  username: string;
  giveawayId: string;
  enteredAt: string;
}

export interface GiveawayWinner {
  id: string;
  userId: string;
  username: string;
  giveawayId: string;
  selectedAt: string;
}

export interface CreateGiveawayRequest {
  title: string;
  prize: string;
  winnerCount: number;
  description?: string;
  requirements?: string;
  endTime: string;
}

export interface EnterGiveawayRequest {
  userId: string;
  username: string;
}

export interface GiveawayListOptions {
  page?: number;
  limit?: number;
  status?: "all" | "active" | "ended";
  createdBy?: string;
}

export interface RerollGiveawayRequest {
  winnerCount?: number;
}

/**
 * Giveaway API Service
 * Provides typed methods for all giveaway-related API operations
 */
class GiveawayApiService {
  private readonly basePath = "/api/giveaways";

  /**
   * Create a new giveaway
   */
  async createGiveaway(guildId: string, data: CreateGiveawayRequest): Promise<ApiResponse<GiveawayData>> {
    return await apiClient.post<ApiResponse<GiveawayData>>(`${this.basePath}/${guildId}`, data);
  }

  /**
   * Get a specific giveaway by ID
   */
  async getGiveaway(guildId: string, giveawayId: string): Promise<ApiResponse<GiveawayData>> {
    return await apiClient.get<ApiResponse<GiveawayData>>(`${this.basePath}/${guildId}/${giveawayId}`);
  }

  /**
   * List giveaways for a guild
   */
  async listGiveaways(guildId: string, options: GiveawayListOptions = {}): Promise<PaginatedResponse<GiveawayData[]>> {
    const params = {
      page: options.page?.toString() || "1",
      limit: options.limit?.toString() || "10",
      status: options.status || "all",
      ...(options.createdBy && { createdBy: options.createdBy }),
    };

    return await apiClient.get<PaginatedResponse<GiveawayData[]>>(`${this.basePath}/${guildId}`, params);
  }

  /**
   * Enter a giveaway
   */
  async enterGiveaway(
    guildId: string,
    giveawayId: string,
    data: EnterGiveawayRequest
  ): Promise<ApiResponse<GiveawayData>> {
    return await apiClient.post<ApiResponse<GiveawayData>>(`${this.basePath}/${guildId}/${giveawayId}/enter`, data);
  }

  /**
   * Get giveaway entries
   */
  async getGiveawayEntries(
    guildId: string,
    giveawayId: string,
    page = 1,
    limit = 50
  ): Promise<PaginatedResponse<GiveawayEntry[]>> {
    const params = {
      page: page.toString(),
      limit: limit.toString(),
    };

    return await apiClient.get<PaginatedResponse<GiveawayEntry[]>>(
      `${this.basePath}/${guildId}/${giveawayId}/entries`,
      params
    );
  }

  /**
   * End a giveaway early
   */
  async endGiveaway(guildId: string, giveawayId: string): Promise<ApiResponse<GiveawayData>> {
    return await apiClient.post<ApiResponse<GiveawayData>>(`${this.basePath}/${guildId}/${giveawayId}/end`);
  }

  /**
   * Reroll giveaway winners
   */
  async rerollGiveaway(
    guildId: string,
    giveawayId: string,
    data?: RerollGiveawayRequest
  ): Promise<ApiResponse<GiveawayData>> {
    return await apiClient.post<ApiResponse<GiveawayData>>(`${this.basePath}/${guildId}/${giveawayId}/reroll`, data);
  }

  /**
   * Delete a giveaway
   */
  async deleteGiveaway(guildId: string, giveawayId: string): Promise<ApiResponse<void>> {
    return await apiClient.delete<ApiResponse<void>>(`${this.basePath}/${guildId}/${giveawayId}`);
  }

  /**
   * Check if API client is configured
   */
  isConfigured(): boolean {
    return apiClient.isConfigured();
  }
}

// Export a singleton instance
export const giveawayApiService = new GiveawayApiService();

// Also export the class for testing
export { GiveawayApiService };
