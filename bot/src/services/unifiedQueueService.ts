import logger from "../logger.js";
import { DeadLetterQueue } from "../queue/DeadLetterQueue.js";
import { QueueWorkerService } from "../queue/QueueWorkerService.js";
import type { UnifiedRequest, UnifiedResponse } from "../queue/types.js";
import { executeBotAction } from "./botActionExecutor.js";
import type Client from "../structures/Client.js";

export class UnifiedQueueService {
  private workers: QueueWorkerService;
  public deadLetterQueue: DeadLetterQueue;
  private isShuttingDown = false;

  constructor(private client: Client) {
    this.workers = new QueueWorkerService(client);
    this.deadLetterQueue = new DeadLetterQueue(client);
  }

  initialize(): void {
    logger.info("Starting BullMQ workers for API dashboard jobs...");
    this.workers.start();
    logger.info("Queue workers ready");
  }

  async processRequest(request: UnifiedRequest): Promise<UnifiedResponse> {
    const started = Date.now();
    const result = await executeBotAction(this.client, {
      command: request.type,
      guildId: request.guildId,
      data: {
        ...request.data,
        guildId: request.guildId,
        userId: request.userId,
      },
    });
    return {
      success: result.success,
      requestId: request.id ?? `${request.type}-${started}`,
      data: result.data,
      error: result.error,
      executionTime: Date.now() - started,
      method: "queue",
      timestamp: Date.now(),
    };
  }

  getSystemHealth() {
    const ready = this.workers.isReady();
    return {
      overall: ready,
      protocols: { bullmq: ready },
      redis: ready,
      discord: true,
      websocket: this.clientHasWs(),
      overloaded: false,
      timestamp: Date.now(),
    };
  }

  private clientHasWs(): boolean {
    return true;
  }

  shutdown(): void {
    if (this.isShuttingDown) return;
    this.isShuttingDown = true;
    void this.workers.shutdown();
  }

  isReady(): boolean {
    return this.workers.isReady();
  }

  getMetrics() {
    return {
      workers: { activeWorkers: this.workers.isReady() ? 4 : 0 },
      queues: {
        "bot-commands": {},
        notifications: {},
        "critical-operations": {},
        "background-tasks": {},
      },
      message: "BullMQ workers consuming API jobs",
    };
  }
}
