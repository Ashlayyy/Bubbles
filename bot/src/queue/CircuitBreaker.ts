import logger from "../logger.js";
import { CircuitBreakerOpenError, type CircuitBreakerConfig } from "./types.js";

export class CircuitBreaker {
  private state: "CLOSED" | "OPEN" | "HALF_OPEN" = "CLOSED";
  private failures = 0;
  private lastFailure = 0;
  private lastSuccess = 0;
  private requests = 0;
  private successes = 0;

  private readonly config: CircuitBreakerConfig;
  private readonly operation: () => Promise<unknown>;
  private readonly name: string;

  constructor(operation: () => Promise<unknown>, name: string, config: Partial<CircuitBreakerConfig> = {}) {
    this.operation = operation;
    this.name = name;
    this.config = {
      failureThreshold: 5,
      recoveryTimeout: 30000, // 30 seconds
      monitorInterval: 10000, // 10 seconds
      ...config,
    };

    // Start monitoring
    this.startMonitoring();
  }

  async call(): Promise<unknown> {
    this.requests++;

    if (this.state === "OPEN") {
      if (Date.now() - this.lastFailure > this.config.recoveryTimeout) {
        this.state = "HALF_OPEN";
        logger.info(`Circuit breaker ${this.name} transitioning to HALF_OPEN`);
      } else {
        throw new CircuitBreakerOpenError(`Circuit breaker ${this.name} is OPEN`);
      }
    }

    try {
      const result = await this.operation();
      this.onSuccess();
      return result;
    } catch (error) {
      this.onFailure();
      throw error;
    }
  }

  private onSuccess(): void {
    this.successes++;
    this.lastSuccess = Date.now();

    if (this.state === "HALF_OPEN") {
      // Successful call in HALF_OPEN state -> close circuit
      this.state = "CLOSED";
      this.failures = 0;
      logger.info(`Circuit breaker ${this.name} closed after successful recovery`);
    }
  }

  private onFailure(): void {
    this.failures++;
    this.lastFailure = Date.now();

    if (this.state === "CLOSED" && this.failures >= this.config.failureThreshold) {
      this.state = "OPEN";
      logger.warn(`Circuit breaker ${this.name} opened after ${this.failures} failures`);
    } else if (this.state === "HALF_OPEN") {
      // Failed call in HALF_OPEN state -> back to OPEN
      this.state = "OPEN";
      logger.warn(`Circuit breaker ${this.name} reopened after failed recovery attempt`);
    }
  }

  private startMonitoring(): void {
    setInterval(() => {
      this.logMetrics();
    }, this.config.monitorInterval);
  }

  private logMetrics(): void {
    const errorRate = this.requests > 0 ? ((this.requests - this.successes) / this.requests) * 100 : 0;

    logger.debug(
      `Circuit breaker ${this.name} metrics: ${JSON.stringify({
        state: this.state,
        failures: this.failures,
        requests: this.requests,
        successes: this.successes,
        errorRate: `${errorRate.toFixed(2)}%`,
      })} `
    );
  }

  getStatus() {
    const errorRate = this.requests > 0 ? ((this.requests - this.successes) / this.requests) * 100 : 0;

    return {
      name: this.name,
      state: this.state,
      healthy: this.state === "CLOSED",
      failures: this.failures,
      requests: this.requests,
      successes: this.successes,
      errorRate,
      lastFailure: this.lastFailure,
      lastSuccess: this.lastSuccess,
      isOpen: this.state === "OPEN",
    };
  }

  reset(): void {
    this.state = "CLOSED";
    this.failures = 0;
    this.requests = 0;
    this.successes = 0;
    this.lastFailure = 0;
    this.lastSuccess = 0;
    logger.info(`Circuit breaker ${this.name} has been reset`);
  }

  forceOpen(): void {
    this.state = "OPEN";
    this.lastFailure = Date.now();
    logger.warn(`Circuit breaker ${this.name} has been forced OPEN`);
  }

  forceClose(): void {
    this.state = "CLOSED";
    this.failures = 0;
    logger.info(`Circuit breaker ${this.name} has been forced CLOSED`);
  }
}
