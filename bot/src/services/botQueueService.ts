import { bullMQRegistry } from "@shared/queue";
import logger from "../logger.js";
import type Client from "../structures/Client.js";

export interface BotQueueJobData {
  type: string;
  data: any;
  guildId?: string;
  userId?: string;
  channelId?: string;
  requestId?: string;
  metadata?: Record<string, any>;
}

export interface BotQueueOptions {
  priority?: number;
  delay?: number;
  attempts?: number;
  backoff?: {
    type: "exponential" | "fixed";
    delay: number;
  };
}

export class BotQueueService {
  private client: Client;
  private readonly queueNames = {
    CRITICAL: "critical-operations",
    BOT_COMMANDS: "bot-commands",
    BOT_EVENTS: "bot-events",
    BACKGROUND: "background-tasks",
    NOTIFICATIONS: "notifications",
    DISCORD_EVENTS: "discord-events",
  } as const;

  constructor(client: Client) {
    this.client = client;
  }

  async initialize(): Promise<void> {
    logger.info("Initializing Bot Queue Service with BullMQ...");

    // Initialize all required queues
    Object.values(this.queueNames).forEach((queueName) => {
      bullMQRegistry.getQueue(queueName);
    });

    logger.info("✅ Bot Queue Service initialized with BullMQ");
  }

  /**
   * Add a job to the appropriate queue based on type
   */
  async addJob(jobData: BotQueueJobData, options: BotQueueOptions = {}): Promise<string> {
    const queueName = this.getQueueNameForJobType(jobData.type);
    const queue = bullMQRegistry.getQueue(queueName);

    try {
      const job = await queue.add(jobData.type, jobData, {
        priority: options.priority,
        delay: options.delay,
        attempts: options.attempts ?? 3,
        backoff: options.backoff ?? {
          type: "exponential",
          delay: 2000,
        },
      });

      logger.debug(`Queued job ${job.id} of type ${jobData.type} in ${queueName}`);
      return job.id as string;
    } catch (error) {
      logger.error(`Failed to queue job of type ${jobData.type}:`, error);
      throw error;
    }
  }

  /**
   * Add a high-priority job for critical operations
   */
  async addCriticalJob(jobData: BotQueueJobData, options: BotQueueOptions = {}): Promise<string> {
    return this.addJob(jobData, { ...options, priority: 10 });
  }

  /**
   * Add a delayed job
   */
  async scheduleJob(jobData: BotQueueJobData, delayMs: number, options: BotQueueOptions = {}): Promise<string> {
    return this.addJob(jobData, { ...options, delay: delayMs });
  }

  /**
   * Get job status
   */
  async getJobStatus(queueName: string, jobId: string) {
    const queue = bullMQRegistry.getQueue(queueName);
    const job = await queue.getJob(jobId);

    if (!job) {
      return { status: "not_found" };
    }

    return {
      id: job.id,
      status: await job.getState(),
      progress: job.progress,
      data: job.data,
      createdAt: new Date(job.timestamp),
      processedAt: job.processedOn ? new Date(job.processedOn) : null,
      finishedAt: job.finishedOn ? new Date(job.finishedOn) : null,
      error: job.failedReason,
    };
  }

  /**
   * Get queue metrics
   */
  async getQueueMetrics(queueName: string) {
    const queue = bullMQRegistry.getQueue(queueName);
    return {
      waiting: await queue.getWaitingCount(),
      active: await queue.getActiveCount(),
      completed: await queue.getCompletedCount(),
      failed: await queue.getFailedCount(),
      delayed: await queue.getDelayedCount(),
    };
  }

  /**
   * Get metrics for all queues
   */
  async getAllQueueMetrics() {
    const metrics: Record<string, any> = {};

    for (const queueName of Object.values(this.queueNames)) {
      try {
        metrics[queueName] = await this.getQueueMetrics(queueName);
      } catch (error) {
        logger.error(`Failed to get metrics for queue ${queueName}:`, error);
        metrics[queueName] = { error: "Failed to get metrics" };
      }
    }

    return metrics;
  }

  /**
   * Get system health
   */
  async getSystemHealth() {
    const metrics = await this.getAllQueueMetrics();
    let overall = true;

    for (const [queueName, queueMetrics] of Object.entries(metrics)) {
      if (queueMetrics.error || queueMetrics.failed > 100) {
        overall = false;
        break;
      }
    }

    return {
      overall,
      queues: metrics,
      timestamp: Date.now(),
    };
  }

  /**
   * Check if the service is ready
   */
  isReady(): boolean {
    return true; // BullMQ handles connection health internally
  }

  /**
   * Shutdown the service
   */
  async shutdown(): Promise<void> {
    logger.info("Shutting down Bot Queue Service...");
    await bullMQRegistry.shutdown();
    logger.info("✅ Bot Queue Service shutdown complete");
  }

  /**
   * Legacy compatibility method for processRequest
   */
  async processRequest(request: any): Promise<any> {
    logger.debug("Processing legacy request via BullMQ");

    const jobData: BotQueueJobData = {
      type: request.type || "LEGACY_REQUEST",
      data: request.data || request,
      guildId: request.guildId,
      userId: request.userId,
      channelId: request.channelId,
      requestId: request.id,
      metadata: request.metadata,
    };

    try {
      const jobId = await this.addJob(jobData);
      return {
        success: true,
        jobId,
        requestId: request.id,
        timestamp: Date.now(),
      };
    } catch (error) {
      logger.error("Failed to process legacy request:", error);
      return {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
        requestId: request.id,
        timestamp: Date.now(),
      };
    }
  }

  /**
   * Determine which queue to use for a job type
   */
  private getQueueNameForJobType(type: string): string {
    // Critical operations
    if (type.includes("CRITICAL") || type.includes("URGENT")) {
      return this.queueNames.CRITICAL;
    }

    // Bot commands
    if (type.includes("COMMAND") || type.includes("SLASH")) {
      return this.queueNames.BOT_COMMANDS;
    }

    // Discord events
    if (type.includes("DISCORD_") || type.includes("GUILD_") || type.includes("MEMBER_")) {
      return this.queueNames.DISCORD_EVENTS;
    }

    // Bot events
    if (type.includes("BOT_") || type.includes("EVENT_")) {
      return this.queueNames.BOT_EVENTS;
    }

    // Notifications
    if (type.includes("NOTIFY") || type.includes("ALERT") || type.includes("WEBHOOK")) {
      return this.queueNames.NOTIFICATIONS;
    }

    // Default to background tasks
    return this.queueNames.BACKGROUND;
  }
}
