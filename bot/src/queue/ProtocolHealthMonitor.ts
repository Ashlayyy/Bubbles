import { performance } from "perf_hooks";
import logger from "../logger.js";
import type Client from "../structures/Client.js";
import { CircuitBreaker } from "./CircuitBreaker.js";
import type { NormalizedRequest, ProtocolHealthStatus, ProtocolPath, SystemHealth } from "./types.js";

export class ProtocolHealthMonitor {
  private client: Client;
  private protocolBreakers = new Map<string, CircuitBreaker>();
  private healthCache = new Map<string, ProtocolHealthStatus>();
  private lastHealthCheck = 0;
  private readonly healthCacheTTL = 5000; // 5 seconds

  constructor(client: Client) {
    this.client = client;
    this.initializeCircuitBreakers();
    this.startHealthMonitoring();
  }

  private initializeCircuitBreakers(): void {
    const protocols = ["redis", "discord-api", "bot-websocket", "frontend-websocket", "queue-processor"];

    protocols.forEach((protocol) => {
      const breaker = new CircuitBreaker(() => this.performHealthCheck(protocol), protocol, {
        failureThreshold: 3,
        recoveryTimeout: 15000,
        monitorInterval: 30000,
      });
      this.protocolBreakers.set(protocol, breaker);
    });

    logger.info(`Initialized circuit breakers for ${protocols.length} protocols`);
  }

  async getSystemHealth(): Promise<SystemHealth> {
    const now = Date.now();

    // Use cached health if recent
    if (now - this.lastHealthCheck < this.healthCacheTTL) {
      return this.buildSystemHealthFromCache();
    }

    // Perform fresh health checks
    const healthPromises = Array.from(this.protocolBreakers.entries()).map(async ([protocol, breaker]) => {
      try {
        const startTime = performance.now();
        await breaker.call();
        const latency = performance.now() - startTime;

        const status: ProtocolHealthStatus = {
          protocol,
          healthy: true,
          latency,
          lastCheck: now,
          errorRate: this.calculateErrorRate(protocol),
          circuitBreakerState: breaker.getStatus().state,
        };

        this.healthCache.set(protocol, status);
        return status;
      } catch (error) {
        const status: ProtocolHealthStatus = {
          protocol,
          healthy: false,
          lastCheck: now,
          errorRate: this.calculateErrorRate(protocol),
          circuitBreakerState: breaker.getStatus().state,
        };

        this.healthCache.set(protocol, status);
        logger.warn(`Protocol ${protocol} health check failed:`, error);
        return status;
      }
    });

    const healthResults = await Promise.allSettled(healthPromises);
    this.lastHealthCheck = now;

    return this.buildSystemHealth(healthResults);
  }

  private async performHealthCheck(protocol: string): Promise<void> {
    switch (protocol) {
      case "redis":
        await this.checkRedisHealth();
        break;
      case "discord-api":
        await this.checkDiscordAPIHealth();
        break;
      case "bot-websocket":
        await this.checkBotWebSocketHealth();
        break;
      case "frontend-websocket":
        await this.checkFrontendWebSocketHealth();
        break;
      case "queue-processor":
        await this.checkQueueProcessorHealth();
        break;
      default:
        throw new Error(`Unknown protocol: ${protocol}`);
    }
  }

  private async checkRedisHealth(): Promise<void> {
    try {
      const { QueueManager } = await import("@shared/queue");
      const queueManager = new QueueManager();

      if (!queueManager.isConnectionHealthy()) {
        throw new Error("Redis connection not healthy");
      }

      // Test with actual operation
      await queueManager.testConnection();
    } catch (error) {
      throw new Error(`Redis health check failed: ${error instanceof Error ? error.message : "Unknown error"}`);
    }
  }

  private async checkDiscordAPIHealth(): Promise<void> {
    try {
      // Test Discord API by fetching bot user
      await this.client.user?.fetch();
    } catch (error) {
      throw new Error(`Discord API health check failed: ${error instanceof Error ? error.message : "Unknown error"}`);
    }
  }

  private checkBotWebSocketHealth(): Promise<void> {
    return new Promise((resolve, reject) => {
      const wsService = this.client.wsService as { isConnected?: () => boolean } | null;
      if (!wsService?.isConnected?.()) {
        reject(new Error("Bot WebSocket not connected"));
      } else {
        resolve();
      }
    });
  }

  private checkFrontendWebSocketHealth(): Promise<void> {
    return new Promise((resolve, reject) => {
      // This would need to be implemented based on your frontend WebSocket monitoring
      // For now, we'll assume it's healthy if the service exists
      if (!this.client.wsService) {
        reject(new Error("Frontend WebSocket service not available"));
      } else {
        resolve();
      }
    });
  }

