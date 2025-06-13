import type { ConfigUpdateJob, ModerationActionJob, MusicActionJob } from "../../../shared/src/types/queue.js";
import { QUEUE_NAMES } from "../../../shared/src/types/queue.js";
import logger from "../logger.js";
import queueManager from "../queue/manager.js";

export class QueueService {
  private static instance?: QueueService;

  static getInstance(): QueueService {
    if (!QueueService.instance) {
      QueueService.instance = new QueueService();
    }
    return QueueService.instance;
  }

  /**
   * Add a moderation action to the queue
   */
  async addModerationAction(data: Omit<ModerationActionJob, "id" | "timestamp">): Promise<string> {
    const queue = queueManager.getQueue(QUEUE_NAMES.BOT_COMMANDS);

    const job = {
      ...data,
      id: `mod-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`,
      timestamp: Date.now(),
    };

    await queue.add("moderation-action", job);
    logger.info(`Added moderation action job: ${job.type} for user ${job.targetUserId}`);

    return job.id;
  }

  /**
   * Add a music action to the queue
   */
  async addMusicAction(data: Omit<MusicActionJob, "id" | "timestamp">): Promise<string> {
    const queue = queueManager.getQueue(QUEUE_NAMES.BOT_COMMANDS);

    const job = {
      ...data,
      id: `music-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`,
      timestamp: Date.now(),
    };

    await queue.add("music-action", job);
    logger.info(`Added music action job: ${job.type}`);

    return job.id;
  }

  /**
   * Add a config update to the queue
   */
  async addConfigUpdate(data: Omit<ConfigUpdateJob, "id" | "timestamp">): Promise<string> {
    const queue = queueManager.getQueue(QUEUE_NAMES.BOT_COMMANDS);

    const job = {
      ...data,
      id: `config-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`,
      timestamp: Date.now(),
    };

    await queue.add("config-update", job);
    logger.info(`Added config update job: ${job.configKey}`);

    return job.id;
  }

  /**
   * Get queue statistics
   */
  async getQueueStats() {
    return await queueManager.getQueueStats(QUEUE_NAMES.BOT_COMMANDS);
  }
}

export default QueueService.getInstance();
