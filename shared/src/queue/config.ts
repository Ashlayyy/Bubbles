import Redis from 'ioredis';
import Bull from 'bull';
import type { QueueName, QUEUE_NAMES } from '../types/queue.js';

export interface QueueConfig {
  redis: {
    host: string;
    port: number;
    password?: string;
    db?: number;
  };
  defaultJobOptions: Bull.JobOptions;
}

export const getQueueConfig = (): QueueConfig => {
  return {
    redis: {
      host: process.env.REDIS_HOST || 'localhost',
      port: parseInt(process.env.REDIS_PORT || '6379'),
      password: process.env.REDIS_PASSWORD,
      db: 0,
    },
    defaultJobOptions: {
      removeOnComplete: 100,
      removeOnFail: 50,
      attempts: 3,
      backoff: {
        type: 'exponential',
        delay: 2000,
      },
    },
  };
};

export const createRedisConnection = (config?: QueueConfig['redis']): Redis => {
  const redisConfig = config || getQueueConfig().redis;
  
  const redis = new Redis({
    host: redisConfig.host,
    port: redisConfig.port,
    password: redisConfig.password,
    db: redisConfig.db,
    lazyConnect: true,
    maxRetriesPerRequest: 3,
    enableReadyCheck: true,
    // Connection timeout settings
    connectTimeout: 5000,
    commandTimeout: 5000
  });

  let reconnectAttempts = 0;
  const maxReconnectAttempts = 10;
  let reconnectBackoff = 1000; // Start with 1 second

  // Add error handling for Redis connection
  redis.on('error', (err) => {
    console.warn(`Redis connection error: ${err.message}`);
  });

  redis.on('connect', () => {
    console.log('Redis connection established');
    // Reset reconnect attempts on successful connection
    reconnectAttempts = 0;
    reconnectBackoff = 1000;
  });

  redis.on('ready', () => {
    console.log('Redis is ready to accept commands');
  });

  redis.on('close', () => {
    console.warn('Redis connection closed');
  });

  redis.on('reconnecting', (delay: number) => {
    reconnectAttempts++;
    
    if (reconnectAttempts > maxReconnectAttempts) {
      console.error(`Redis reconnection failed after ${maxReconnectAttempts} attempts. Stopping reconnection.`);
      redis.disconnect(false); // Stop reconnecting
      return;
    }
    
    console.log(`Redis reconnecting... (attempt ${reconnectAttempts}/${maxReconnectAttempts}, delay: ${delay}ms)`);
    
    // Exponential backoff
    reconnectBackoff = Math.min(reconnectBackoff * 1.5, 30000); // Max 30 seconds
  });

  return redis;
};

export const createQueue = (name: QueueName, redisConnection?: Redis): Bull.Queue => {
  const config = getQueueConfig();
  const redis = redisConnection || createRedisConnection();

  return new Bull(name, {
    redis: {
      port: config.redis.port,
      host: config.redis.host,
      password: config.redis.password,
      db: config.redis.db,
    },
    defaultJobOptions: config.defaultJobOptions,
  });
};

export class QueueManager {
  private queues: Map<QueueName, Bull.Queue> = new Map();
  private redisConnection: Redis;
  private connectionHealthy = false;
  private hasGivenUpReconnecting = false;

  constructor(redisConnection?: Redis) {
    this.redisConnection = redisConnection || createRedisConnection();
    this.setupConnectionMonitoring();
  }

  private setupConnectionMonitoring(): void {
    this.redisConnection.on('ready', () => {
      this.connectionHealthy = true;
      this.hasGivenUpReconnecting = false;
      console.log('Queue Redis connection is healthy');
    });

    this.redisConnection.on('error', (err) => {
      this.connectionHealthy = false;
      if (!this.hasGivenUpReconnecting) {
        console.warn('Queue Redis connection unhealthy:', err.message);
      }
    });

    this.redisConnection.on('close', () => {
      this.connectionHealthy = false;
      if (!this.hasGivenUpReconnecting) {
        console.warn('Queue Redis connection closed');
      }
    });

    this.redisConnection.on('end', () => {
      this.connectionHealthy = false;
      this.hasGivenUpReconnecting = true;
      console.warn('Queue Redis has given up reconnecting - switching to fallback mode permanently');
    });
  }

  getQueue(name: QueueName): Bull.Queue {
    if (!this.queues.has(name)) {
      this.queues.set(name, createQueue(name, this.redisConnection));
    }
    return this.queues.get(name)!;
  }

  async closeAll(): Promise<void> {
    for (const queue of this.queues.values()) {
      await queue.close();
    }
    this.queues.clear();
    this.redisConnection.disconnect();
  }

  async getQueueStats(name: QueueName) {
    if (!this.connectionHealthy || this.hasGivenUpReconnecting) {
      throw new Error('Redis connection is not healthy or has given up reconnecting');
    }

    const queue = this.getQueue(name);
    return {
      waiting: await queue.getWaiting(),
      active: await queue.getActive(),
      completed: await queue.getCompleted(),
      failed: await queue.getFailed(),
      delayed: await queue.getDelayed(),
    };
  }

  /**
   * Check if Redis connection is healthy
   */
  isConnectionHealthy(): boolean {
    return this.connectionHealthy && !this.hasGivenUpReconnecting;
  }

  /**
   * Test Redis connection by performing a simple operation
   */
  async testConnection(): Promise<boolean> {
    if (this.hasGivenUpReconnecting) {
      return false;
    }
    
    try {
      await this.redisConnection.ping();
      return true;
    } catch (error) {
      return false;
    }
  }

  /**
   * Check if Redis has given up reconnecting
   */
  hasStoppedReconnecting(): boolean {
    return this.hasGivenUpReconnecting;
  }
} 