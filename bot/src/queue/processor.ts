import { QUEUE_NAMES } from "../../../shared/src/types/queue.js";
import logger from "../logger.js";
import type Client from "../structures/Client.js";
import queueManager from "./manager.js";
import { BaseProcessor } from "./processors/BaseProcessor.js";
import { ConfigProcessor } from "./processors/ConfigProcessor.js";
import { GiveawayProcessor } from "./processors/GiveawayProcessor.js";
import { ModerationProcessor } from "./processors/ModerationProcessor.js";
import { MusicProcessor } from "./processors/MusicProcessor.js";

export class QueueProcessor {
  private client: Client;
  private processors: BaseProcessor[] = [];

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
      new GiveawayProcessor(this.client),
    ];
  }

  start(): void {
    logger.info("Starting queue processors...");

    const botCommandsQueue = queueManager.getQueue(QUEUE_NAMES.BOT_COMMANDS);

    // Register all processors with the queue
    for (const processor of this.processors) {
      const jobType = processor.getJobType();

      // Register the processor with proper error handling
      void botCommandsQueue.process(jobType, async (job) => {
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

    logger.info("Queue processors started successfully");
  }

  async stop(): Promise<void> {
    logger.info("Stopping queue processors...");
    await queueManager.closeAll();
    logger.info("Queue processors stopped");
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
}
