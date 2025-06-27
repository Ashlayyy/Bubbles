import type { BotCommandJob } from "@shared/types/queue";
import logger from "../../logger.js";
import type Client from "../../structures/Client.js";
import { BaseProcessor, type ProcessorResult } from "./BaseProcessor.js";
import { ConfigProcessor } from "./ConfigProcessor.js";
import { GiveawayProcessor } from "./GiveawayProcessor.js";
import { MessageProcessor } from "./MessageProcessor.js";
import { ModerationProcessor } from "./ModerationProcessor.js";

export interface ProcessorStats {
  processorName: string;
  jobTypes: string[];
  totalJobTypes: number;
}

export interface ProcessorFactoryStats {
  totalProcessors: number;
  totalJobTypes: number;
  processors: ProcessorStats[];
  processorMap: Record<string, BaseProcessor<any>>;
}

export class ProcessorFactory {
  private processors = new Map<string, BaseProcessor<any>>();
  private client: Client;

  constructor(client: Client) {
    this.client = client;
    this.initializeProcessors();
  }

  private initializeProcessors(): void {
    const processorInstances = [
      new ModerationProcessor(this.client),
      new MessageProcessor(this.client),
      new ConfigProcessor(this.client),
      new GiveawayProcessor(this.client),
    ];

    for (const processor of processorInstances) {
      const jobTypes = processor.getJobTypes();
      for (const jobType of jobTypes) {
        this.processors.set(jobType, processor);
        logger.debug(`Registered processor for job type: ${jobType}`, {
          processor: processor.constructor.name,
        });
      }
    }

    logger.info(
      `ProcessorFactory initialized with ${processorInstances.length} processors for ${this.processors.size} job types`
    );
  }

  async processJob(job: BotCommandJob): Promise<ProcessorResult> {
    const jobType = this.getJobType(job);
    const processor = this.processors.get(jobType);

    if (!processor) {
      logger.error(`No processor found for job type: ${jobType}`, {
        jobId: job.id,
        availableTypes: Array.from(this.processors.keys()),
      });

      return {
        success: false,
        error: `No processor available for job type: ${jobType}`,
        timestamp: Date.now(),
      };
    }

    try {
      logger.debug(`Processing job with ${processor.constructor.name}`, {
        jobId: job.id,
        jobType,
      });

      return await processor.execute(job);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Unknown error";
      logger.error(`Processor execution failed for job type ${jobType}:`, {
        jobId: job.id,
        processor: processor.constructor.name,
        error: errorMessage,
      });

      return {
        success: false,
        error: `Processor execution failed: ${errorMessage}`,
        timestamp: Date.now(),
      };
    }
  }

  private getJobType(job: BotCommandJob): string {
    return (job as { type?: string }).type ?? "UNKNOWN";
  }

  getAvailableJobTypes(): string[] {
    return Array.from(this.processors.keys());
  }

  hasProcessorForJobType(jobType: string): boolean {
    return this.processors.has(jobType);
  }

  getProcessorStats(): ProcessorFactoryStats {
    const stats: Record<string, ProcessorStats> = {};
    const processorNames = new Set<string>();

    for (const [jobType, processor] of this.processors.entries()) {
      const processorName = processor.constructor.name;
      processorNames.add(processorName);

      stats[processorName] ??= {
        processorName,
        jobTypes: [],
        totalJobTypes: 0,
      };

      stats[processorName].jobTypes.push(jobType);
      stats[processorName].totalJobTypes++;
    }

    return {
      totalProcessors: processorNames.size,
      totalJobTypes: this.processors.size,
      processors: Object.values(stats),
      processorMap: Object.fromEntries(this.processors.entries()),
    };
  }

  shutdown(): void {
    logger.info("ProcessorFactory shutting down...");
    this.processors.clear();
    logger.info("ProcessorFactory shutdown complete");
  }
}
