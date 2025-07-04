import logger from "../logger.js";
import { DeadLetterQueue } from "../queue/DeadLetterQueue.js";
import { ProcessorFactory } from "../queue/processors/ProcessorFactory.js";
import type { SystemHealth, UnifiedRequest, UnifiedResponse } from "../queue/types.js";
import type Client from "../structures/Client.js";

export class UnifiedQueueService {
  private client: Client;
  public deadLetterQueue: DeadLetterQueue;
  private processorFactory: ProcessorFactory;
  private isShuttingDown = false;

  constructor(client: Client) {
    this.client = client;
    this.deadLetterQueue = new DeadLetterQueue(client);
    this.processorFactory = new ProcessorFactory(client);
  }

  initialize(): void {
    logger.info("Initializing Unified Queue Service...");
    logger.warn("Queue functionality moved to BullMQ - this service is deprecated");
    logger.info("✅ Unified Queue Service initialized (deprecated)");
  }

  processRequest(request: UnifiedRequest): UnifiedResponse {
    logger.warn("processRequest called - use BullMQ directly instead");
    return {
      success: false,
      error: "Queue functionality moved to BullMQ",
      requestId: request.id ?? "unknown",
      executionTime: 0,
      method: "queue",
      timestamp: Date.now(),
    };
  }

  getSystemHealth(): SystemHealth {
    logger.warn("getSystemHealth called - use BullMQ metrics instead");
    return {
      overall: false,
      protocols: {},
      redis: false,
      discord: false,
      websocket: false,
      overloaded: false,
      timestamp: Date.now(),
    };
  }

  getMetrics() {
    logger.warn("getMetrics called - use BullMQ metrics instead");
    return {
      workers: { activeWorkers: 0 },
      queues: {},
      message: "Queue functionality moved to BullMQ",
    };
  }

  isReady(): boolean {
    logger.warn("isReady called - use BullMQ health checks instead");
    return true;
  }

  shutdown(): void {
    if (this.isShuttingDown) return;
    this.isShuttingDown = true;

    logger.info("Shutting down Unified Queue Service...");
    logger.info("✅ Unified Queue Service shutdown complete");
  }
}
