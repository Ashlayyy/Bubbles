import Redis from 'ioredis';
import Bull from 'bull';
export const getQueueConfig = () => {
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
export const createRedisConnection = (config) => {
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
    redis.on('reconnecting', (delay) => {
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
export const createQueue = (name, redisConnection) => {
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
    queues = new Map();
    redisConnection;
    connectionHealthy = false;
    hasGivenUpReconnecting = false;
    constructor(redisConnection) {
        this.redisConnection = redisConnection || createRedisConnection();
        this.setupConnectionMonitoring();
    }
    setupConnectionMonitoring() {
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
    getQueue(name) {
        if (!this.queues.has(name)) {
            this.queues.set(name, createQueue(name, this.redisConnection));
        }
        return this.queues.get(name);
    }
    async closeAll() {
        for (const queue of this.queues.values()) {
            await queue.close();
        }
        this.queues.clear();
        this.redisConnection.disconnect();
    }
    async getQueueStats(name) {
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
    isConnectionHealthy() {
        return this.connectionHealthy && !this.hasGivenUpReconnecting;
    }
    /**
     * Test Redis connection by performing a simple operation
     */
    async testConnection() {
        if (this.hasGivenUpReconnecting) {
            return false;
        }
        try {
            await this.redisConnection.ping();
            return true;
        }
        catch (error) {
            return false;
        }
    }
    /**
     * Check if Redis has given up reconnecting
     */
    hasStoppedReconnecting() {
        return this.hasGivenUpReconnecting;
    }
}
//# sourceMappingURL=config.js.map