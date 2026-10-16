import { apiClient, type ApiResponse, type PaginatedResponse } from "./apiClient.js";

export interface ReminderData {
  id: string;
  userId: string;
  username: string;
  guildId: string;
  channelId: string;
  message: string;
  reminderTime: string;
  createdAt: string;
  status: "pending" | "sent" | "failed" | "cancelled";
  isRecurring: boolean;
  recurringPattern?: string;
  nextReminder?: string;
}

export interface CreateReminderRequest {
  userId: string;
  username: string;
  channelId: string;
  message: string;
  reminderTime: string;
  isRecurring?: boolean;
  recurringPattern?: string;
}

export interface ReminderListOptions {
  page?: number;
  limit?: number;
  status?: "all" | "pending" | "sent" | "failed" | "cancelled";
  userId?: string;
  channelId?: string;
}

export interface UpdateReminderRequest {
  message?: string;
  reminderTime?: string;
  isRecurring?: boolean;
  recurringPattern?: string;
}

/**
 * Reminder API Service
 * Provides typed methods for all reminder-related API operations
 */
class ReminderApiService {
  private readonly basePath = "/api/reminders";

  /**
   * Create a new reminder
   */
  async createReminder(guildId: string, data: CreateReminderRequest): Promise<ApiResponse<ReminderData>> {
    return await apiClient.post<ApiResponse<ReminderData>>(`${this.basePath}/${guildId}`, data);
  }

  /**
   * Get a specific reminder by ID
   */
  async getReminder(guildId: string, reminderId: string): Promise<ApiResponse<ReminderData>> {
    return await apiClient.get<ApiResponse<ReminderData>>(`${this.basePath}/${guildId}/${reminderId}`);
  }

  /**
   * List reminders for a guild
   */
  async listReminders(guildId: string, options: ReminderListOptions = {}): Promise<PaginatedResponse<ReminderData[]>> {
    const params: Record<string, string> = {
      page: options.page?.toString() || "1",
      limit: options.limit?.toString() || "10",
      status: options.status || "all",
    };

    if (options.userId) params.userId = options.userId;
    if (options.channelId) params.channelId = options.channelId;

    return await apiClient.get<PaginatedResponse<ReminderData[]>>(`${this.basePath}/${guildId}`, params);
  }

  /**
   * List reminders for a specific user
   */
  async listUserReminders(
    guildId: string,
    userId: string,
    options: Omit<ReminderListOptions, "userId"> = {}
  ): Promise<PaginatedResponse<ReminderData[]>> {
    const params: Record<string, string> = {
      page: options.page?.toString() || "1",
      limit: options.limit?.toString() || "10",
      status: options.status || "all",
    };

    if (options.channelId) params.channelId = options.channelId;

    return await apiClient.get<PaginatedResponse<ReminderData[]>>(`${this.basePath}/${guildId}/user/${userId}`, params);
  }

  /**
   * Update a reminder
   */
  async updateReminder(
    guildId: string,
    reminderId: string,
    data: UpdateReminderRequest
  ): Promise<ApiResponse<ReminderData>> {
    return await apiClient.patch<ApiResponse<ReminderData>>(`${this.basePath}/${guildId}/${reminderId}`, data);
  }

  /**
   * Cancel a reminder
   */
  async cancelReminder(guildId: string, reminderId: string): Promise<ApiResponse<ReminderData>> {
    return await apiClient.post<ApiResponse<ReminderData>>(`${this.basePath}/${guildId}/${reminderId}/cancel`);
  }

  /**
   * Delete a reminder
   */
  async deleteReminder(guildId: string, reminderId: string): Promise<ApiResponse<void>> {
    return await apiClient.delete<ApiResponse<void>>(`${this.basePath}/${guildId}/${reminderId}`);
  }

  /**
   * Bulk delete reminders for a user
   */
  async bulkDeleteUserReminders(guildId: string, userId: string): Promise<ApiResponse<{ deleted: number }>> {
    return await apiClient.delete<ApiResponse<{ deleted: number }>>(`${this.basePath}/${guildId}/user/${userId}/bulk`);
  }

  /**
   * Get reminder statistics for a guild
   */
  async getReminderStats(guildId: string): Promise<
    ApiResponse<{
      total: number;
      pending: number;
      sent: number;
      failed: number;
      cancelled: number;
      recurring: number;
    }>
  > {
    return await apiClient.get<
      ApiResponse<{
        total: number;
        pending: number;
        sent: number;
        failed: number;
        cancelled: number;
        recurring: number;
      }>
    >(`${this.basePath}/${guildId}/stats`);
  }

  /**
   * Test reminder notification (for testing purposes)
   */
  async testReminder(guildId: string, reminderId: string): Promise<ApiResponse<{ sent: boolean; message: string }>> {
    return await apiClient.post<ApiResponse<{ sent: boolean; message: string }>>(
      `${this.basePath}/${guildId}/${reminderId}/test`
    );
  }

  /**
   * Check if API client is configured
   */
  isConfigured(): boolean {
    return apiClient.isConfigured();
  }
}

// Export a singleton instance
export const reminderApiService = new ReminderApiService();

// Also export the class for testing
export { ReminderApiService };
