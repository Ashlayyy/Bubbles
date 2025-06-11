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
  
  return new Redis({
    host: redisConfig.host,
    port: redisConfig.port,
    password: redisConfig.password,
    db: redisConfig.db,
    lazyConnect: true,
    maxRetriesPerRequest: null,
  });
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

  constructor(redisConnection?: Redis) {
    this.redisConnection = redisConnection || createRedisConnection();
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
    const queue = this.getQueue(name);
    return {
      waiting: await queue.getWaiting(),
      active: await queue.getActive(),
      completed: await queue.getCompleted(),
      failed: await queue.getFailed(),
      delayed: await queue.getDelayed(),
    };
  }
} 