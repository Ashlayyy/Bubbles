import logger from "../logger.js";

export interface PerformanceMetric {
  eventType: string;
  processingTime: number;
  timestamp: number;
  guildId?: string;
  userId?: string;
  metadata?: Record<string, unknown>;
}

export interface PerformanceSummary {
  eventType: string;
  totalEvents: number;
  averageProcessingTime: number;
  slowEvents: number;
  slowEventPercentage: number;
  lastEventTime: number;
}

class PerformanceMonitor {
  private metrics: PerformanceMetric[] = [];
  private readonly maxMetrics = 1000; // Keep last 1000 metrics
  private readonly slowThreshold = 1000; // 1 second threshold

  /**
   * Record a performance metric
   */
  recordMetric(metric: PerformanceMetric): void {
    this.metrics.push(metric);

    // Keep only the last maxMetrics
    if (this.metrics.length > this.maxMetrics) {
      this.metrics = this.metrics.slice(-this.maxMetrics);
    }

    // Log slow events immediately
    if (metric.processingTime > this.slowThreshold) {
      logger.warn(`Slow event detected: ${metric.eventType}`, {
        processingTime: metric.processingTime,
        guildId: metric.guildId,
        userId: metric.userId,
        metadata: metric.metadata,
      });
    }
  }

  /**
   * Get performance summary for an event type
   */
  getEventSummary(eventType: string): PerformanceSummary | null {
    const eventMetrics = this.metrics.filter((m) => m.eventType === eventType);

    if (eventMetrics.length === 0) {
      return null;
    }

    const totalEvents = eventMetrics.length;
    const totalTime = eventMetrics.reduce((sum, m) => sum + m.processingTime, 0);
    const averageProcessingTime = totalTime / totalEvents;
    const slowEvents = eventMetrics.filter((m) => m.processingTime > this.slowThreshold).length;
    const slowEventPercentage = (slowEvents / totalEvents) * 100;
    const lastEventTime = Math.max(...eventMetrics.map((m) => m.timestamp));

    return {
      eventType,
      totalEvents,
      averageProcessingTime,
      slowEvents,
      slowEventPercentage,
      lastEventTime,
    };
  }

  /**
   * Get overall performance summary
   */
  getOverallSummary(): PerformanceSummary[] {
    const eventTypes = [...new Set(this.metrics.map((m) => m.eventType))];
    return eventTypes
      .map((eventType) => this.getEventSummary(eventType))
      .filter((summary): summary is PerformanceSummary => summary !== null)
      .sort((a, b) => b.totalEvents - a.totalEvents);
  }

  /**
   * Get slowest events
   */
  getSlowestEvents(limit = 10): PerformanceMetric[] {
    return this.metrics
      .filter((m) => m.processingTime > this.slowThreshold)
      .sort((a, b) => b.processingTime - a.processingTime)
      .slice(0, limit);
  }

  /**
   * Clear old metrics (older than 1 hour)
   */
  clearOldMetrics(): void {
    const oneHourAgo = Date.now() - 60 * 60 * 1000;
    this.metrics = this.metrics.filter((m) => m.timestamp > oneHourAgo);
  }

  /**
   * Log performance summary
   */
  logPerformanceSummary(): void {
    const summary = this.getOverallSummary();

    if (summary.length > 0) {
      logger.info("Performance Summary", {
        totalEvents: this.metrics.length,
        eventTypes: summary.length,
        slowEvents: this.metrics.filter((m) => m.processingTime > this.slowThreshold).length,
        topEvents: summary.slice(0, 5).map((s) => ({
          eventType: s.eventType,
          totalEvents: s.totalEvents,
          averageTime: Math.round(s.averageProcessingTime),
          slowPercentage: Math.round(s.slowEventPercentage),
        })),
      });
    }
  }

  /**
   * Get metrics for a specific time range
   */
  getMetricsInRange(startTime: number, endTime: number): PerformanceMetric[] {
    return this.metrics.filter((m) => m.timestamp >= startTime && m.timestamp <= endTime);
  }

  /**
   * Get real-time performance stats
   */
  getRealTimeStats(): {
    totalEvents: number;
    averageProcessingTime: number;
    slowEvents: number;
    slowEventPercentage: number;
  } {
    if (this.metrics.length === 0) {
      return {
        totalEvents: 0,
        averageProcessingTime: 0,
        slowEvents: 0,
        slowEventPercentage: 0,
      };
    }

    const totalEvents = this.metrics.length;
    const totalTime = this.metrics.reduce((sum, m) => sum + m.processingTime, 0);
    const averageProcessingTime = totalTime / totalEvents;
    const slowEvents = this.metrics.filter((m) => m.processingTime > this.slowThreshold).length;
    const slowEventPercentage = (slowEvents / totalEvents) * 100;

    return {
      totalEvents,
      averageProcessingTime,
      slowEvents,
      slowEventPercentage,
    };
  }
}

// Export singleton instance
export const performanceMonitor = new PerformanceMonitor();

// Start periodic cleanup and logging
setInterval(
  () => {
    performanceMonitor.clearOldMetrics();
  },
  5 * 60 * 1000
); // Every 5 minutes

setInterval(
  () => {
    performanceMonitor.logPerformanceSummary();
  },
  10 * 60 * 1000
); // Every 10 minutes

export default PerformanceMonitor;
