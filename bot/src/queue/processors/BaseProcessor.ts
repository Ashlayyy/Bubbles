import type { Job } from "bull";
import logger from "../../logger.js";
import type Client from "../../structures/Client.js";

export interface ProcessorResult {
  success: boolean;
  jobId: string;
  data?: any;
  error?: string;
}

export abstract class BaseProcessor<T = any> {
  protected client: Client;
  protected processorName: string;

  constructor(client: Client, processorName: string) {
    this.client = client;
    this.processorName = processorName;
  }

  /**
   * Process a job of this processor's type
   * Can be sync or async depending on the processor's needs
   */
  abstract processJob(job: Job<T>): ProcessorResult | Promise<ProcessorResult>;

  /**
   * Get the job type this processor handles
   */
  abstract getJobType(): string;

  /**
   * Log successful job processing
   */
  protected logSuccess(jobId: string, message: string): void {
    logger.info(`[${this.processorName}] Successfully processed job ${jobId}: ${message}`);
  }

  /**
   * Log job processing errors
   */
  protected logError(jobId: string, error: any): void {
    logger.error(`[${this.processorName}] Failed to process job ${jobId}:`, error);
  }

  /**
   * Log job start
   */
  protected logStart(jobId: string, details: string): void {
    logger.info(`[${this.processorName}] Processing job ${jobId}: ${details}`);
  }
}
