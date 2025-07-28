/**
 * Centralized API Services Export
 * Import all API services from here for consistency and easy access
 */

import logger from "../logger.js";

// Import services for utility functions (must be imported before being used)
import { cacheService } from "./cacheService.js";
import { economyApiService } from "./economyApiService.js";
import { giveawayApiService } from "./giveawayApiService.js";
import { levelingApiService } from "./levelingApiService.js";
import { metricsService } from "./metricsService.js";
import { musicApiService } from "./musicApiService.js";
import { pollApiService } from "./pollApiService.js";
import { reminderApiService } from "./reminderApiService.js";

// Core API client
export { apiClient, ApiClient } from "./apiClient.js";
export type { ApiResponse, PaginatedResponse } from "./apiClient.js";

// Caching Service
export { cacheService, CacheService } from "./cacheService.js";

// Metrics Service
export { metricsService, MetricsService } from "./metricsService.js";

// Domain-specific API services
export { giveawayApiService, GiveawayApiService } from "./giveawayApiService.js";
export type {
  CreateGiveawayRequest,
  EnterGiveawayRequest,
  GiveawayData,
  GiveawayEntry,
  GiveawayListOptions,
  GiveawayWinner,
  RerollGiveawayRequest,
} from "./giveawayApiService.js";

export { levelingApiService, LevelingApiService } from "./levelingApiService.js";
export type {
  BulkUpdateRequest,
  CreateRewardRequest,
  LevelingLeaderboard,
  LevelingReward,
  LevelingSettings,
  LevelingUser,
  UpdateSettingsRequest,
  UpdateUserXpRequest,
} from "./levelingApiService.js";

export { pollApiService, PollApiService } from "./pollApiService.js";
export type {
  CreatePollOption,
  CreatePollRequest,
  PollData,
  PollListOptions,
  PollOption,
  PollOptionResult,
  PollResults,
  PollVote,
  VotePollRequest,
} from "./pollApiService.js";

export { reminderApiService, ReminderApiService } from "./reminderApiService.js";
export type {
  CreateReminderRequest,
  ReminderData,
  ReminderListOptions,
  UpdateReminderRequest,
} from "./reminderApiService.js";

export { musicApiService, MusicApiService } from "./musicApiService.js";
export type {
  LoopRequest,
  MusicStatus,
  PlayRequest,
  QueueResponse,
  SeekRequest,
  ShuffleRequest,
  Track,
  VolumeRequest,
} from "./musicApiService.js";

export { economyApiService, EconomyApiService } from "./economyApiService.js";
export type {
  DailyRewardRequest,
  EconomyItem,
  EconomyLeaderboard,
  EconomyTransaction,
  EconomyUser,
  ShopItem,
  ShopPurchaseRequest,
  TransferRequest,
  UpdateBalanceRequest,
  WeeklyRewardRequest,
} from "./economyApiService.js";

/**
 * Check if all API services are properly configured
 */
export function areAllApiServicesConfigured(): boolean {
  const services = [
    giveawayApiService,
    levelingApiService,
    pollApiService,
    reminderApiService,
    musicApiService,
    economyApiService,
  ];

  return services.every((service) => service.isConfigured());
}

/**
 * Get detailed status of all API services
 */
export async function getApiServicesStatus(): Promise<{
  configured: boolean;
  services: {
    name: string;
    configured: boolean;
  }[];
  cacheStats: any;
  metricsStats: any;
}> {
  const services = [
    { name: "Giveaway API", service: giveawayApiService },
    { name: "Leveling API", service: levelingApiService },
    { name: "Poll API", service: pollApiService },
    { name: "Reminder API", service: reminderApiService },
    { name: "Music API", service: musicApiService },
    { name: "Economy API", service: economyApiService },
  ];

  const serviceStatuses = services.map(({ name, service }) => ({
    name,
    configured: service.isConfigured(),
  }));

  const allConfigured = serviceStatuses.every((service) => service.configured);

  return {
    configured: allConfigured,
    services: serviceStatuses,
    cacheStats: await cacheService.getStats(),
    metricsStats: metricsService.getMetricsSummary(),
  };
}

/**
 * Initialize all services
 */
export async function initializeServices(): Promise<void> {
  // Log initialization
  logger.info("🚀 Initializing API services...");

  const status = await getApiServicesStatus();

  if (status.configured) {
    logger.info("✅ All API services configured successfully");
  } else {
    logger.warn("⚠️ Some API services are not configured:");
    status.services
      .filter((service) => !service.configured)
      .forEach((service) => {
        logger.warn(`  - ${service.name}: Not configured`);
      });
  }

  logger.info(`📊 Cache: ${status.cacheStats.totalKeys} keys, ${status.cacheStats.hitRatio}% hit ratio`);
  logger.info(`📈 Metrics: Tracking API calls and command executions`);
}

/**
 * Utility function to warm up caches for a guild
 */
export async function warmUpCaches(guildId: string): Promise<void> {
  try {
    await cacheService.warmUp(guildId);
    logger.info(`🔥 Cache warmed up for guild: ${guildId}`);
  } catch (error) {
    logger.error(`❌ Failed to warm up cache for guild ${guildId}:`, error);
  }
}
