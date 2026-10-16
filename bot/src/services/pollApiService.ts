import { apiClient, type ApiResponse, type PaginatedResponse } from "./apiClient.js";

export interface PollData {
  id: string;
  question: string;
  description?: string;
  options: PollOption[];
  allowMultipleVotes: boolean;
  anonymousVotes: boolean;
  endTime?: string;
  status: "active" | "ended" | "cancelled";
  totalVotes: number;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
  guildId: string;
  channelId: string;
  messageId?: string;
}

export interface PollOption {
  id: string;
  text: string;
  emoji?: string;
  votes: number;
  voters: string[];
}

export interface PollVote {
  id: string;
  userId: string;
  username: string;
  pollId: string;
  optionId: string;
  votedAt: string;
  isAnonymous: boolean;
}

export interface CreatePollRequest {
  question: string;
  description?: string;
  options: CreatePollOption[];
  allowMultipleVotes?: boolean;
  anonymousVotes?: boolean;
  duration?: number; // in minutes
  channelId: string;
}

export interface CreatePollOption {
  text: string;
  emoji?: string;
}

export interface VotePollRequest {
  optionIds: string[];
  userId: string;
  username: string;
}

export interface PollListOptions {
  page?: number;
  limit?: number;
  status?: "all" | "active" | "ended" | "cancelled";
  createdBy?: string;
  channelId?: string;
}

export interface PollResults {
  poll: PollData;
  results: PollOptionResult[];
  totalVotes: number;
  uniqueVoters: number;
}

export interface PollOptionResult {
  option: PollOption;
  percentage: number;
  votes: number;
  voters: string[];
}

/**
 * Poll API Service
 * Provides typed methods for all poll-related API operations
 */
class PollApiService {
  private readonly basePath = "/api/polls";

  /**
   * Create a new poll
   */
  async createPoll(guildId: string, data: CreatePollRequest): Promise<ApiResponse<PollData>> {
    return await apiClient.post<ApiResponse<PollData>>(`${this.basePath}/${guildId}`, data);
  }

  /**
   * Get a specific poll by ID
   */
  async getPoll(guildId: string, pollId: string): Promise<ApiResponse<PollData>> {
    return await apiClient.get<ApiResponse<PollData>>(`${this.basePath}/${guildId}/${pollId}`);
  }

  /**
   * List polls for a guild
   */
  async listPolls(guildId: string, options: PollListOptions = {}): Promise<PaginatedResponse<PollData[]>> {
    const params: Record<string, string> = {
      page: options.page?.toString() || "1",
      limit: options.limit?.toString() || "10",
      status: options.status || "all",
    };

    if (options.createdBy) params.createdBy = options.createdBy;
    if (options.channelId) params.channelId = options.channelId;

    return await apiClient.get<PaginatedResponse<PollData[]>>(`${this.basePath}/${guildId}`, params);
  }

  /**
   * Vote on a poll
   */
  async votePoll(guildId: string, pollId: string, data: VotePollRequest): Promise<ApiResponse<PollData>> {
    return await apiClient.post<ApiResponse<PollData>>(`${this.basePath}/${guildId}/${pollId}/vote`, data);
  }

  /**
   * Remove vote from a poll
   */
  async removeVote(guildId: string, pollId: string, userId: string): Promise<ApiResponse<PollData>> {
    return await apiClient.delete<ApiResponse<PollData>>(`${this.basePath}/${guildId}/${pollId}/vote/${userId}`);
  }

  /**
   * Get poll results
   */
  async getPollResults(guildId: string, pollId: string): Promise<ApiResponse<PollResults>> {
    return await apiClient.get<ApiResponse<PollResults>>(`${this.basePath}/${guildId}/${pollId}/results`);
  }

  /**
   * Get poll votes (detailed)
   */
  async getPollVotes(guildId: string, pollId: string, page = 1, limit = 50): Promise<PaginatedResponse<PollVote[]>> {
    const params = {
      page: page.toString(),
      limit: limit.toString(),
    };

    return await apiClient.get<PaginatedResponse<PollVote[]>>(`${this.basePath}/${guildId}/${pollId}/votes`, params);
  }

  /**
   * Close a poll early
   */
  async closePoll(guildId: string, pollId: string): Promise<ApiResponse<PollData>> {
    return await apiClient.post<ApiResponse<PollData>>(`${this.basePath}/${guildId}/${pollId}/close`);
  }

  /**
   * Cancel a poll
   */
  async cancelPoll(guildId: string, pollId: string): Promise<ApiResponse<PollData>> {
    return await apiClient.post<ApiResponse<PollData>>(`${this.basePath}/${guildId}/${pollId}/cancel`);
  }

  /**
   * Delete a poll
   */
  async deletePoll(guildId: string, pollId: string): Promise<ApiResponse<void>> {
    return await apiClient.delete<ApiResponse<void>>(`${this.basePath}/${guildId}/${pollId}`);
  }

  /**
   * Update poll message ID (when posted to Discord)
   */
  async updatePollMessage(guildId: string, pollId: string, messageId: string): Promise<ApiResponse<PollData>> {
    return await apiClient.patch<ApiResponse<PollData>>(`${this.basePath}/${guildId}/${pollId}/message`, {
      messageId,
    });
  }

  /**
   * Check if API client is configured
   */
  isConfigured(): boolean {
    return apiClient.isConfigured();
  }
}

// Export a singleton instance
export const pollApiService = new PollApiService();

// Also export the class for testing
export { PollApiService };
