import { Worker, type Job } from "bullmq";
import logger from "../logger.js";
import { executeBotAction, normalizeQueueJob } from "../services/botActionExecutor.js";
import type Client from "../structures/Client.js";
import { ProcessorFactory } from "./processors/ProcessorFactory.js";

const QUEUE_NAMES = [
  "bot-commands",
  "notifications",
  "critical-operations",
  "background-tasks",
] as const;

function workerConnection() {
  return {
    host: process.env.REDIS_HOST || "localhost",
    port: parseInt(process.env.REDIS_PORT || "6379", 10),
    password: process.env.REDIS_PASSWORD || undefined,
    maxRetriesPerRequest: null as null,
  };
}

export class QueueWorkerService {
  private workers: Worker[] = [];
  private processorFactory: ProcessorFactory;

  constructor(private client: Client) {
    this.processorFactory = new ProcessorFactory(client);
  }

  start(): void {
    for (const name of QUEUE_NAMES) {
      const worker = new Worker(name, (job) => this.handleJob(job), {
        connection: workerConnection(),
        concurrency: 4,
      });

      worker.on("failed", (job, error) => {
        logger.error(`Queue job failed in ${name}`, {
          jobId: job?.id,
          error: error.message,
        });
      });

      worker.on("error", (error) => {
        logger.warn(`Queue worker error on ${name}: ${error.message}`);
      });

      this.workers.push(worker);
      logger.info(`BullMQ worker listening on ${name}`);
    }
  }

  private async handleJob(job: Job): Promise<unknown> {
    const raw = (job.data && typeof job.data === "object" ? job.data : {}) as Record<string, unknown>;
    const action = normalizeQueueJob(raw, job.id ?? `${job.name}-${Date.now()}`);

    if (this.processorFactory.hasProcessorForJobType(action.command)) {
      const typedJob = {
        id: String(job.id ?? action.data.id ?? Date.now()),
        timestamp: Number(action.data.timestamp) || Date.now(),
        type: action.command,
        guildId: action.guildId,
        ...action.data,
      };
      const result = await this.processorFactory.processJob(typedJob as never);
      if (!result.success && result.error?.includes("Voice playback")) {
        return result;
      }
      if (!result.success) {
        throw new Error(result.error ?? "Job failed");
      }
      return result;
    }

    const result = await executeBotAction(this.client, action);
    if (!result.success && result.error?.includes("Voice playback")) {
      return result;
    }
    if (!result.success) {
      throw new Error(result.error ?? "Job failed");
    }
    return result;
  }

  async shutdown(): Promise<void> {
    await Promise.all(this.workers.map((worker) => worker.close()));
    this.workers = [];
    this.processorFactory.shutdown();
  }

  isReady(): boolean {
    return this.workers.length > 0;
  }
}
