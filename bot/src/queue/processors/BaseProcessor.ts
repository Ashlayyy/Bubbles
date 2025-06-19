import type { BaseJob } from "@shared/types/queue";
import logger from "../../logger.js";
import type Client from "../../structures/Client.js";

export interface ProcessorResult {
  success: boolean;
  data?: unknown;
  error?: string;
  timestamp: number;
}

export interface ProcessorContext {
  startTime: number;
  jobId: string;
  jobType: string;
  guildId?: string;
  userId?: string;
}

export abstract class BaseProcessor<T extends BaseJob> {
  protected client: Client;
  protected processorName: string;

  constructor(client: Client, processorName: string) {
    this.client = client;
    this.processorName = processorName;
  }

  /**
   * Abstract method that each processor must implement
   */
  abstract processJob(job: T): Promise<ProcessorResult>;

  /**
   * Get the job types this processor handles
   */
  abstract getJobTypes(): string[];

  /**
   * Main processing method with error handling and logging
   */
  async execute(job: T): Promise<ProcessorResult> {
    const context = this.createContext(job);

    try {
      // Validate job before processing
      this.validateJob(job);

      this.logStart(context);

      const result = await this.processJob(job);

      if (result.success) {
        this.logSuccess(context, result);
        this.sendSuccessNotification(job, result);
      } else {
        this.logError(context, result.error ?? "Unknown error");
        this.sendFailureNotification(job, result.error ?? "Unknown error");
      }

      return result;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Unknown error";
      this.logError(context, errorMessage, error);

      const failureResult: ProcessorResult = {
        success: false,
        error: errorMessage,
        timestamp: Date.now(),
      };

      this.sendFailureNotification(job, errorMessage);
      return failureResult;
    }
  }

  /**
   * Send success notification via WebSocket
   */
  protected sendSuccessNotification(job: T, result: ProcessorResult): void {
    if (!this.client.wsService || !job.guildId) return;

    try {
      this.client.wsService.sendDiscordEvent(
        `${this.getEventPrefix()}_COMPLETED`,
        {
          success: true,
          jobId: job.id,
          jobType: this.getJobTypeFromJob(job),
          data: result.data,
          timestamp: result.timestamp,
          guildId: job.guildId,
          userId: job.userId,
          ...this.getAdditionalEventData(job),
        },
        job.guildId
      );
    } catch (error) {
      logger.warn(`Failed to send success notification for ${this.processorName}:`, error);
    }
  }

  /**
   * Send failure notification via WebSocket
   */
  protected sendFailureNotification(job: T, error: string): void {
    if (!this.client.wsService || !job.guildId) return;

    try {
      this.client.wsService.sendDiscordEvent(
        `${this.getEventPrefix()}_FAILED`,
        {
          success: false,
          jobId: job.id,
          jobType: this.getJobTypeFromJob(job),
          error,
          timestamp: Date.now(),
          guildId: job.guildId,
          userId: job.userId,
          ...this.getAdditionalEventData(job),
        },
        job.guildId
      );
    } catch (wsError) {
      logger.warn(`Failed to send failure notification for ${this.processorName}:`, wsError);
    }
  }

  /**
   * Create processing context for logging and tracking
   */
  protected createContext(job: T): ProcessorContext {
    return {
      startTime: performance.now(),
      jobId: job.id,
      jobType: this.getJobTypeFromJob(job),
      guildId: job.guildId,
      userId: job.userId,
    };
  }

  /**
   * Log the start of job processing
   */
  protected logStart(context: ProcessorContext): void {
    logger.info(`${this.processorName}: Starting job processing`, {
      jobId: context.jobId,
      jobType: context.jobType,
      processor: this.processorName,
      guildId: context.guildId,
      userId: context.userId,
    });
  }

  /**
   * Log successful job completion
   */
  protected logSuccess(context: ProcessorContext, result: ProcessorResult): void {
    const executionTime = performance.now() - context.startTime;
    logger.info(`${this.processorName}: Job completed successfully`, {
      jobId: context.jobId,
      jobType: context.jobType,
      processor: this.processorName,
      executionTime: `${executionTime.toFixed(2)}ms`,
      hasData: !!result.data,
      guildId: context.guildId,
      userId: context.userId,
    });
  }

  /**
   * Log job processing error
   */
  protected logError(context: ProcessorContext, errorMessage: string, error?: unknown): void {
    const executionTime = performance.now() - context.startTime;
    logger.error(`${this.processorName}: Job processing failed`, {
      jobId: context.jobId,
      jobType: context.jobType,
      processor: this.processorName,
      executionTime: `${executionTime.toFixed(2)}ms`,
      error: errorMessage,
      guildId: context.guildId,
      userId: context.userId,
      ...(error ? { originalError: error } : {}),
    });
  }

  /**
   * Get the event prefix for WebSocket notifications
   * Override in subclasses for custom prefixes
   */
  protected getEventPrefix(): string {
    return this.processorName.replace("Processor", "").toUpperCase();
  }

  /**
   * Get job type from job object - override if needed
   */
  protected getJobTypeFromJob(job: T): string {
    return (job as { type?: string }).type ?? "UNKNOWN";
  }

  /**
   * Get additional event data for WebSocket notifications
   * Override in subclasses to add processor-specific data
   */
  protected getAdditionalEventData(job: T): Record<string, unknown> {
    return {
      guildId: job.guildId,
      userId: job.userId,
    };
  }

  /**
   * Validate job data - override in subclasses for specific validation
   */
  protected validateJob(job: T): void {
    if (!job.id) {
      throw new Error("Job ID is required");
    }
    if (!job.timestamp) {
      throw new Error("Job timestamp is required");
    }

    // Validate timestamps are reasonable
    const now = Date.now();
    const maxAge = 24 * 60 * 60 * 1000; // 24 hours
    if (job.timestamp < now - maxAge || job.timestamp > now + 60000) {
      logger.warn(`Job has unusual timestamp: ${job.timestamp} (now: ${now})`);
    }
  }

  /**
   * Safe guild fetching with proper error handling
   */
  protected async fetchGuild(guildId: string) {
    if (!guildId) {
      throw new Error("Guild ID is required");
    }

    try {
      const guild = await this.client.guilds.fetch(guildId);
      return guild;
    } catch (error) {
      throw new Error(`Failed to fetch guild ${guildId}: ${error instanceof Error ? error.message : "Unknown error"}`);
    }
  }

  /**
   * Safe user fetching with proper error handling
   */
  protected async fetchUser(userId: string) {
    if (!userId) {
      throw new Error("User ID is required");
    }

    try {
      const user = await this.client.users.fetch(userId);
      return user;
    } catch (error) {
      throw new Error(`Failed to fetch user ${userId}: ${error instanceof Error ? error.message : "Unknown error"}`);
    }
  }

  /**
   * Safe channel fetching with proper error handling
   */
  protected async fetchChannel(channelId: string) {
    if (!channelId) {
      throw new Error("Channel ID is required");
    }

    try {
      const channel = await this.client.channels.fetch(channelId);
      return channel;
    } catch (error) {
      throw new Error(
        `Failed to fetch channel ${channelId}: ${error instanceof Error ? error.message : "Unknown error"}`
      );
    }
  }
}
