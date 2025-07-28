import Redis from 'ioredis';

/**
 * Centralized Redis connection factory for bot services
 * Provides a single shared connection to reduce resource usage and ensure consistent configuration
 * BullMQ uses its own separate connections via bullmq.ts
 */
export class RedisConnectionFactory {
	private static sharedConnection?: Redis;

	/**
	 * Get the shared Redis connection for all bot services
	 * Used by: CooldownStore, ModerationThrottle, MusicService, JwtKeyManager
	 */
	static getSharedConnection(): Redis {
		if (!this.sharedConnection) {
			this.sharedConnection = new Redis({
				host: process.env.REDIS_HOST || 'localhost',
				port: parseInt(process.env.REDIS_PORT || '6379'),
				password: process.env.REDIS_PASSWORD || undefined, // Use undefined instead of empty string to avoid NOAUTH errors
				db: parseInt(process.env.REDIS_DB || '0'),
				maxRetriesPerRequest: null, // Required for BullMQ compatibility
				enableReadyCheck: true,
				connectTimeout: 30_000,
				commandTimeout: 30_000,
				enableOfflineQueue: true,
				lazyConnect: true,
				keepAlive: 30000,
				family: 4, // Force IPv4 for WSL compatibility
				showFriendlyErrorStack: true,
				keyPrefix: 'bot:', // Namespace all bot operations
			});

			// Set up connection event handlers
			this.sharedConnection.on('error', (err: Error) => {
				console.warn(`[Redis Shared] Connection error: ${err.message}`);
			});

			this.sharedConnection.on('connect', () => {
				console.log('[Redis Shared] Connection established');
			});

			this.sharedConnection.on('ready', () => {
				console.log('[Redis Shared] Ready for commands');
			});

			this.sharedConnection.on('close', () => {
				console.warn('[Redis Shared] Connection closed');
			});

			this.sharedConnection.on('reconnecting', (delay: number) => {
				console.log(`[Redis Shared] Reconnecting in ${delay}ms...`);
			});
		}

		return this.sharedConnection;
	}

	/**
	 * Close the shared connection (for graceful shutdown)
	 */
	static async closeSharedConnection(): Promise<void> {
		if (this.sharedConnection) {
			await this.sharedConnection.quit();
			this.sharedConnection = undefined;
			console.log('[Redis Shared] Connection closed gracefully');
		}
	}

	/**
	 * Test if the shared connection is healthy
	 */
	static async testSharedConnection(): Promise<boolean> {
		try {
			const connection = this.getSharedConnection();
			await connection.ping();
			return true;
		} catch (error) {
			console.error('[Redis Shared] Health check failed:', error);
			return false;
		}
	}
}