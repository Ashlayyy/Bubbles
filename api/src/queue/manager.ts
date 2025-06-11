import Bull from 'bull';
import type { QueueName } from '../types/shared.js';
import { createLogger } from '../types/shared.js';

const logger = createLogger('queue-manager');

export class QueueManager {
  private queues: Map<QueueName, Bull.Queue> = new Map();

  getQueue(name: QueueName): Bull.Queue {
    if (!this.queues.has(name)) {
      logger.info(`Creating queue: ${name}`);
      
      const queue = new Bull(name, {
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
      });

      // Add basic event listeners
      queue.on('completed', (job) => {
        logger.info(`Job ${job.id} completed successfully`);
      });

      queue.on('failed', (job, err) => {
        logger.error(`Job ${job.id} failed:`, err.message);
      });

      this.queues.set(name, queue);
    }

    return this.queues.get(name)!;
  }

  async closeAll(): Promise<void> {
    logger.info('Closing all queues...');
    for (const [name, queue] of this.queues) {
      logger.info(`Closing queue: ${name}`);
      await queue.close();
    }
    this.queues.clear();
    logger.info('All queues closed');
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