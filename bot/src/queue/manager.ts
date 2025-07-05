import logger from "../logger.js";
import type Client from "../structures/Client.js";
import { UnifiedProcessor } from "./UnifiedProcessor.js";
import type { SystemHealth, UnifiedRequest, UnifiedResponse } from "./types.js";

export class QueueManager {
  private processor: UnifiedProcessor;
  private client: Client;

  constructor(client: Client) {
    this.client = client;
    this.processor = new UnifiedProcessor(client);
  }

  async initialize(): Promise<void> {
    await this.processor.initialize();
    logger.info("Queue Manager initialized with Unified Processor");
  }

  async processRequest(request: UnifiedRequest): Promise<UnifiedResponse> {
    return await this.processor.processRequest(request);
  }

  async getSystemHealth(): Promise<SystemHealth> {
    return await this.processor.getSystemHealth();
  }

  getMetrics() {
    return this.processor.getMetrics();
  }

  isReady(): boolean {
    return this.processor.isReady();
  }

  async shutdown(): Promise<void> {
    await this.processor.shutdown();
    logger.info("Queue Manager shutdown complete");
  }
}
