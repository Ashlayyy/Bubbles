import logger from "../logger.js";
import { cacheService, type CacheStats } from "./cacheService.js";

/**
 * Metrics data structure
 */
interface MetricsData {
  timestamp: number;
  value: number;
  metadata?: Record<string, any>;
}

/**
 * API call metrics
 */
interface ApiMetrics {
  totalCalls: number;
  successfulCalls: number;
  failedCalls: number;
  averageResponseTime: number;
  cacheHits: number;
  cacheMisses: number;
  endpoints: Record<
    string,
    {
      calls: number;
      totalTime: number;
      errors: number;
      lastCalled: number;
    }
  >;
}

/**
 * Command execution metrics
 */
interface CommandMetrics {
  totalExecutions: number;
  successfulExecutions: number;
  failedExecutions: number;
  averageExecutionTime: number;
  commands: Record<
    string,
    {
      executions: number;
      totalTime: number;
      errors: number;
      lastExecuted: number;
    }
  >;
}

/**
 * Service health metrics
 */
interface ServiceHealthMetrics {
  apiHealth: boolean;
  cacheHealth: boolean;
  lastHealthCheck: number;
  uptime: number;
  memoryUsage: number;
}

/**
 * Metrics Service
 * Collects and provides performance metrics for monitoring
 */
class MetricsService {
  private apiMetrics: ApiMetrics;
  private commandMetrics: CommandMetrics;
  private serviceHealth: ServiceHealthMetrics;
  private startTime: number;
  private metricsHistory = new Map<string, MetricsData[]>();

  constructor() {
    this.startTime = Date.now();
    this.apiMetrics = {
      totalCalls: 0,
      successfulCalls: 0,
      failedCalls: 0,
      averageResponseTime: 0,
      cacheHits: 0,
      cacheMisses: 0,
      endpoints: {},
    };
    this.commandMetrics = {
      totalExecutions: 0,
      successfulExecutions: 0,
      failedExecutions: 0,
      averageExecutionTime: 0,
      commands: {},
    };
    this.serviceHealth = {
      apiHealth: true,
      cacheHealth: true,
      lastHealthCheck: Date.now(),
      uptime: 0,
      memoryUsage: 0,
    };

    // Update health metrics every 30 seconds
    setInterval(() => {
      this.updateHealthMetrics();
    }, 30000);
  }

  /**
   * Record API call metrics
   */
  recordApiCall(endpoint: string, responseTime: number, success: boolean, fromCache = false) {
    this.apiMetrics.totalCalls++;

    if (success) {
      this.apiMetrics.successfulCalls++;
    } else {
      this.apiMetrics.failedCalls++;
    }

    if (fromCache) {
      this.apiMetrics.cacheHits++;
    } else {
      this.apiMetrics.cacheMisses++;
    }

    // Update average response time
    this.apiMetrics.averageResponseTime =
      (this.apiMetrics.averageResponseTime * (this.apiMetrics.totalCalls - 1) + responseTime) /
      this.apiMetrics.totalCalls;

    // Update endpoint-specific metrics
    if (!this.apiMetrics.endpoints[endpoint]) {
      this.apiMetrics.endpoints[endpoint] = {
        calls: 0,
        totalTime: 0,
        errors: 0,
        lastCalled: Date.now(),
      };
    }

    const endpointMetrics = this.apiMetrics.endpoints[endpoint];
    endpointMetrics.calls++;
    endpointMetrics.totalTime += responseTime;
    endpointMetrics.lastCalled = Date.now();

    if (!success) {
      endpointMetrics.errors++;
    }

    // Record in history
    this.recordMetric(`api.${endpoint}`, responseTime, { success, fromCache });
  }

  /**
   * Record command execution metrics
   */
  recordCommandExecution(commandName: string, executionTime: number, success: boolean) {
    this.commandMetrics.totalExecutions++;

    if (success) {
      this.commandMetrics.successfulExecutions++;
    } else {
      this.commandMetrics.failedExecutions++;
    }

    // Update average execution time
    this.commandMetrics.averageExecutionTime =
      (this.commandMetrics.averageExecutionTime * (this.commandMetrics.totalExecutions - 1) + executionTime) /
      this.commandMetrics.totalExecutions;

    // Update command-specific metrics
    if (!this.commandMetrics.commands[commandName]) {
      this.commandMetrics.commands[commandName] = {
        executions: 0,
        totalTime: 0,
        errors: 0,
        lastExecuted: Date.now(),
      };
    }

    const commandMetrics = this.commandMetrics.commands[commandName];
    commandMetrics.executions++;
    commandMetrics.totalTime += executionTime;
    commandMetrics.lastExecuted = Date.now();

    if (!success) {
      commandMetrics.errors++;
    }

    // Record in history
    this.recordMetric(`command.${commandName}`, executionTime, { success });
  }

  /**
   * Get API metrics
   */
  getApiMetrics(): ApiMetrics {
    return { ...this.apiMetrics };
  }

  /**
   * Get command metrics
   */
  getCommandMetrics(): CommandMetrics {
    return { ...this.commandMetrics };
  }

  /**
   * Get service health metrics
   */
  getServiceHealth(): ServiceHealthMetrics {
    return { ...this.serviceHealth };
  }

