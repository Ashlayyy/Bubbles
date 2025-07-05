export type ProtocolType = "rest" | "websocket" | "queue" | "internal";
export type JobPriority = "critical" | "high" | "normal" | "low";
export type JobStatus = "pending" | "processing" | "completed" | "failed" | "retrying";

export interface UnifiedRequest {
  id?: string;
  type: string;
  data: Record<string, unknown>;
  source: ProtocolType;
  userId: string;
  guildId: string;
  timestamp?: number;
  priority?: JobPriority;
  requiresRealTime?: boolean;
  requiresReliability?: boolean;
  timeout?: number;
  metadata?: Record<string, unknown>;
}

export interface NormalizedRequest extends Required<Omit<UnifiedRequest, "id" | "timestamp" | "priority">> {
  id: string;
  timestamp: number;
  priority: JobPriority;
  operationKey: string;
}

export interface UnifiedResponse {
  success: boolean;
  requestId: string;
  data?: unknown;
  error?: string;
  executionTime: number;
  method: "websocket" | "queue" | "direct";
  timestamp: number;
}

export interface OperationState {
  id: string;
  status: JobStatus;
  progress?: number;
  data?: unknown;
  error?: string;
  startTime: number;
  endTime?: number;
  retryCount: number;
  maxRetries: number;
}

export interface DeduplicationResult {
  isDuplicate: boolean;
  existingResult?: UnifiedResponse;
  conflictReason?: string;
}

export interface ProtocolHealthStatus {
  protocol: string;
  healthy: boolean;
  latency?: number;
  lastCheck: number;
  errorRate: number;
  circuitBreakerState: "CLOSED" | "OPEN" | "HALF_OPEN";
}

export interface SystemHealth {
  overall: boolean;
  protocols: Record<string, ProtocolHealthStatus>;
  redis: boolean;
  discord: boolean;
  websocket: boolean;
  overloaded: boolean;
  timestamp: number;
}

export interface ProtocolPath {
  primary: string;
  fallback: string;
  reason: string;
}

export interface CircuitBreakerConfig {
  failureThreshold: number;
  recoveryTimeout: number;
  monitorInterval: number;
}

export interface CrossProtocolMetrics {
  restRequests: number;
  websocketMessages: number;
  queueJobs: number;
  restToWebSocketDelay: number;
  queueToWebSocketDelay: number;
  stateInconsistencies: number;
  duplicateOperations: number;
  orderingViolations: number;
  websocketFallbackToQueue: number;
  queueFallbackToWebSocket: number;
  totalProtocolFailures: number;
}

export class ValidationError extends Error {
  constructor(
    message: string,
    public readonly field?: string
  ) {
    super(message);
    this.name = "ValidationError";
  }
}

export class ConflictError extends Error {
  constructor(
    message: string,
    public readonly operationKey?: string
  ) {
    super(message);
    this.name = "ConflictError";
  }
}

export class CircuitBreakerOpenError extends Error {
  constructor(message = "Circuit breaker is open") {
    super(message);
    this.name = "CircuitBreakerOpenError";
  }
}

export class AllStrategiesFailedError extends Error {
  constructor(
    message: string,
    public readonly attempts: { method: string; error: Error }[] = []
  ) {
    super(message);
    this.name = "AllStrategiesFailedError";
  }
}
