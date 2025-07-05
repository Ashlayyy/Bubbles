import type { BotCommandJob } from "@shared/types/queue";
import type Bull from "bull";
import logger from "../logger.js";
import type Client from "../structures/Client.js";

export interface DeadLetterEntry {
  id: string;
  originalJobId: string;
  jobData: BotCommandJob;
  failureReason: string;
  failureCount: number;
  firstFailure: number;
  lastFailure: number;
  errorHistory: {
    timestamp: number;
    error: string;
    attempt: number;
  }[];
  isPoisonPill: boolean;
  quarantined: boolean;
  classification: "retryable" | "non-retryable" | "poison" | "unknown";
}

export interface PoisonPillPattern {
  errorPattern: RegExp;
  jobTypePattern?: RegExp;
  threshold: number;
  timeWindow: number; // milliseconds
}

export class DeadLetterQueue {
  private client: Client;
  private deadLetterStore = new Map<string, DeadLetterEntry>();
  private poisonPillPatterns: PoisonPillPattern[] = [];
  private quarantineStore = new Map<string, DeadLetterEntry>();
  private cleanupInterval: NodeJS.Timeout | null = null;
  private maxRetentionTime = 7 * 24 * 60 * 60 * 1000; // 7 days
  private maxDeadLetterSize = 10000;

  constructor(client: Client) {
    this.client = client;
    this.initializePoisonPillPatterns();
    this.startCleanupProcess();
  }

  private initializePoisonPillPatterns(): void {
    this.poisonPillPatterns = [
      // Validation errors - usually poison pills
      {
        errorPattern: /validation|invalid|malformed|parsing/i,
        threshold: 2,
        timeWindow: 5 * 60 * 1000, // 5 minutes
      },
      // Permission errors - might be poison pills if persistent
      {
        errorPattern: /permission|forbidden|unauthorized|access denied/i,
        threshold: 5,
        timeWindow: 30 * 60 * 1000, // 30 minutes
      },
      // Discord API specific errors
      {
        errorPattern: /unknown (user|channel|guild|message)/i,
        threshold: 3,
        timeWindow: 10 * 60 * 1000, // 10 minutes
      },
      // Rate limit related - not poison pills, but need special handling
      {
        errorPattern: /rate limit|too many requests/i,
        threshold: 10,
        timeWindow: 60 * 60 * 1000, // 1 hour
      },
      // Generic application errors that repeat
      {
        errorPattern: /.*/, // Catch-all
        threshold: 8,
        timeWindow: 60 * 60 * 1000, // 1 hour
      },
    ];
  }

  handleFailedJob(job: Bull.Job<BotCommandJob>, error: Error): void {
    const jobKey = this.generateJobKey(job);
    const now = Date.now();

    try {
      let entry = this.deadLetterStore.get(jobKey);

      if (!entry) {
        entry = {
          id: jobKey,
          originalJobId: job.id.toString() || "unknown",
          jobData: job.data,
          failureReason: error.message,
          failureCount: 1,
          firstFailure: now,
          lastFailure: now,
          errorHistory: [
            {
              timestamp: now,
              error: error.message,
              attempt: job.attemptsMade || 1,
            },
          ],
          isPoisonPill: false,
          quarantined: false,
          classification: this.classifyError(error),
        };
      } else {
        entry.failureCount++;
        entry.lastFailure = now;
        entry.failureReason = error.message;
        entry.errorHistory.push({
          timestamp: now,
          error: error.message,
          attempt: job.attemptsMade || 1,
        });

        // Keep only last 10 error entries to prevent memory bloat
        if (entry.errorHistory.length > 10) {
          entry.errorHistory = entry.errorHistory.slice(-10);
        }
      }

      // Check if this is a poison pill
      entry.isPoisonPill = this.isPoisonPill(entry);

      if (entry.isPoisonPill && !entry.quarantined) {
        this.quarantineJob(entry);
      }

      this.deadLetterStore.set(jobKey, entry);

      // Enforce size limits
      if (this.deadLetterStore.size > this.maxDeadLetterSize) {
        this.pruneOldEntries();
      }

      logger.warn("Job added to dead letter queue", {
        jobId: job.id,
        jobType: job.data.type,
        failureCount: entry.failureCount,
        isPoisonPill: entry.isPoisonPill,
        classification: entry.classification,
        error: error.message,
      });

      // Send notification
      this.sendDeadLetterNotification(entry);
    } catch (dlqError) {
      logger.error("Failed to process dead letter entry:", dlqError);
    }
  }

