import { apiClient, type ApiResponse, type PaginatedResponse } from "./apiClient.js";

export interface EconomyUser {
  id: string;
  userId: string;
  guildId: string;
  balance: bigint;
  bank: bigint;
  lastDaily: string | null;
  lastWeekly: string | null;
  streak: number;
  inventory: EconomyItem[];
  totalEarned: bigint;
  totalSpent: bigint;
  rank: number;
  createdAt: string;
  updatedAt: string;
}

export interface EconomyItem {
  id: string;
  name: string;
  description: string;
  price: number;
  category: string;
  emoji?: string;
  quantity: number;
  purchasedAt: string;
}

export interface ShopItem {
  id: string;
  name: string;
  description: string;
  price: number;
  category: string;
  emoji?: string;
  stock: number;
  maxPerUser: number;
  isAvailable: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface EconomyTransaction {
  id: string;
  userId: string;
  guildId: string;
  type: "earn" | "spend" | "transfer" | "daily" | "weekly" | "shop";
  amount: bigint;
  balance: bigint;
  description: string;
  metadata?: Record<string, any>;
  createdAt: string;
}

export interface EconomyLeaderboard {
  users: EconomyUser[];
  pagination: {
    page: number;
    pages: number;
    total: number;
    limit: number;
  };
}

export interface TransferRequest {
  fromUserId: string;
  toUserId: string;
  amount: number;
  reason?: string;
}

export interface UpdateBalanceRequest {
  amount: number;
  type: "add" | "subtract" | "set";
  reason?: string;
}

export interface ShopPurchaseRequest {
  itemId: string;
  quantity?: number;
}

export interface DailyRewardRequest {
  userId: string;
  username: string;
}

export interface WeeklyRewardRequest {
  userId: string;
  username: string;
}

/**
 * Economy API Service
 * Provides typed methods for all economy-related API operations
 */
class EconomyApiService {
  private readonly basePath = "/api/economy";

  /**
   * Get user's economy data
   */
  async getUserData(guildId: string, userId: string): Promise<ApiResponse<EconomyUser>> {
    return await apiClient.get<ApiResponse<EconomyUser>>(`${this.basePath}/${guildId}/users/${userId}`);
  }

  /**
   * Get economy leaderboard
   */
  async getLeaderboard(guildId: string, page = 1, limit = 10): Promise<ApiResponse<EconomyLeaderboard>> {
    const params = {
      page: page.toString(),
      limit: limit.toString(),
    };
    return await apiClient.get<ApiResponse<EconomyLeaderboard>>(`${this.basePath}/${guildId}/leaderboard`, params);
  }

  /**
   * Update user's balance
   */
  async updateBalance(guildId: string, userId: string, data: UpdateBalanceRequest): Promise<ApiResponse<EconomyUser>> {
    return await apiClient.patch<ApiResponse<EconomyUser>>(`${this.basePath}/${guildId}/users/${userId}/balance`, data);
  }

  /**
   * Transfer money between users
   */
  async transferMoney(
    guildId: string,
    data: TransferRequest
  ): Promise<
    ApiResponse<{
      from: EconomyUser;
      to: EconomyUser;
      transaction: EconomyTransaction;
    }>
  > {
    return await apiClient.post<
      ApiResponse<{
        from: EconomyUser;
        to: EconomyUser;
        transaction: EconomyTransaction;
      }>
    >(`${this.basePath}/${guildId}/transfer`, data);
  }

  /**
   * Claim daily reward
   */
  async claimDaily(
    guildId: string,
    data: DailyRewardRequest
  ): Promise<
    ApiResponse<{
      user: EconomyUser;
      reward: number;
      streak: number;
      nextDaily: string;
    }>
  > {
    return await apiClient.post<
      ApiResponse<{
        user: EconomyUser;
        reward: number;
        streak: number;
        nextDaily: string;
      }>
    >(`${this.basePath}/${guildId}/daily`, data);
  }

  /**
   * Claim weekly reward
   */
  async claimWeekly(
    guildId: string,
    data: WeeklyRewardRequest
  ): Promise<
    ApiResponse<{
      user: EconomyUser;
      reward: number;
      nextWeekly: string;
    }>
  > {
    return await apiClient.post<
      ApiResponse<{
        user: EconomyUser;
        reward: number;
        nextWeekly: string;
      }>
    >(`${this.basePath}/${guildId}/weekly`, data);
  }