  private async checkQueueProcessorHealth(): Promise<void> {
    // Check if queue processors are responsive
    try {
      const { QueueManager } = await import("@shared/queue");
      const queueManager = new QueueManager();
      await queueManager.getQueueStats("bot-commands");
    } catch (error) {
      throw new Error(
        `Queue processor health check failed: ${error instanceof Error ? error.message : "Unknown error"}`
      );
    }
  }

  private calculateErrorRate(protocol: string): number {
    const breaker = this.protocolBreakers.get(protocol);
    if (!breaker) return 0;

    const status = breaker.getStatus();
    return status.errorRate;
  }

  private buildSystemHealthFromCache(): SystemHealth {
    const protocols: Record<string, ProtocolHealthStatus> = {};
    let overallHealthy = true;

    this.healthCache.forEach((status, protocol) => {
      protocols[protocol] = status;
      if (!status.healthy) {
        overallHealthy = false;
      }
    });

    return {
      overall: overallHealthy,
      protocols,
      redis: protocols.redis.healthy || false,
      discord: protocols["discord-api"].healthy || false,
      websocket: protocols["bot-websocket"].healthy || false,
      overloaded: this.isSystemOverloaded(),
      timestamp: Date.now(),
    };
  }

  private buildSystemHealth(healthResults: PromiseSettledResult<ProtocolHealthStatus>[]): SystemHealth {
    const protocols: Record<string, ProtocolHealthStatus> = {};
    let overallHealthy = true;

    healthResults.forEach((result) => {
      if (result.status === "fulfilled") {
        protocols[result.value.protocol] = result.value;
        if (!result.value.healthy) {
          overallHealthy = false;
        }
      }
    });

    return {
      overall: overallHealthy,
      protocols,
      redis: protocols.redis.healthy || false,
      discord: protocols["discord-api"].healthy || false,
      websocket: protocols["bot-websocket"].healthy || false,
      overloaded: this.isSystemOverloaded(),
      timestamp: Date.now(),
    };
  }

  private isSystemOverloaded(): boolean {
    // Simple CPU and memory check
    const memUsage = process.memoryUsage();
    const memUsageMB = memUsage.heapUsed / 1024 / 1024;

    // Consider system overloaded if:
    // - Memory usage > 500MB
    // - Multiple circuit breakers are open
    const openBreakers = Array.from(this.protocolBreakers.values()).filter(
      (breaker) => breaker.getStatus().state === "OPEN"
    ).length;

    return memUsageMB > 500 || openBreakers >= 2;
  }

  getOptimalProtocolPath(request: NormalizedRequest): ProtocolPath {
    const health = this.buildSystemHealthFromCache();

    // For real-time requirements
    if (request.requiresRealTime) {
      if (health.websocket) {
        return {
          primary: "bot-websocket",
          fallback: "direct",
          reason: "Real-time requirement with healthy WebSocket",
        };
      } else {
        return {
          primary: "direct",
          fallback: "queue",
          reason: "Real-time requirement but WebSocket unhealthy",
        };
      }
    }

    // For reliability requirements
    if (request.requiresReliability) {
      if (health.redis) {
        return {
          primary: "queue",
          fallback: "bot-websocket",
          reason: "Reliability requirement with healthy Redis",
        };
      } else {
        return {
          primary: "bot-websocket",
          fallback: "direct",
          reason: "Reliability requirement but Redis unhealthy",
        };
      }
    }

    // Default path based on overall health
    if (health.overall) {
      return {
        primary: health.redis ? "queue" : "bot-websocket",
        fallback: health.redis ? "bot-websocket" : "direct",
        reason: "Normal operation with healthy systems",
      };
    } else {
      return {
        primary: "direct",
        fallback: "queue",
        reason: "Degraded mode due to system health issues",
      };
    }
  }

  private startHealthMonitoring(): void {
    // Periodic health summary
    setInterval(() => {
      this.logHealthSummary();
    }, 60000); // Every minute

    logger.info("Protocol health monitoring started");
  }

  private logHealthSummary(): void {
    const summary = this.buildSystemHealthFromCache();
    const healthyProtocols = Object.values(summary.protocols).filter((p) => p.healthy).length;
    const totalProtocols = Object.keys(summary.protocols).length;

    logger.info("System health summary:", {
      overall: summary.overall,
      healthyProtocols: `${healthyProtocols}/${totalProtocols}`,
      overloaded: summary.overloaded,
      protocols: Object.fromEntries(
        Object.entries(summary.protocols).map(([name, status]) => [
          name,
          { healthy: status.healthy, state: status.circuitBreakerState },
        ])
      ),
    });
  }

  shutdown(): void {
    logger.info("Shutting down protocol health monitor...");
    // Clear any intervals or cleanup resources
    logger.info("Protocol health monitor shutdown complete");
  }
}
