import type { BotCommandJob } from "@shared/types/queue";
import { randomUUID } from "crypto";
import { performance } from "perf_hooks";
import logger from "../logger.js";
import { WebSocketService } from "../services/websocketService.js";
import type Client from "../structures/Client.js";
import { CrossProtocolDeduplicator } from "./CrossProtocolDeduplicator.js";
import { ProtocolHealthMonitor } from "./ProtocolHealthMonitor.js";
import {
  AllStrategiesFailedError,
  CrossProtocolMetrics,
  JobPriority,
  NormalizedRequest,
  SystemHealth,
  UnifiedRequest,
  UnifiedResponse,
  ValidationError,
} from "./types.js";

export class UnifiedProcessor {
  private client: Client;
  private healthMonitor: ProtocolHealthMonitor;
  private deduplicator: CrossProtocolDeduplicator;
  private metrics: CrossProtocolMetrics;
  private isInitialized = false;
  private shutdownPromise: Promise<void> | null = null;

  constructor(client: Client) {
    this.client = client;
    this.healthMonitor = new ProtocolHealthMonitor(client);
    this.deduplicator = new CrossProtocolDeduplicator();
    this.metrics = this.initializeMetrics();
  }

  async initialize(): Promise<void> {
    if (this.isInitialized) {
      logger.warn("UnifiedProcessor already initialized");
      return;
    }

    try {
      logger.info("Initializing Unified Multi-Protocol Processor...");

      // Wait for health monitor to complete initial checks
      await this.healthMonitor.getSystemHealth();

      this.isInitialized = true;
      logger.info("Unified Multi-Protocol Processor initialized successfully");

      // Start metrics reporting
      this.startMetricsReporting();
    } catch (error) {
      logger.error("Failed to initialize UnifiedProcessor:", error);
      throw error;
    }
  }

  async processRequest(request: UnifiedRequest): Promise<UnifiedResponse> {
    if (!this.isInitialized) {
      throw new Error("UnifiedProcessor not initialized");
    }

    const startTime = performance.now();
    const normalizedRequest = this.normalizeRequest(request);

    try {
      // Validate request
      this.validateRequest(normalizedRequest);

      // Check for duplicates
      const deduplicationResult = await this.deduplicator.check(normalizedRequest);
      if (deduplicationResult.isDuplicate && deduplicationResult.existingResult) {
        logger.debug(`Returning cached result for request: ${normalizedRequest.id}`);
        this.metrics.duplicateOperations++;
        return deduplicationResult.existingResult;
      }

      // Create operation context for tracking
      const operationContext = this.deduplicator.createOperationContext(normalizedRequest);
      const operationKey = this.generateOperationKey(normalizedRequest);

      try {
        // Determine optimal protocol path
        const protocolPath = this.healthMonitor.getOptimalProtocolPath(normalizedRequest);
        logger.debug(`Selected protocol path for ${normalizedRequest.type}:`, protocolPath);

        // Execute with fallback strategy
        const result = await this.executeWithFallback(normalizedRequest, protocolPath);

        // Complete the operation
        this.deduplicator.completeOperation(operationKey, result);

        // Update metrics
        this.updateMetrics(normalizedRequest, result, performance.now() - startTime);

        return result;
      } catch (error) {
        // Fail the operation
        this.deduplicator.failOperation(operationKey, error as Error);
        throw error;
      }
    } catch (error) {
      const failureResult: UnifiedResponse = {
        success: false,
        requestId: normalizedRequest.id,
        error: error instanceof Error ? error.message : "Unknown error",
        executionTime: performance.now() - startTime,
        method: "direct",
        timestamp: Date.now(),
      };

      this.updateMetrics(normalizedRequest, failureResult, performance.now() - startTime);
      return failureResult;
    }
  }

  private normalizeRequest(request: UnifiedRequest): NormalizedRequest {
    const normalized: NormalizedRequest = {
      id: request.id ?? randomUUID(),
      type: request.type,
      data: request.data,
      source: request.source,
      userId: request.userId,
      guildId: request.guildId,
      timestamp: request.timestamp ?? Date.now(),
      priority: request.priority ?? "normal",
      requiresRealTime: request.requiresRealTime ?? false,
      requiresReliability: request.requiresReliability ?? false,
      timeout: request.timeout ?? 30000,
      metadata: request.metadata ?? {},
      operationKey: "",
    };

    normalized.operationKey = this.generateOperationKey(normalized);
    return normalized;
  }

