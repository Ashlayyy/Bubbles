import Redis from 'ioredis';
import Bull from 'bull';
import type { QueueName } from '../types/queue.js';
export interface QueueConfig {
    redis: {
        host: string;
        port: number;
        password?: string;
        db?: number;
    };
    defaultJobOptions: Bull.JobOptions;
}
export declare const getQueueConfig: () => QueueConfig;
export declare const createRedisConnection: (config?: QueueConfig["redis"]) => Redis;
export declare const createQueue: (name: QueueName, redisConnection?: Redis) => Bull.Queue;
export declare class QueueManager {
    private queues;
    private redisConnection;
    private connectionHealthy;
    private hasGivenUpReconnecting;
    constructor(redisConnection?: Redis);
    private setupConnectionMonitoring;
    getQueue(name: QueueName): Bull.Queue;
    closeAll(): Promise<void>;
    getQueueStats(name: QueueName): Promise<{
        waiting: Bull.Job<any>[];
        active: Bull.Job<any>[];
        completed: Bull.Job<any>[];
        failed: Bull.Job<any>[];
        delayed: Bull.Job<any>[];
    }>;
    /**
     * Check if Redis connection is healthy
     */
    isConnectionHealthy(): boolean;
    /**
     * Test Redis connection by performing a simple operation
     */
    testConnection(): Promise<boolean>;
    /**
     * Check if Redis has given up reconnecting
     */
    hasStoppedReconnecting(): boolean;
}
//# sourceMappingURL=config.d.ts.map