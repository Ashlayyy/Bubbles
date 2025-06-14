import Bull from "bull";

import { QUEUE_NAMES } from "../../../shared/src/types/queue.js";
import logger from "../logger.js";
import type Client from "../structures/Client.js";
import queueManager from "./manager.js";
import { BaseProcessor } from "./processors/BaseProcessor.js";
import { ConfigProcessor } from "./processors/ConfigProcessor.js";
import { ModerationProcessor } from "./processors/ModerationProcessor.js";
import { MusicProcessor } from "./processors/MusicProcessor.js";

export class QueueProcessor {
  private client: Client;
  private processors: BaseProcessor[] = [];
  private isStarted = false;

  constructor(client: Client) {
    this.client = client;
    this.initializeProcessors();
  }

  private initializeProcessors(): void {
    // Initialize all event processors
    this.processors = [
      new ModerationProcessor(this.client),
      new MusicProcessor(this.client),
      new ConfigProcessor(this.client),
    ];
  }

  async start(): Promise<void> {
    if (this.isStarted) {
      logger.warn("Queue processors are already started");
      return;
    }

    logger.info("Starting queue processors...");

    try {
      const botCommandsQueue = queueManager.getQueue(QUEUE_NAMES.BOT_COMMANDS);

      // Test Redis connection first
      await this.testRedisConnection(botCommandsQueue);

      // Register all processors with the queue
      for (const processor of this.processors) {
        const jobType = processor.getJobType();

        // Register the processor with proper error handling
        void botCommandsQueue.process(jobType, async (job: Bull.Job) => {
          try {
            const result = await processor.processJob(job);

            if (!result.success) {
              // Job failed but was handled gracefully
              throw new Error(result.error ?? "Unknown processor error");
            }

            return result;
          } catch (error) {
            // Ensure errors are properly logged and re-thrown for Bull to handle
            logger.error(`Queue processor error for job type ${jobType}:`, error);
            throw error;
          }
        });

        logger.info(`Registered processor for job type: ${jobType}`);
      }

      this.isStarted = true;
      logger.info("Queue processors started successfully");
    } catch (error) {
      logger.error("Failed to start queue processors:", error);
      logger.warn("Queue system will operate in fallback mode - actions will be executed directly");
      // Don't throw error - allow bot to continue with fallback mode
      this.isStarted = false;
    }
  }

  private async testRedisConnection(queue: Bull.Queue): Promise<void> {
    try {
      // Try to get basic queue stats to test connection
      await queue.getWaiting();
      logger.info("Redis connection verified for queue processors");
    } catch (error) {
      logger.error("Redis connection test failed:", error);
      throw new Error("Cannot connect to Redis for queue processing");
    }
  }

  async stop(): Promise<void> {
    if (!this.isStarted) {
      logger.info("Queue processors are not running");
      return;
    }

    logger.info("Stopping queue processors...");
    try {
      await queueManager.closeAll();
      this.isStarted = false;
      logger.info("Queue processors stopped");
    } catch (error) {
      logger.error("Error stopping queue processors:", error);
    }
  }

  /**
   * Add a new processor to the system
   * This allows for easy extension of queue functionality
   */
  addProcessor(processor: BaseProcessor): void {
    this.processors.push(processor);
    logger.info(`Added new processor for job type: ${processor.getJobType()}`);
  }

  /**
   * Get list of registered processors
   */
  getProcessors(): BaseProcessor[] {
    return [...this.processors];
  }

  /**
   * Get processor by job type
   */
  getProcessor(jobType: string): BaseProcessor | undefined {
    return this.processors.find((p) => p.getJobType() === jobType);
  }

  /**
   * Check if queue processors are running
   */
  isRunning(): boolean {
    return this.isStarted;
  }

  /**
   * Get queue processor status
   */
  getStatus(): { running: boolean; processors: number; types: string[] } {
    return {
      running: this.isStarted,
      processors: this.processors.length,
      types: this.processors.map((p) => p.getJobType()),
    };
  }
}