  /**
   * Get cache statistics
   */
  async getCacheStats(): Promise<CacheStats> {
    const stats = await cacheService.getStats();
    return {
      totalKeys: stats.totalKeys,
      memoryUsage: stats.memoryUsage,
      hits: 0,
      misses: 0,
      hitRatio: 0,
    };
  }

  /**
   * Get top performing endpoints
   */
  getTopEndpoints(limit = 10): { endpoint: string; avgResponseTime: number; calls: number; errorRate: number }[] {
    return Object.entries(this.apiMetrics.endpoints)
      .map(([endpoint, metrics]) => ({
        endpoint,
        avgResponseTime: metrics.totalTime / metrics.calls,
        calls: metrics.calls,
        errorRate: metrics.errors / metrics.calls,
      }))
      .sort((a, b) => b.calls - a.calls)
      .slice(0, limit);
  }

  /**
   * Get top performing commands
   */
  getTopCommands(limit = 10): { command: string; avgExecutionTime: number; executions: number; errorRate: number }[] {
    return Object.entries(this.commandMetrics.commands)
      .map(([command, metrics]) => ({
        command,
        avgExecutionTime: metrics.totalTime / metrics.executions,
        executions: metrics.executions,
        errorRate: metrics.errors / metrics.executions,
      }))
      .sort((a, b) => b.executions - a.executions)
      .slice(0, limit);
  }

  /**
   * Get metric history
   */
  getMetricHistory(name: string, limit = 100): MetricsData[] {
    const history = this.metricsHistory.get(name) || [];
    return history.slice(-limit);
  }

  /**
   * Get comprehensive metrics summary
   */
  async getMetricsSummary() {
    const cacheStats = await this.getCacheStats();
    const now = Date.now();

    return {
      timestamp: now,
      uptime: now - this.startTime,
      api: {
        totalCalls: this.apiMetrics.totalCalls,
        successRate:
          this.apiMetrics.totalCalls > 0 ? (this.apiMetrics.successfulCalls / this.apiMetrics.totalCalls) * 100 : 0,
        averageResponseTime: this.apiMetrics.averageResponseTime,
        cacheHitRate:
          this.apiMetrics.totalCalls > 0 ? (this.apiMetrics.cacheHits / this.apiMetrics.totalCalls) * 100 : 0,
        topEndpoints: await this.getTopEndpoints(5),
      },
      commands: {
        totalExecutions: this.commandMetrics.totalExecutions,
        successRate:
          this.commandMetrics.totalExecutions > 0
            ? (this.commandMetrics.successfulExecutions / this.commandMetrics.totalExecutions) * 100
            : 0,
        averageExecutionTime: this.commandMetrics.averageExecutionTime,
        topCommands: await this.getTopCommands(5),
      },
      cache: {
        hitRatio: 0, // No longer available in new CacheStats
        totalKeys: cacheStats.totalKeys,
        memoryUsage: cacheStats.memoryUsage,
      },
      health: this.serviceHealth,
    };
  }

  /**
   * Record custom metric
   */
  recordMetric(name: string, value: number, metadata?: Record<string, any>) {
    const metric: MetricsData = {
      timestamp: Date.now(),
      value,
      metadata,
    };

    if (!this.metricsHistory.has(name)) {
      this.metricsHistory.set(name, []);
    }

    const history = this.metricsHistory.get(name)!;
    history.push(metric);

    // Keep only last 1000 entries per metric
    if (history.length > 1000) {
      history.shift();
    }
  }

  /**
   * Reset all metrics
   */
  resetMetrics() {
    this.apiMetrics = {
      totalCalls: 0,
      successfulCalls: 0,
      failedCalls: 0,
      averageResponseTime: 0,
      cacheHits: 0,
      cacheMisses: 0,
      endpoints: {},
    };
    this.commandMetrics = {
      totalExecutions: 0,
      successfulExecutions: 0,
      failedExecutions: 0,
      averageExecutionTime: 0,
      commands: {},
    };
    this.metricsHistory.clear();

    logger.info("Metrics reset");
  }

  /**
   * Update health metrics
   */
  private async updateHealthMetrics() {
    const now = Date.now();
    this.serviceHealth.uptime = now - this.startTime;
    this.serviceHealth.lastHealthCheck = now;

    // Update memory usage
    if (process.memoryUsage) {
      const memUsage = process.memoryUsage();
      this.serviceHealth.memoryUsage = memUsage.heapUsed;
    }

    // Check cache health
    try {
      const cacheStats = await cacheService.getStats();
      this.serviceHealth.cacheHealth = cacheStats.totalKeys >= 0;
    } catch (error) {
      this.serviceHealth.cacheHealth = false;
    }

    // Log health metrics periodically
    if (now % (5 * 60 * 1000) < 30000) {
      // Every 5 minutes
      logger.info("Health metrics update", {
        uptime: this.serviceHealth.uptime,
        memoryUsage: this.serviceHealth.memoryUsage,
        cacheHealth: this.serviceHealth.cacheHealth,
        apiHealth: this.serviceHealth.apiHealth,
      });
    }
  }
}

// Export singleton instance
export const metricsService = new MetricsService();

// Export class for testing
export { MetricsService };
