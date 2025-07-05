/* eslint-disable @typescript-eslint/no-empty-function */
import { performance } from "perf_hooks";
import logger from "../logger.js";
import type { DeduplicationResult, NormalizedRequest, UnifiedResponse } from "./types.js";

interface OperationContext {
  request: NormalizedRequest;
  promise: Promise<UnifiedResponse>;
  startTime: number;
  retryCount: number;
  resolve: (value: UnifiedResponse) => void;
  reject: (reason: Error) => void;
}

export class CrossProtocolDeduplicator {
  private activeOperations = new Map<string, OperationContext>();
  private operationHistory = new Map<string, UnifiedResponse>();
  private readonly historyTTL = 300000; // 5 minutes
  private readonly maxConcurrentOperations = 1000;

  constructor() {
    this.startCleanupInterval();
  }

  async check(request: NormalizedRequest): Promise<DeduplicationResult> {
    const operationKey = this.generateOperationKey(request);

    // Check if there's a recent completed operation
    const recentResult = this.getRecentResult(operationKey);
    if (recentResult) {
      logger.debug(`Found recent result for operation: ${operationKey}`);
      return {
        isDuplicate: true,
        existingResult: recentResult,
      };
    }

    // Check if operation is currently in progress
    const existingOperation = this.activeOperations.get(operationKey);
    if (existingOperation) {
      return await this.handleExistingOperation(existingOperation, request);
    }

    // Check for conflicting operations
    const conflict = this.findConflictingOperation(request);
    if (conflict) {
      const error = new Error(`Conflicting operation in progress: ${conflict.operationKey}`) as Error & {
        operationKey?: string;
      };
      error.operationKey = conflict.operationKey;
      throw error;
    }

    // No duplicate found
    return { isDuplicate: false };
  }

  createOperationContext(request: NormalizedRequest): OperationContext {
    const operationKey = this.generateOperationKey(request);

    // Check if we're at capacity
    if (this.activeOperations.size >= this.maxConcurrentOperations) {
      this.cleanup();
      if (this.activeOperations.size >= this.maxConcurrentOperations) {
        throw new Error("Maximum concurrent operations exceeded");
      }
    }

    let resolveFunction: (value: UnifiedResponse) => void = () => {};
    let rejectFunction: (reason: Error) => void = () => {};

    const promise = new Promise<UnifiedResponse>((res, rej) => {
      resolveFunction = res;
      rejectFunction = rej;
    });

    const context: OperationContext = {
      request,
      promise,
      startTime: performance.now(),
      retryCount: 0,
      resolve: resolveFunction,
      reject: rejectFunction,
    };

    this.activeOperations.set(operationKey, context);

    logger.debug(`Created operation context for: ${operationKey}`, {
      operationKey,
      type: request.type,
      source: request.source,
      guildId: request.guildId,
    });

    return context;
  }

  completeOperation(operationKey: string, result: UnifiedResponse): void {
    const context = this.activeOperations.get(operationKey);
    if (!context) {
      logger.warn(`Attempted to complete unknown operation: ${operationKey}`);
      return;
    }

    // Store result for deduplication
    this.operationHistory.set(operationKey, {
      ...result,
      timestamp: Date.now(),
    });

    // Remove from active operations
    this.activeOperations.delete(operationKey);

    // Resolve the promise
    context.resolve(result);

    logger.debug(`Completed operation: ${operationKey}`, {
      executionTime: performance.now() - context.startTime,
      success: result.success,
      retryCount: context.retryCount,
    });
  }

  failOperation(operationKey: string, error: Error): void {
    const context = this.activeOperations.get(operationKey);
    if (!context) {
      logger.warn(`Attempted to fail unknown operation: ${operationKey}`);
      return;
    }

    // Remove from active operations
    this.activeOperations.delete(operationKey);

    // Reject the promise
    context.reject(error);

    logger.debug(`Failed operation: ${operationKey}`, {
      executionTime: performance.now() - context.startTime,
      error: error.message,
      retryCount: context.retryCount,
    });
  }

  private generateOperationKey(request: NormalizedRequest): string {
    // Create unique key for operations that could conflict
    const baseKey = `${request.type}:${request.guildId || "global"}`;

    // Add resource-specific identifiers
    const resourceId = this.extractResourceId(request);
    if (resourceId) {
      return `${baseKey}:${resourceId}`;
    }

    return baseKey;
  }

  private extractResourceId(request: NormalizedRequest): string | null {
    const data = request.data;

    // Try common resource identifiers
    if (typeof data.targetUserId === "string") return data.targetUserId;
    if (typeof data.userId === "string") return data.userId;
    if (typeof data.channelId === "string") return data.channelId;
    if (typeof data.messageId === "string") return data.messageId;
    if (typeof data.roleId === "string") return data.roleId;

    return null;
  }

