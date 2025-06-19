import { QueueManager as SharedQueueManager } from "@shared/queue";
import type { BotCommandJob } from "@shared/types/queue";
import Bull from "bull";
import logger from "../logger.js";
import { DeadLetterQueue } from "../queue/DeadLetterQueue.js";
import { QueueManager } from "../queue/manager.js";
import { ProcessorFactory } from "../queue/processors/ProcessorFactory.js";
import type { SystemHealth, UnifiedRequest, UnifiedResponse } from "../queue/types.js";
import type Client from "../structures/Client.js";

export class UnifiedQueueService {
  private queueManager: QueueManager;
  private sharedQueueManager: SharedQueueManager;
  private processorFactory: ProcessorFactory;
  private deadLetterQueue: DeadLetterQueue;
  private client: Client;
  private workers = new Map<string, Bull.Queue>();
  private isInitialized = false;
  private workersStarted = false;

  constructor(client: Client) {
    this.client = client;
    this.queueManager = new QueueManager(client);
    this.sharedQueueManager = new SharedQueueManager();
    this.processorFactory = new ProcessorFactory(client);
    this.deadLetterQueue = new DeadLetterQueue(client);
  }

  async initialize(): Promise<void> {
    if (this.isInitialized) {
      logger.warn("UnifiedQueueService already initialized");
      return;
    }

    try {
      // Initialize the unified processor
      await this.queueManager.initialize();

      // Start queue workers if Redis is available
      await this.startQueueWorkers();

      this.isInitialized = true;
      logger.info("UnifiedQueueService initialized successfully");
    } catch (error) {
      logger.error("Failed to initialize UnifiedQueueService:", error);
      throw error;
    }
  }

  private async startQueueWorkers(): Promise<void> {
    try {
      // Test Redis connection first
      const connectionHealthy = await this.sharedQueueManager.testConnection();
      if (!connectionHealthy) {
        logger.warn("Redis connection not healthy, queue workers will not start");
        return;
      }

      const queues = ["bot-commands", "bot-events", "notifications"];

      for (const queueName of queues) {
        this.startWorker(queueName);
      }

      this.workersStarted = true;
      logger.info("Queue workers started successfully");
    } catch (error) {
      logger.error("Failed to start queue workers:", error);
      // Don't throw error - service can still work without workers
    }
  }

  private startWorker(queueName: string): void {
    try {
      // Use type assertion for queue name
      const queue = this.sharedQueueManager.getQueue(queueName as "bot-commands");
      this.workers.set(queueName, queue);

      // Set up job processing - void to ignore promise
      void queue.process("*", async (job: Bull.Job<BotCommandJob>) => {
        return await this.processQueueJob(job);
      });

      // Set up event listeners with proper typing
      queue.on("completed", (job: Bull.Job<BotCommandJob>, result: unknown) => {
        const resultObj = result as { success?: boolean };
        logger.info(`Job ${job.id} completed in ${queueName}`, {
          jobId: job.id,
          jobType: job.data.type,
          processingTime: job.finishedOn && job.processedOn ? job.finishedOn - job.processedOn : 0,
          result: resultObj.success ? "success" : "failure",
        });

        this.sendJobCompletionNotification(job, result, true);
      });

      queue.on("failed", (job: Bull.Job<BotCommandJob>, error: Error) => {
        logger.error(`Job ${job.id} failed in ${queueName}:`, {
          jobId: job.id,
          jobType: job.data.type,
          attempts: job.attemptsMade,
          maxAttempts: job.opts.attempts,
          error: error.message,
        });

        // Handle failed job with dead letter queue if it's exhausted all retries
        if (job.attemptsMade >= (job.opts.attempts ?? 3)) {
          this.deadLetterQueue.handleFailedJob(job, error);
        }

        this.sendJobCompletionNotification(job, { error: error.message }, false);
      });

      queue.on("stalled", (job: Bull.Job<BotCommandJob>) => {
        logger.warn(`Job ${job.id} stalled in ${queueName}`, {
          jobId: job.id,
          jobType: job.data.type,
        });
      });

      queue.on("active", (job: Bull.Job<BotCommandJob>) => {
        logger.debug(`Job ${job.id} started processing in ${queueName}`, {
          jobId: job.id,
          jobType: job.data.type,
        });
      });

      logger.info(`Started worker for queue: ${queueName}`);
    } catch (error) {
      logger.error(`Failed to start worker for ${queueName}:`, error);
      // Don't throw - continue with other workers
    }
  }

