import type { ConfigUpdateJob, ModerationActionJob, MusicActionJob } from "../../../shared/src/types/queue.js";
import { QUEUE_NAMES } from "../../../shared/src/types/queue.js";
import logger from "../logger.js";
import queueManager from "../queue/manager.js";

export class QueueService {
  private static instance?: QueueService;
  private isRedisConnected = false;
  private connectionChecked = false;

  static getInstance(): QueueService {
    if (!QueueService.instance) {
      QueueService.instance = new QueueService();
    }
    return QueueService.instance;
  }

  /**
   * Check if Redis is connected and available
   */
  private async checkRedisConnection(): Promise<boolean> {
    if (this.connectionChecked) {
      return this.isRedisConnected;
    }

    try {
      const queue = queueManager.getQueue(QUEUE_NAMES.BOT_COMMANDS);
      // Try to get queue stats to test connection
      await queue.getWaiting();
      this.isRedisConnected = true;
      logger.info("Redis connection verified - queue system active");
    } catch (error) {
      this.isRedisConnected = false;
      logger.warn("Redis connection failed - queue system will use fallback mode", error);
    }

    this.connectionChecked = true;
    return this.isRedisConnected;
  }

  /**
   * Add a moderation action to the queue
   */
  async addModerationAction(data: Omit<ModerationActionJob, "id" | "timestamp">): Promise<string> {
    const jobId = `mod-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;

    const job = {
      ...data,
      id: jobId,
      timestamp: Date.now(),
    };

    try {
      // Check Redis connection before attempting to queue
      const redisAvailable = await this.checkRedisConnection();

      if (!redisAvailable) {
        logger.warn(`Redis unavailable - cannot queue moderation action: ${job.type} for user ${job.targetUserId}`);
        throw new Error("Redis connection failed");
      }

      const queue = queueManager.getQueue(QUEUE_NAMES.BOT_COMMANDS);
      await queue.add("moderation-action", job);
      logger.info(`Added moderation action job: ${job.type} for user ${job.targetUserId}`);

      return jobId;
    } catch (error) {
      logger.error(`Failed to queue moderation action: ${job.type}`, error);
      throw error;
    }
  }

  /**
   * Add a music action to the queue
   */
  async addMusicAction(data: Omit<MusicActionJob, "id" | "timestamp">): Promise<string> {
    const jobId = `music-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;

    const job = {
      ...data,
      id: jobId,
      timestamp: Date.now(),
    };

    try {
      const redisAvailable = await this.checkRedisConnection();

      if (!redisAvailable) {
        logger.warn(`Redis unavailable - cannot queue music action: ${job.type}`);
        throw new Error("Redis connection failed");
      }

      const queue = queueManager.getQueue(QUEUE_NAMES.BOT_COMMANDS);
      await queue.add("music-action", job);
      logger.info(`Added music action job: ${job.type}`);

      return jobId;
    } catch (error) {
      logger.error(`Failed to queue music action: ${job.type}`, error);
      throw error;
    }
  }

  /**
   * Add a config update to the queue
   */
  async addConfigUpdate(data: Omit<ConfigUpdateJob, "id" | "timestamp">): Promise<string> {
    const jobId = `config-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;

    const job = {
      ...data,
      id: jobId,
      timestamp: Date.now(),
    };

    try {
      const redisAvailable = await this.checkRedisConnection();

      if (!redisAvailable) {
        logger.warn(`Redis unavailable - cannot queue config update: ${job.configKey}`);
        throw new Error("Redis connection failed");
      }

      const queue = queueManager.getQueue(QUEUE_NAMES.BOT_COMMANDS);
      await queue.add("config-update", job);
      logger.info(`Added config update job: ${job.configKey}`);

      return jobId;
    } catch (error) {
      logger.error(`Failed to queue config update: ${job.configKey}`, error);
      throw error;
    }
  }

  /**
   * Get queue statistics
   */
  async getQueueStats() {
    try {
      const redisAvailable = await this.checkRedisConnection();

      if (!redisAvailable) {
        return {
          waiting: 0,
          active: 0,
          completed: 0,
          failed: 0,
          delayed: 0,
          redisConnected: false,
        };
      }

      const stats = await queueManager.getQueueStats(QUEUE_NAMES.BOT_COMMANDS);
      return {
        ...stats,
        redisConnected: true,
      };
    } catch (error) {
      logger.error("Failed to get queue stats", error);
      return {
        waiting: 0,
        active: 0,
        completed: 0,
        failed: 0,
        delayed: 0,
        redisConnected: false,
      };
    }
  }

  /**
   * Check if Redis is currently connected
   */
  async isRedisAvailable(): Promise<boolean> {
    return await this.checkRedisConnection();
  }

  /**
   * Reset connection check to force recheck
   */
  resetConnectionCheck(): void {
    this.connectionChecked = false;
    this.isRedisConnected = false;
  }
}

export default QueueService.getInstance();