  private getRecentResult(operationKey: string): UnifiedResponse | null {
    const result = this.operationHistory.get(operationKey);
    if (!result) return null;

    // Check if result is still fresh
    const age = Date.now() - result.timestamp;
    if (age > this.historyTTL) {
      this.operationHistory.delete(operationKey);
      return null;
    }

    return result;
  }

  private async handleExistingOperation(
    existingOperation: OperationContext,
    newRequest: NormalizedRequest
  ): Promise<DeduplicationResult> {
    // Check if the requests are compatible (same operation type and data)
    if (this.areRequestsCompatible(existingOperation.request, newRequest)) {
      logger.debug(`Waiting for compatible operation to complete: ${this.generateOperationKey(newRequest)}`);

      try {
        const result = await existingOperation.promise;
        return {
          isDuplicate: true,
          existingResult: result,
        };
      } catch (error) {
        // If the existing operation failed, allow the new one to proceed
        logger.debug(`Existing operation failed, allowing new request to proceed`);
        return { isDuplicate: false };
      }
    } else {
      // Operations conflict - reject the new one
      throw new Error(`Conflicting operation in progress for the same resource`);
    }
  }

  private areRequestsCompatible(existing: NormalizedRequest, incoming: NormalizedRequest): boolean {
    // Same operation type
    if (existing.type !== incoming.type) return false;

    // Same target resource
    const existingResourceId = this.extractResourceId(existing);
    const incomingResourceId = this.extractResourceId(incoming);

    return existingResourceId === incomingResourceId;
  }

  private findConflictingOperation(request: NormalizedRequest): { operationKey: string } | null {
    const resourceId = this.extractResourceId(request);
    if (!resourceId) return null;

    // Look for operations that could conflict with this one
    for (const [operationKey, context] of this.activeOperations) {
      if (this.doOperationsConflict(request, context.request)) {
        return { operationKey };
      }
    }

    return null;
  }

  private doOperationsConflict(request1: NormalizedRequest, request2: NormalizedRequest): boolean {
    // Same resource but different operation types that could conflict
    const resource1 = this.extractResourceId(request1);
    const resource2 = this.extractResourceId(request2);

    if (resource1 !== resource2) return false;

    // Define conflicting operation pairs
    const conflicts = [
      ["BAN_USER", "UNBAN_USER"],
      ["KICK_USER", "BAN_USER"],
      ["TIMEOUT_USER", "UNTIMEOUT_USER"],
      ["DELETE_MESSAGE", "EDIT_MESSAGE"],
    ];

    return conflicts.some(
      ([op1, op2]) =>
        (request1.type === op1 && request2.type === op2) || (request1.type === op2 && request2.type === op1)
    );
  }

  private startCleanupInterval(): void {
    setInterval(() => {
      this.cleanup();
    }, 60000); // Cleanup every minute
  }

  private cleanup(): void {
    const now = Date.now();
    let cleanedOperations = 0;
    let cleanedHistory = 0;

    // Clean up stale active operations (older than 5 minutes)
    for (const [operationKey, context] of this.activeOperations) {
      const age = now - (context.startTime + performance.timeOrigin);
      if (age > 300000) {
        // 5 minutes
        logger.warn(`Cleaning up stale operation: ${operationKey}`);
        this.activeOperations.delete(operationKey);
        context.reject(new Error("Operation timed out and was cleaned up"));
        cleanedOperations++;
      }
    }

    // Clean up old history entries
    for (const [operationKey, result] of this.operationHistory) {
      const age = now - result.timestamp;
      if (age > this.historyTTL) {
        this.operationHistory.delete(operationKey);
        cleanedHistory++;
      }
    }

    if (cleanedOperations > 0 || cleanedHistory > 0) {
      logger.debug(`Deduplicator cleanup completed`, {
        cleanedOperations,
        cleanedHistory,
        activeOperations: this.activeOperations.size,
        historySize: this.operationHistory.size,
      });
    }
  }

  getMetrics() {
    return {
      activeOperations: this.activeOperations.size,
      historySize: this.operationHistory.size,
      maxConcurrentOperations: this.maxConcurrentOperations,
      historyTTL: this.historyTTL,
    };
  }

  shutdown(): void {
    logger.info("Shutting down cross-protocol deduplicator...");

    // Reject all pending operations
    for (const [operationKey, context] of this.activeOperations) {
      context.reject(new Error("System shutting down"));
    }

    this.activeOperations.clear();
    this.operationHistory.clear();

    logger.info("Cross-protocol deduplicator shutdown complete");
  }
}