  private generateJobKey(job: Bull.Job<BotCommandJob>): string {
    // Create a key that groups similar jobs together
    const data = job.data;
    const dataString = "data" in data ? JSON.stringify(data.data).slice(0, 100) : "no-data";
    return `${data.type}:${data.guildId}:${dataString}`;
  }

  private classifyError(error: Error): DeadLetterEntry["classification"] {
    const message = error.message.toLowerCase();

    // Non-retryable errors
    if (message.includes("validation") || message.includes("malformed") || message.includes("invalid format")) {
      return "non-retryable";
    }

    // Rate limits and temporary issues
    if (message.includes("rate limit") || message.includes("timeout") || message.includes("connection")) {
      return "retryable";
    }

    // Permission issues might be non-retryable
    if (message.includes("permission") || message.includes("forbidden") || message.includes("unauthorized")) {
      return "non-retryable";
    }

    return "unknown";
  }

  private isPoisonPill(entry: DeadLetterEntry): boolean {
    for (const pattern of this.poisonPillPatterns) {
      if (this.matchesPattern(entry, pattern)) {
        return true;
      }
    }
    return false;
  }

  private matchesPattern(entry: DeadLetterEntry, pattern: PoisonPillPattern): boolean {
    // Check if error matches pattern
    if (!pattern.errorPattern.test(entry.failureReason)) {
      return false;
    }

    // Check job type if specified
    if (pattern.jobTypePattern && !pattern.jobTypePattern.test(entry.jobData.type)) {
      return false;
    }

    // Check if failures exceed threshold within time window
    const cutoffTime = Date.now() - pattern.timeWindow;
    const recentFailures = entry.errorHistory.filter((h) => h.timestamp > cutoffTime);

    return recentFailures.length >= pattern.threshold;
  }

  private quarantineJob(entry: DeadLetterEntry): void {
    entry.quarantined = true;
    this.quarantineStore.set(entry.id, entry);

    logger.error("Job quarantined as poison pill", {
      jobId: entry.originalJobId,
      jobType: entry.jobData.type,
      failureCount: entry.failureCount,
      failureReason: entry.failureReason,
      guildId: entry.jobData.guildId,
    });

    // Send alert notification
    this.sendPoisonPillAlert(entry);
  }

  private pruneOldEntries(): void {
    const cutoffTime = Date.now() - this.maxRetentionTime;
    const toDelete: string[] = [];

    for (const [key, entry] of this.deadLetterStore.entries()) {
      if (entry.lastFailure < cutoffTime && !entry.quarantined) {
        toDelete.push(key);
      }
    }

    // Remove oldest non-quarantined entries if still over limit
    if (this.deadLetterStore.size - toDelete.length > this.maxDeadLetterSize) {
      const sortedEntries = Array.from(this.deadLetterStore.entries())
        .filter(([key]) => !toDelete.includes(key))
        .filter(([, entry]) => !entry.quarantined)
        .sort(([, a], [, b]) => a.lastFailure - b.lastFailure);

      const additionalToDelete = sortedEntries
        .slice(0, this.deadLetterStore.size - toDelete.length - this.maxDeadLetterSize + 100)
        .map(([key]) => key);

      toDelete.push(...additionalToDelete);
    }

    toDelete.forEach((key) => this.deadLetterStore.delete(key));

    if (toDelete.length > 0) {
      logger.info(`Pruned ${toDelete.length} old dead letter entries`);
    }
  }