  private generateOperationKey(request: NormalizedRequest): string {
    return `${request.type}:${request.guildId || "global"}:${request.userId || "system"}`;
  }

  private validateRequest(request: NormalizedRequest): void {
    if (!request.type) {
      throw new ValidationError("Request type is required", "type");
    }

    if (typeof request.data !== "object") {
      throw new ValidationError("Request data must be an object", "data");
    }

    if (!["rest", "websocket", "queue", "internal"].includes(request.source)) {
      throw new ValidationError("Invalid source protocol", "source");
    }

    if (!["critical", "high", "normal", "low"].includes(request.priority)) {
      throw new ValidationError("Invalid priority level", "priority");
    }
  }

  private async executeWithFallback(
    request: NormalizedRequest,
    protocolPath: { primary: string; fallback: string; reason: string }
  ): Promise<UnifiedResponse> {
    const attempts: { method: string; error: Error }[] = [];

    // Try primary protocol
    try {
      return await this.executeViaProtocol(request, protocolPath.primary);
    } catch (error) {
      attempts.push({ method: protocolPath.primary, error: error as Error });
      logger.warn(`Primary protocol ${protocolPath.primary} failed:`, error);
      this.metrics.totalProtocolFailures++;
    }

    // Try fallback protocol
    try {
      const result = await this.executeViaProtocol(request, protocolPath.fallback);
      logger.info(`Fallback protocol ${protocolPath.fallback} succeeded after ${protocolPath.primary} failed`);

      // Update fallback metrics
      if (protocolPath.primary === "websocket" && protocolPath.fallback === "queue") {
        this.metrics.websocketFallbackToQueue++;
      } else if (protocolPath.primary === "queue" && protocolPath.fallback === "websocket") {
        this.metrics.queueFallbackToWebSocket++;
      }

      return result;
    } catch (error) {
      attempts.push({ method: protocolPath.fallback, error: error as Error });
      logger.error(`Fallback protocol ${protocolPath.fallback} also failed:`, error);
      this.metrics.totalProtocolFailures++;
    }

    // All strategies failed
    throw new AllStrategiesFailedError(`All protocol strategies failed for request ${request.id}`, attempts);
  }

  private async executeViaProtocol(request: NormalizedRequest, protocol: string): Promise<UnifiedResponse> {
    const startTime = performance.now();

    switch (protocol) {
      case "bot-websocket":
        return await this.executeViaWebSocket(request);
      case "queue":
        return await this.executeViaQueue(request);
      case "direct":
        return await this.executeDirect(request);
      default:
        throw new Error(`Unknown protocol: ${protocol}`);
    }
  }

  private async executeViaWebSocket(request: NormalizedRequest): Promise<UnifiedResponse> {
    const wsService = this.client.wsService as unknown as WebSocketService & {
      sendRequest?: (req: NormalizedRequest) => Promise<unknown>;
    };
    if (!wsService.isConnected()) {
      throw new Error("WebSocket not connected");
    }

    const startTime = performance.now();

    try {
      // Send request via WebSocket
      const result: unknown = await wsService.sendRequest?.(request);

      return {
        success: true,
        requestId: request.id,
        data: result,
        executionTime: performance.now() - startTime,
        method: "websocket",
        timestamp: Date.now(),
      };
    } catch (error) {
      logger.error("WebSocket execution failed:", error);
      throw error;
    }
  }

  private async executeViaQueue(request: NormalizedRequest): Promise<UnifiedResponse> {
    try {
      const { QueueManager } = await import("@shared/queue");
      const queueManager = new QueueManager();

      if (!queueManager.isConnectionHealthy()) {
        throw new Error("Queue connection not healthy");
      }

      const startTime = performance.now();

      // Add job to queue
      const queue = queueManager.getQueue("bot-commands");
      const job = await queue.add(request.type, request.data, {
        priority: this.getPriorityValue(request.priority),
        attempts: 3,
        backoff: {
          type: "exponential",
          delay: 2000,
        },
        removeOnComplete: 10,
        removeOnFail: 5,
        timeout: request.timeout,
      });

      // Wait for job completion
      const result: unknown = await job.finished();

      return {
        success: true,
        requestId: request.id,
        data: result,
        executionTime: performance.now() - startTime,
        method: "queue",
        timestamp: Date.now(),
      };
    } catch (error) {
      logger.error("Queue execution failed:", error);
      throw error;
    }
  }