  /**
   * Get shop items
   */
  async getShopItems(guildId: string, category?: string): Promise<ApiResponse<ShopItem[]>> {
    const params = category ? { category } : undefined;
    return await apiClient.get<ApiResponse<ShopItem[]>>(`${this.basePath}/${guildId}/shop`, params);
  }

  /**
   * Purchase item from shop
   */
  async purchaseItem(
    guildId: string,
    userId: string,
    data: ShopPurchaseRequest
  ): Promise<
    ApiResponse<{
      user: EconomyUser;
      item: EconomyItem;
      transaction: EconomyTransaction;
    }>
  > {
    return await apiClient.post<
      ApiResponse<{
        user: EconomyUser;
        item: EconomyItem;
        transaction: EconomyTransaction;
      }>
    >(`${this.basePath}/${guildId}/users/${userId}/purchase`, data);
  }

  /**
   * Get user's inventory
   */
  async getUserInventory(guildId: string, userId: string): Promise<ApiResponse<EconomyItem[]>> {
    return await apiClient.get<ApiResponse<EconomyItem[]>>(`${this.basePath}/${guildId}/users/${userId}/inventory`);
  }

  /**
   * Use/consume an item from inventory
   */
  async useItem(
    guildId: string,
    userId: string,
    itemId: string
  ): Promise<
    ApiResponse<{
      user: EconomyUser;
      item: EconomyItem;
      effect?: string;
    }>
  > {
    return await apiClient.post<
      ApiResponse<{
        user: EconomyUser;
        item: EconomyItem;
        effect?: string;
      }>
    >(`${this.basePath}/${guildId}/users/${userId}/inventory/${itemId}/use`);
  }

  /**
   * Get user's transaction history
   */
  async getTransactionHistory(
    guildId: string,
    userId: string,
    page = 1,
    limit = 20
  ): Promise<PaginatedResponse<EconomyTransaction[]>> {
    const params = {
      page: page.toString(),
      limit: limit.toString(),
    };
    return await apiClient.get<PaginatedResponse<EconomyTransaction[]>>(
      `${this.basePath}/${guildId}/users/${userId}/transactions`,
      params
    );
  }

  /**
   * Get economy statistics for the guild
   */
  async getEconomyStats(guildId: string): Promise<
    ApiResponse<{
      totalUsers: number;
      totalMoney: bigint;
      totalTransactions: number;
      averageBalance: number;
      topEarners: EconomyUser[];
      recentTransactions: EconomyTransaction[];
    }>
  > {
    return await apiClient.get<
      ApiResponse<{
        totalUsers: number;
        totalMoney: bigint;
        totalTransactions: number;
        averageBalance: number;
        topEarners: EconomyUser[];
        recentTransactions: EconomyTransaction[];
      }>
    >(`${this.basePath}/${guildId}/stats`);
  }

  /**
   * Reset user's economy data
   */
  async resetUser(guildId: string, userId: string, reason?: string): Promise<ApiResponse<EconomyUser>> {
    const url = reason
      ? `${this.basePath}/${guildId}/users/${userId}?reason=${encodeURIComponent(reason)}`
      : `${this.basePath}/${guildId}/users/${userId}`;
    return await apiClient.delete<ApiResponse<EconomyUser>>(url);
  }

  /**
   * Reset entire guild economy
   */
  async resetGuildEconomy(guildId: string, reason?: string): Promise<ApiResponse<{ reset: number }>> {
    const url = reason
      ? `${this.basePath}/${guildId}/reset?reason=${encodeURIComponent(reason)}`
      : `${this.basePath}/${guildId}/reset`;
    return await apiClient.delete<ApiResponse<{ reset: number }>>(url);
  }

  /**
   * Check if API client is configured
   */
  isConfigured(): boolean {
    return apiClient.isConfigured();
  }
}

// Export a singleton instance
export const economyApiService = new EconomyApiService();

// Also export the class for testing
export { EconomyApiService };
