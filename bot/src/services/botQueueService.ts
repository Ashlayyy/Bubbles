import { bullMQRegistry } from "@shared/queue";
import { Worker } from "bullmq";
import logger from "../logger.js";
import { DeadLetterQueue } from "../queue/DeadLetterQueue.js";
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
  public deadLetterQueue: DeadLetterQueue;
  private readonly queueNames = {
    CRITICAL: "critical-operations",
    BOT_COMMANDS: "bot-commands",
    BOT_EVENTS: "bot-events",
    BACKGROUND: "background-tasks",
    NOTIFICATIONS: "notifications",
    DISCORD_EVENTS: "discord-events",
  } as const;
  private workers = new Map<string, Worker>();

  constructor(client: Client) {
    this.client = client;
    this.deadLetterQueue = new DeadLetterQueue(client);
  }

  async initialize(): Promise<void> {
    logger.info("Initializing Bot Queue Service with BullMQ...");

    // Skip queue initialization if explicitly disabled
    if (process.env.DISABLE_QUEUES === "true") {
      logger.info("⚠️ Queue system disabled via DISABLE_QUEUES environment variable");
      logger.info("✅ Bot Queue Service initialized (queues disabled)");
      return;
    }

    // Wait for Redis to be available with a timeout
    let redisAvailable = false;
    const maxAttempts = 10;
    const delayMs = 1000;

    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      if (bullMQRegistry.isAvailable()) {
        redisAvailable = true;
        break;
      }

      logger.info(`Waiting for Redis connection... (attempt ${attempt}/${maxAttempts})`);
      await new Promise((resolve) => setTimeout(resolve, delayMs));
    }

    if (!redisAvailable) {
      logger.warn("⚠️ Redis not available after timeout - Queue operations will be disabled");
      logger.warn("💡 Install Redis or start Redis container to enable queue features");
      logger.info("✅ Bot Queue Service initialized (Redis disabled)");
      return;
    }

    logger.info("✅ Redis connection established, initializing queues...");

    // Initialize all required queues
    Object.values(this.queueNames).forEach((queueName) => {
      const queue = bullMQRegistry.getQueue(queueName);
      if (!queue) {
        logger.warn(`Failed to create queue: ${queueName}`);
      }
    });

    // Set up failed job handling for dead letter queue integration
    this.setupFailedJobHandling();

    // Initialize workers to process jobs
    await this.initializeWorkers();

    logger.info("✅ Bot Queue Service initialized with BullMQ");
  }

  /**
   * Initialize workers for all queues
   */
  private async initializeWorkers(): Promise<void> {
    if (!bullMQRegistry.isAvailable()) {
      logger.warn("Cannot initialize workers - Redis not available");
      return;
    }

    logger.info("Initializing BullMQ workers...");

    // Create workers for each queue
    for (const [queueType, queueName] of Object.entries(this.queueNames)) {
      try {
        const queue = bullMQRegistry.getQueue(queueName);
        if (!queue) {
          logger.warn(`Cannot create worker for ${queueName} - queue not available`);
          continue;
        }

        const worker = new Worker(
          queueName,
          async (job) => {
            if (!job) {
              logger.error("Received undefined job");
              return;
            }

            logger.debug(`Processing job ${job.id} of type ${job.name} in queue ${queueName}`);

            try {
              // Process the job based on its type
              const result = await this.processJob(job);
              logger.debug(`Job ${job.id} completed successfully`);
              return result;
            } catch (error) {
              logger.error(`Job ${job.id} failed:`, error);
              throw error;
            }
          },
          {
            connection: queue.connection,
            concurrency: queueType === "CRITICAL" ? 1 : 5, // Critical operations get single concurrency
            removeOnComplete: { count: 100 },
            removeOnFail: { count: 50 },
          }
        );

        // Set up worker event listeners
        worker.on("completed", (job, result) => {
          if (job) {
            logger.debug(`Worker completed job ${job.id} in ${queueName}:`, result);
          }
        });

        worker.on("failed", (job, err) => {
          if (job) {
            logger.error(`Worker failed job ${job.id} in ${queueName}:`, err);
          }
        });

        worker.on("error", (err) => {
          logger.error(`Worker error in ${queueName}:`, err);
        });

        this.workers.set(queueName, worker);
        logger.info(`✅ Worker initialized for queue: ${queueName}`);
      } catch (error) {
        logger.error(`Failed to initialize worker for ${queueName}:`, error);
      }
    }

    logger.info(`✅ Initialized ${this.workers.size} workers`);
  }

  /**
   * Process a job based on its type
   */
  private async processJob(job: any): Promise<any> {
    const { type, data } = job.data;

    logger.debug(`Processing job type: ${type}`, { jobId: job.id, data });

    switch (type) {
      case "KICK_USER":
        return await this.processKickUser(data);

      case "BAN_USER":
        return await this.processBanUser(data);

      case "TIMEOUT_USER":
        return await this.processTimeoutUser(data);

      case "UNBAN_USER":
        return await this.processUnbanUser(data);

      case "LEGACY_REQUEST":
        // Handle legacy requests by executing them directly
        return await this.processLegacyRequest(data);

      default:
        logger.warn(`Unknown job type: ${type}`);
        return { success: false, error: `Unknown job type: ${type}` };
    }
  }

  /**
   * Process kick user job
   */
  private async processKickUser(data: any): Promise<any> {
    try {
      const { targetUserId, guildId, reason } = data;
      const guild = await this.client.guilds.fetch(guildId);
      const member = await guild.members.fetch(targetUserId);

      await member.kick(reason);

      logger.info(`Successfully kicked user ${targetUserId} from guild ${guildId}`);
      return { success: true, action: "kick", userId: targetUserId };
    } catch (error) {
      logger.error("Failed to process kick user job:", error);
      throw error;
    }
  }

  /**
   * Process ban user job
   */
  private async processBanUser(data: any): Promise<any> {
    try {
      const { targetUserId, guildId, reason } = data;
      const guild = await this.client.guilds.fetch(guildId);

      await guild.members.ban(targetUserId, {
        reason,
        deleteMessageSeconds: 7 * 24 * 60 * 60, // Delete messages from the last 7 days
      });

      logger.info(`Successfully banned user ${targetUserId} from guild ${guildId}`);
      return { success: true, action: "ban", userId: targetUserId };
    } catch (error) {
      logger.error("Failed to process ban user job:", error);
      throw error;
    }
  }

  /**
   * Process timeout user job
   */
  private async processTimeoutUser(data: any): Promise<any> {
    try {
      const { targetUserId, guildId, reason, duration } = data;
      const guild = await this.client.guilds.fetch(guildId);
      const member = await guild.members.fetch(targetUserId);

      if (duration) {
        const timeoutDuration = duration * 1000; // Convert to milliseconds
        await member.timeout(timeoutDuration, reason);
        logger.info(`Successfully timed out user ${targetUserId} for ${duration}s in guild ${guildId}`);
      } else {
        // Remove timeout
        await member.timeout(null, reason);
        logger.info(`Successfully removed timeout from user ${targetUserId} in guild ${guildId}`);
      }

      return { success: true, action: "timeout", userId: targetUserId, duration };
    } catch (error) {
      logger.error("Failed to process timeout user job:", error);
      throw error;
    }
  }

  /**
   * Process unban user job
   */
  private async processUnbanUser(data: any): Promise<any> {
    try {
      const { targetUserId, guildId, reason } = data;
      const guild = await this.client.guilds.fetch(guildId);

      await guild.members.unban(targetUserId, reason);

      logger.info(`Successfully unbanned user ${targetUserId} from guild ${guildId}`);
      return { success: true, action: "unban", userId: targetUserId };
    } catch (error) {
      logger.error("Failed to process unban user job:", error);
      throw error;
    }
  }

  /**
   * Process legacy request job
   */
  private async processLegacyRequest(data: any): Promise<any> {
    try {
      logger.debug("Processing legacy request:", data);
      // For now, just return success - this can be expanded based on legacy request types
      return { success: true, processed: true };
    } catch (error) {
      logger.error("Failed to process legacy request:", error);
      throw error;
    }
  }

  /**
   * Set up failed job handling to integrate with DeadLetterQueue
   */
  private setupFailedJobHandling(): void {
    if (!bullMQRegistry.isAvailable()) {
      return;
    }

    Object.values(this.queueNames).forEach((queueName) => {
      const queueEvents = bullMQRegistry.getQueueEvents(queueName);
      if (queueEvents) {
        queueEvents.on("failed", async ({ jobId, failedReason }: { jobId: string; failedReason: string }) => {
          try {
            // Get the failed job details
            const queue = bullMQRegistry.getQueue(queueName);
            const job = await queue.getJob(jobId);

            if (job) {
              // Create an Error object from the failure reason
              const error = new Error(failedReason || "Unknown failure reason");

              // Send to dead letter queue for analysis and tracking
              this.deadLetterQueue.handleFailedJob(job, error);
            }
          } catch (error) {
            logger.error(`Failed to process dead letter entry for job ${jobId}:`, error);
          }
        });
      }
    });

    logger.info("✅ Dead letter queue integration set up for all queues");
  }

  /**
   * Add a job to the appropriate queue based on type
   */
  async addJob(jobData: BotQueueJobData, options: BotQueueOptions = {}): Promise<string> {
    if (!bullMQRegistry.isAvailable()) {
      logger.warn("Cannot add job - Redis not available");
      throw new Error("Queue system unavailable - Redis not connected");
    }

    const queueName = this.getQueueNameForJobType(jobData.type);
    const queue = bullMQRegistry.getQueue(queueName);

    if (!queue) {
      throw new Error(`Queue ${queueName} not available`);
    }

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
    if (!bullMQRegistry.isAvailable()) {
      return { error: "Redis not available" };
    }

    const queue = bullMQRegistry.getQueue(queueName);
    if (!queue) {
      return { error: "Queue not available" };
    }

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
    if (!bullMQRegistry.isAvailable()) {
      return { redis: { error: "Redis not available" } };
    }

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
    if (!bullMQRegistry.isAvailable()) {
      return {
        overall: false,
        queues: { redis: { error: "Redis not available" } },
        timestamp: Date.now(),
      };
    }

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
    return bullMQRegistry.isAvailable();
  }

  /**
   * Reset BullMQ connections (useful for debugging)
   */
  async resetConnections(): Promise<void> {
    logger.info("Resetting BullMQ connections...");
    await bullMQRegistry.shutdown();
    // Force re-initialization
    bullMQRegistry.isAvailable();
    logger.info("BullMQ connections reset complete");
  }

  /**
   * Get detailed connection status for debugging
   */
  getConnectionStatus(): any {
    const status = bullMQRegistry.getConnectionStatus();
    logger.debug("BullMQ connection status:", status);
    return status;
  }

  /**
   * Shutdown the service
   */
  async shutdown(): Promise<void> {
    logger.info("Shutting down Bot Queue Service...");

    // Close all workers
    for (const [queueName, worker] of this.workers.entries()) {
      try {
        await worker.close();
        logger.info(`Closed worker for queue: ${queueName}`);
      } catch (error) {
        logger.error(`Error closing worker for ${queueName}:`, error);
      }
    }

    this.deadLetterQueue.shutdown();
    await bullMQRegistry.shutdown();
    logger.info("✅ Bot Queue Service shutdown complete");
  }

  /**
   * Legacy compatibility method for processRequest
   */
  async processRequest(request: any): Promise<any> {
    logger.debug("Processing legacy request via BullMQ");

    // Check if Redis is available
    if (!bullMQRegistry.isAvailable()) {
      logger.warn("Cannot process request - Redis not available");
      return {
        success: false,
        error: "Queue system unavailable - Redis not connected",
        requestId: request.id,
        timestamp: Date.now(),
      };
    }

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