  private async executeDirect(request: NormalizedRequest): Promise<UnifiedResponse> {
    const startTime = performance.now();

    try {
      // Execute command directly through the bot's command system
      const result = await this.executeDirectCommand(request);

      return {
        success: true,
        requestId: request.id,
        data: result,
        executionTime: performance.now() - startTime,
        method: "direct",
        timestamp: Date.now(),
      };
    } catch (error) {
      logger.error("Direct execution failed:", error);
      throw error;
    }
  }

  private async executeDirectCommand(request: NormalizedRequest): Promise<unknown> {
    logger.info(`Executing direct command: ${request.type}`, {
      guildId: request.guildId,
      userId: request.userId,
      data: request.data,
    });

    // Use ProcessorFactory for all bot command jobs
    if (this.isProcessableJob(request.type)) {
      const { ProcessorFactory } = await import("./processors/ProcessorFactory.js");
      const processorFactory = new ProcessorFactory(this.client);

      const job = this.convertRequestToJob(request);
      const result = await processorFactory.processJob(job);

      if (result.success) {
        return {
          message: `${request.type} processed successfully`,
          data: result.data,
          timestamp: result.timestamp,
          success: true,
        };
      } else {
        throw new Error(result.error ?? "Processing failed");
      }
    }

    // Handle other direct commands
    switch (request.type) {
      case "DELETE_MESSAGE":
        return await this.executeDeleteMessage(request);
      default:
        logger.warn(`Unknown direct command type: ${request.type}`);
        return { message: "Unknown command type", timestamp: Date.now(), success: false };
    }
  }

  private isProcessableJob(type: string): boolean {
    const processableTypes = [
      "BAN_USER",
      "KICK_USER",
      "TIMEOUT_USER",
      "UNBAN_USER",
      "PLAY_MUSIC",
      "PAUSE_MUSIC",
      "SKIP_MUSIC",
      "STOP_MUSIC",
      "SET_VOLUME",
      "SEND_MESSAGE",
      "UPDATE_CONFIG",
      "END_GIVEAWAY",
      "REROLL_GIVEAWAY",
    ];
    return processableTypes.includes(type);
  }

  private convertRequestToJob(request: NormalizedRequest): BotCommandJob {
    const baseJob = {
      id: request.id,
      timestamp: request.timestamp,
      guildId: request.guildId,
      userId: request.userId,
    };

    // Map request data to job format based on type
    switch (request.type) {
      case "BAN_USER":
      case "KICK_USER":
      case "TIMEOUT_USER":
      case "UNBAN_USER":
        return {
          ...baseJob,
          type: request.type,
          targetUserId: (request.data.targetUserId ?? request.data.userId) as string,
          moderatorId: request.userId,
          reason: request.data.reason as string,
          duration: request.data.duration as number,
          caseId: request.data.caseId as string,
        } as BotCommandJob;

      case "PLAY_MUSIC":
      case "PAUSE_MUSIC":
      case "SKIP_MUSIC":
      case "STOP_MUSIC":
      case "SET_VOLUME":
        return {
          ...baseJob,
          type: request.type,
          query: request.data.query as string,
          volume: request.data.volume as number,
        } as BotCommandJob;

      case "SEND_MESSAGE":
        return {
          ...baseJob,
          type: request.type,
          channelId: request.data.channelId as string,
          content: request.data.content as string,
          embeds: request.data.embeds as unknown[],
        } as BotCommandJob;

      case "UPDATE_CONFIG":
        return {
          ...baseJob,
          type: request.type,
          configKey: request.data.configKey as string,
          configValue: request.data.configValue,
        } as BotCommandJob;

      case "END_GIVEAWAY":
      case "REROLL_GIVEAWAY":
        return {
          ...baseJob,
          type: request.type,
          giveawayId: request.data.giveawayId as string,
          giveawayDbId: request.data.giveawayDbId as string,
          messageId: request.data.messageId as string,
          channelId: request.data.channelId as string,
        } as BotCommandJob;

      default:
        return baseJob as BotCommandJob;
    }
  }

