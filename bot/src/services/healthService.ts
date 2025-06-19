import { prisma } from "../database/index.js";
import logger from "../logger.js";
import type Client from "../structures/Client.js";

export interface BotHealthStatus {
  overall: "healthy" | "degraded" | "unhealthy";
  components: {
    discord: {
      status: "healthy" | "degraded" | "unhealthy";
      ping: number;
      guilds: number;
      users: number;
      shards?: number;
    };
    database: {
      status: "healthy" | "degraded" | "unhealthy";
      latency: number;
      lastCheck: number;
    };
    websocket: {
      status: "healthy" | "degraded" | "unhealthy";
      connected: boolean;
      authenticated: boolean;
      lastPing?: number;
    };
    queue: {
      status: "healthy" | "degraded" | "unhealthy";
      ready: boolean;
      processingJobs: number;
    };
    music: {
      status: "healthy" | "degraded" | "unhealthy";
      activeQueues: number;
      playingTracks: number;
    };
  };
  metrics: {
    uptime: number;
    memoryUsage: NodeJS.MemoryUsage;
    commandsProcessed: number;
    eventsProcessed: number;
  };
  timestamp: number;
}

class BotHealthService {
  private static instance: BotHealthService;
  private client: Client;
  private metrics = {
    commandsProcessed: 0,
    eventsProcessed: 0,
    startTime: Date.now(),
  };

  constructor(client: Client) {
    this.client = client;
    this.startHealthMonitoring();
  }

  static getInstance(client: Client): BotHealthService {
    BotHealthService.instance = new BotHealthService(client);
    return BotHealthService.instance;
  }

  async getHealthStatus(): Promise<BotHealthStatus> {
    const now = Date.now();

    // Check Discord connection
    const discordHealth = this.checkDiscordHealth();

    // Check database connection
    const databaseHealth = await this.checkDatabaseHealth();

    // Check WebSocket connection
    const websocketHealth = this.checkWebSocketHealth();

    // Check queue system
    const queueHealth = this.checkQueueHealth();

    // Check music system
    const musicHealth = this.checkMusicHealth();

    // Calculate overall health
    const components = {
      discord: discordHealth,
      database: databaseHealth,
      websocket: websocketHealth,
      queue: queueHealth,
      music: musicHealth,
    };

    const healthyComponents = Object.values(components).filter((c) => c.status === "healthy").length;
    const totalComponents = Object.keys(components).length;

    let overall: "healthy" | "degraded" | "unhealthy";
    if (healthyComponents === totalComponents) {
      overall = "healthy";
    } else if (healthyComponents >= totalComponents * 0.7) {
      overall = "degraded";
    } else {
      overall = "unhealthy";
    }

    return {
      overall,
      components,
      metrics: {
        uptime: now - this.metrics.startTime,
        memoryUsage: process.memoryUsage(),
        commandsProcessed: this.metrics.commandsProcessed,
        eventsProcessed: this.metrics.eventsProcessed,
      },
      timestamp: now,
    };
  }

  private checkDiscordHealth() {
    try {
      const ping = this.client.ws.ping;
      const guilds = this.client.guilds.cache.size;
      const users = this.client.users.cache.size;
      const shards = this.client.shard?.count;

      let status: "healthy" | "degraded" | "unhealthy";
      if (ping < 100 && this.client.isReady()) {
        status = "healthy";
      } else if (ping < 300 && this.client.isReady()) {
        status = "degraded";
      } else {
        status = "unhealthy";
      }

      return {
        status,
        ping,
        guilds,
        users,
        shards,
      };
    } catch (error) {
      logger.error("Discord health check failed:", error);
      return {
        status: "unhealthy" as const,
        ping: -1,
        guilds: 0,
        users: 0,
      };
    }
  }

  private async checkDatabaseHealth() {
    const startTime = Date.now();

    try {
      // Simple MongoDB query to test connection - count documents in any collection
      await prisma.guildConfig.count();
      const latency = Date.now() - startTime;

      return {
        status: latency < 100 ? ("healthy" as const) : ("degraded" as const),
        latency,
        lastCheck: Date.now(),
      };
    } catch (error) {
      logger.error("Database health check failed:", error);
      return {
        status: "unhealthy" as const,
        latency: Date.now() - startTime,
        lastCheck: Date.now(),
      };
    }
  }

  private checkWebSocketHealth() {
    try {
      const wsService = this.client.wsService;

      return {
        status: wsService?.isConnected() ? ("healthy" as const) : ("degraded" as const),
        connected: wsService?.isConnected() ?? false,
        authenticated: false, // Cannot access private property
      };
    } catch (error) {
      logger.error("WebSocket health check failed:", error);
      return {
        status: "unhealthy" as const,
        connected: false,
        authenticated: false,
      };
    }
  }

  private checkQueueHealth() {
    try {
      const queueService = this.client.queueService;

      return {
        status: queueService?.isReady() ? ("healthy" as const) : ("degraded" as const),
        ready: queueService?.isReady() ?? false,
        processingJobs: 0, // Would be implemented with actual queue metrics
      };
    } catch (error) {
      logger.error("Queue health check failed:", error);
      return {
        status: "unhealthy" as const,
        ready: false,
        processingJobs: 0,
      };
    }
  }

  private checkMusicHealth() {
    try {
      // Check music player status
      const activeQueues = 0; // Would be implemented with actual music queue count
      const playingTracks = 0; // Would be implemented with actual playing tracks count

      return {
        status: "healthy" as const,
        activeQueues,
        playingTracks,
      };
    } catch (error) {
      logger.error("Music health check failed:", error);
      return {
        status: "unhealthy" as const,
        activeQueues: 0,
        playingTracks: 0,
      };
    }
  }

  // Metric tracking methods
  incrementCommandsProcessed(): void {
    this.metrics.commandsProcessed++;
  }

  incrementEventsProcessed(): void {
    this.metrics.eventsProcessed++;
  }

  private startHealthMonitoring(): void {
    // Log health status every 1 minute
    setInterval(
      () => {
        this.getHealthStatus()
          .then((health) => {
            logger.info("Bot health status:", {
              overall: health.overall,
              discordPing: health.components.discord.ping,
              guilds: health.components.discord.guilds,
              uptime: Math.floor(health.metrics.uptime / 1000 / 60), // minutes
              memoryUsage: Math.floor(health.metrics.memoryUsage.rss / 1024 / 1024), // MB
            });

            // Send health status to API if WebSocket is connected
            if (this.client.wsService?.isConnected()) {
              this.client.wsService.sendDiscordEvent("BOT_HEALTH_STATUS", {
                health,
              });
            }
          })
          .catch((error: unknown) => {
            logger.error("Health monitoring error:", error);
          });
      },
      1 * 60 * 1000
    );

    logger.info("Bot health monitoring service started");
  }
}

export { BotHealthService };