  private sendDeadLetterNotification(entry: DeadLetterEntry): void {
    if (!this.client.wsService || !entry.jobData.guildId) return;

    try {
      this.client.wsService.sendDiscordEvent(
        "DEAD_LETTER_ENTRY",
        {
          jobId: entry.originalJobId,
          jobType: entry.jobData.type,
          failureCount: entry.failureCount,
          isPoisonPill: entry.isPoisonPill,
          quarantined: entry.quarantined,
          classification: entry.classification,
          error: entry.failureReason,
          timestamp: entry.lastFailure,
        },
        entry.jobData.guildId
      );
    } catch (error) {
      logger.warn("Failed to send dead letter notification:", error);
    }
  }

  private sendPoisonPillAlert(entry: DeadLetterEntry): void {
    if (!this.client.wsService || !entry.jobData.guildId) return;

    try {
      this.client.wsService.sendDiscordEvent(
        "POISON_PILL_DETECTED",
        {
          jobId: entry.originalJobId,
          jobType: entry.jobData.type,
          failureCount: entry.failureCount,
          failureReason: entry.failureReason,
          guildId: entry.jobData.guildId,
          userId: entry.jobData.userId,
          errorHistory: entry.errorHistory.slice(-5), // Last 5 errors
          timestamp: entry.lastFailure,
        },
        entry.jobData.guildId
      );
    } catch (error) {
      logger.warn("Failed to send poison pill alert:", error);
    }
  }

  private startCleanupProcess(): void {
    // Run cleanup every hour
    this.cleanupInterval = setInterval(
      () => {
        this.pruneOldEntries();
      },
      60 * 60 * 1000
    );
  }

  // Public methods for monitoring and management

  getDeadLetterStats() {
    const now = Date.now();
    const entries = Array.from(this.deadLetterStore.values());

    return {
      totalEntries: entries.length,
      quarantinedEntries: entries.filter((e) => e.quarantined).length,
      poisonPills: entries.filter((e) => e.isPoisonPill).length,
      recentFailures: entries.filter((e) => now - e.lastFailure < 60 * 60 * 1000).length, // Last hour
      byClassification: {
        retryable: entries.filter((e) => e.classification === "retryable").length,
        nonRetryable: entries.filter((e) => e.classification === "non-retryable").length,
        poison: entries.filter((e) => e.classification === "poison").length,
        unknown: entries.filter((e) => e.classification === "unknown").length,
      },
      topFailureReasons: this.getTopFailureReasons(entries),
    };
  }

  private getTopFailureReasons(entries: DeadLetterEntry[]) {
    const reasons = new Map<string, number>();

    entries.forEach((entry) => {
      reasons.set(entry.failureReason, (reasons.get(entry.failureReason) ?? 0) + 1);
    });

    return Array.from(reasons.entries())
      .sort(([, a], [, b]) => b - a)
      .slice(0, 10)
      .map(([reason, count]) => ({ reason, count }));
  }

  getQuarantinedJobs(): DeadLetterEntry[] {
    return Array.from(this.quarantineStore.values());
  }

  releaseFromQuarantine(jobId: string): boolean {
    const entry = this.quarantineStore.get(jobId);
    if (!entry) return false;

    entry.quarantined = false;
    entry.isPoisonPill = false;
    this.quarantineStore.delete(jobId);
    this.deadLetterStore.set(jobId, entry);

    logger.info(`Job ${entry.originalJobId} released from quarantine`);
    return true;
  }

  clearDeadLetterQueue(): number {
    const count = this.deadLetterStore.size;
    this.deadLetterStore.clear();
    logger.info(`Cleared ${count} entries from dead letter queue`);
    return count;
  }

  shutdown(): void {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = null;
    }
    logger.info("Dead letter queue shutdown complete");
  }
}