  private async executeSendMessage(request: NormalizedRequest): Promise<unknown> {
    try {
      const { channelId, content, embeds, components } = request.data;
      const channel = await this.client.channels.fetch(channelId as string);

      if (channel?.isTextBased() && "send" in channel) {
        const message = await channel.send({
          content: content as string,
          embeds: embeds as [],
          components: components as [],
        });
        return { messageId: message.id, success: true, timestamp: Date.now() };
      }

      throw new Error("Channel not found or not text-based");
    } catch (error) {
      logger.error("Failed to send message:", error);
      throw error;
    }
  }

  private async executeDeleteMessage(request: NormalizedRequest): Promise<unknown> {
    try {
      const { channelId, messageId } = request.data;
      const channel = await this.client.channels.fetch(channelId as string);

      if (channel?.isTextBased()) {
        const message = await channel.messages.fetch(messageId as string);
        await message.delete();
        return { success: true, timestamp: Date.now() };
      }

      throw new Error("Channel not found or not text-based");
    } catch (error) {
      logger.error("Failed to delete message:", error);
      throw error;
    }
  }

  private getPriorityValue(priority: JobPriority): number {
    switch (priority) {
      case "critical":
        return 1;
      case "high":
        return 2;
      case "normal":
        return 3;
      case "low":
        return 4;
      default:
        return 3;
    }
  }

  private updateMetrics(request: NormalizedRequest, result: UnifiedResponse, executionTime: number): void {
    // Update protocol-specific metrics
    switch (request.source) {
      case "rest":
        this.metrics.restRequests++;
        break;
      case "websocket":
        this.metrics.websocketMessages++;
        break;
      case "queue":
        this.metrics.queueJobs++;
        break;
    }

    // Update cross-protocol timing metrics
    if (request.source === "rest" && result.method === "websocket") {
      this.metrics.restToWebSocketDelay = executionTime;
    } else if (request.source === "queue" && result.method === "websocket") {
      this.metrics.queueToWebSocketDelay = executionTime;
    }
  }

  private initializeMetrics(): CrossProtocolMetrics {
    return {
      restRequests: 0,
      websocketMessages: 0,
      queueJobs: 0,
      restToWebSocketDelay: 0,
      queueToWebSocketDelay: 0,
      stateInconsistencies: 0,
      duplicateOperations: 0,
      orderingViolations: 0,
      websocketFallbackToQueue: 0,
      queueFallbackToWebSocket: 0,
      totalProtocolFailures: 0,
    };
  }

  private startMetricsReporting(): void {
    setInterval(() => {
      this.logMetrics();
    }, 300000); // Every 5 minutes
  }

  private logMetrics(): void {
    logger.info("Unified Processor Metrics:", {
      ...this.metrics,
      deduplicator: this.deduplicator.getMetrics(),
      timestamp: new Date().toISOString(),
    });
  }

  async getSystemHealth(): Promise<SystemHealth> {
    return await this.healthMonitor.getSystemHealth();
  }

  getMetrics(): CrossProtocolMetrics & { deduplicator: ReturnType<CrossProtocolDeduplicator["getMetrics"]> } {
    return {
      ...this.metrics,
      deduplicator: this.deduplicator.getMetrics(),
    };
  }

  isReady(): boolean {
    return this.isInitialized;
  }

  async shutdown(): Promise<void> {
    if (this.shutdownPromise) {
      return this.shutdownPromise;
    }

    this.shutdownPromise = this.performShutdown();
    return this.shutdownPromise;
  }

  private performShutdown(): Promise<void> {
    return new Promise((resolve, reject) => {
      try {
        logger.info("Shutting down Unified Multi-Protocol Processor...");

        // Shutdown components
        this.healthMonitor.shutdown();
        this.deduplicator.shutdown();

        this.isInitialized = false;
        logger.info("Unified Multi-Protocol Processor shutdown complete");
        resolve();
      } catch (error) {
        logger.error("Error during UnifiedProcessor shutdown:", error);
        reject(error instanceof Error ? error : new Error(String(error)));
      }
    });
  }
}