  private async processQueueJob(job: Bull.Job<BotCommandJob>): Promise<unknown> {
    const jobData = job.data;

    logger.info(`Processing queue job ${job.id}`, {
      jobId: job.id,
      jobType: jobData.type,
      guildId: jobData.guildId,
      userId: jobData.userId,
    });

    try {
      // Use the processor factory to handle the job
      const result = await this.processorFactory.processJob(jobData);

      if (result.success) {
        logger.info(`Queue job ${job.id} processed successfully`);
      } else {
        logger.error(`Queue job ${job.id} processing failed:`, {
          jobId: job.id,
          error: result.error,
        });
      }

      return result;
    } catch (error) {
      logger.error(`Exception during queue job ${job.id} processing:`, error);
      throw error; // Re-throw to mark job as failed
    }
  }

  private sendJobCompletionNotification(job: Bull.Job<BotCommandJob>, result: unknown, success: boolean): void {
    if (!this.client.wsService || !job.data.guildId) return;

    try {
      this.client.wsService.sendDiscordEvent(
        success ? "JOB_COMPLETED" : "JOB_FAILED",
        {
          jobId: job.id,
          jobType: job.data.type,
          success,
          result: success ? result : undefined,
          error: success ? undefined : (result as { error?: string }).error,
          guildId: job.data.guildId,
          userId: job.data.userId,
          processingTime: job.finishedOn && job.processedOn ? job.finishedOn - job.processedOn : 0,
          attempts: job.attemptsMade,
          timestamp: Date.now(),
        },
        job.data.guildId
      );
    } catch (error) {
      logger.warn("Failed to send job completion notification:", error);
    }
  }

  async processRequest(request: UnifiedRequest): Promise<UnifiedResponse> {
    if (!this.isInitialized) {
      throw new Error("UnifiedQueueService not initialized");
    }

    return await this.queueManager.processRequest(request);
  }

  async getHealth(): Promise<SystemHealth> {
    if (!this.isInitialized) {
      throw new Error("UnifiedQueueService not initialized");
    }

    return await this.queueManager.getSystemHealth();
  }

  getMetrics() {
    if (!this.isInitialized) {
      throw new Error("UnifiedQueueService not initialized");
    }

    return {
      ...this.queueManager.getMetrics(),
      workers: {
        started: this.workersStarted,
        activeWorkers: this.workers.size,
        queues: Array.from(this.workers.keys()),
        redisHealthy: this.sharedQueueManager.isConnectionHealthy(),
      },
      deadLetterQueue: this.deadLetterQueue.getDeadLetterStats(),
    };
  }

  isReady(): boolean {
    return this.isInitialized && this.queueManager.isReady();
  }

  async shutdown(): Promise<void> {
    if (!this.isInitialized) {
      return;
    }

    try {
      // Stop queue workers first
      if (this.workersStarted) {
        logger.info("Stopping queue workers...");

        const stopPromises = Array.from(this.workers.values()).map(async (queue) => {
          try {
            await queue.close();
          } catch (error) {
            logger.error("Error closing queue:", error);
          }
        });

        await Promise.all(stopPromises);
        this.workers.clear();
        this.workersStarted = false;
      }

      // Close shared queue manager
      await this.sharedQueueManager.closeAll();

      // Shutdown unified processor
      await this.queueManager.shutdown();

      // Shutdown dead letter queue
      this.deadLetterQueue.shutdown();

      this.isInitialized = false;
      logger.info("UnifiedQueueService shutdown complete");
    } catch (error) {
      logger.error("Error during UnifiedQueueService shutdown:", error);
      throw error;
    }
  }

  // Dead Letter Queue management methods
  getDeadLetterStats() {
    return this.deadLetterQueue.getDeadLetterStats();
  }

  getQuarantinedJobs() {
    return this.deadLetterQueue.getQuarantinedJobs();
  }

  releaseFromQuarantine(jobId: string): boolean {
    return this.deadLetterQueue.releaseFromQuarantine(jobId);
  }

  clearDeadLetterQueue(): number {
    return this.deadLetterQueue.clearDeadLetterQueue();
  }
}
