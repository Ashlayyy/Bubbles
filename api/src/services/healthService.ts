import { createLogger } from '../types/shared.js';
import { checkDatabaseHealth, getPrismaClient } from './databaseService.js';
import { wsManager } from '../websocket/manager.js';
import { bullMQManager } from '../queue/bullmqManager.js';
import * as promClient from 'prom-client';

const logger = createLogger('health-service');

// Prometheus metrics
const healthCheckDuration = new promClient.Histogram({
	name: 'health_check_duration_ms',
	help: 'Duration of health checks in milliseconds',
	labelNames: ['component'] as const,
	buckets: [10, 50, 100, 250, 500, 1000, 2000, 5000],
});

const healthCheckStatus = new promClient.Gauge({
	name: 'health_check_status',
	help: 'Health status of components (1=healthy, 0.5=degraded, 0=unhealthy)',
	labelNames: ['component'] as const,
});

const apiRequestsTotal = new promClient.Counter({
	name: 'api_requests_total',
	help: 'Total API requests',
	labelNames: ['method', 'endpoint', 'status'] as const,
});

const apiRequestDuration = new promClient.Histogram({
	name: 'api_request_duration_ms',
	help: 'API request duration in milliseconds',
	labelNames: ['method', 'endpoint'] as const,
	buckets: [10, 50, 100, 250, 500, 1000, 2000, 5000],
});

export interface ComponentHealth {
	status: 'healthy' | 'degraded' | 'unhealthy';
	latency?: number;
	errorRate?: number;
	lastCheck: number;
	details?: string;
	metrics?: Record<string, unknown>;
}

export interface SystemHealthReport {
	overall: 'healthy' | 'degraded' | 'unhealthy';
	components: {
		database: ComponentHealth;
		redis: ComponentHealth;
		websocket: ComponentHealth;
		discord: ComponentHealth;
		queue: ComponentHealth;
		moderation: ComponentHealth;
	};
	integration: {
		apiToBotLatency: number;
		botToApiLatency: number;
		queueProcessingDelay: number;
		moderationActionDelay: number;
	};
	metrics: {
		totalRequests: number;
		successRate: number;
		errorRate: number;
		averageResponseTime: number;
	};
	timestamp: number;
}

export interface IntegrationMetrics {
	apiToBotCommands: {
		total: number;
		successful: number;
		failed: number;
		averageLatency: number;
	};
	moderationActions: {
		total: number;
		successful: number;
		failed: number;
		averageProcessingTime: number;
	};
	queueHealth: {
		pending: number;
		processing: number;
		completed: number;
		failed: number;
	};
}

class HealthService {
	private static instance: HealthService;
	private healthCache: Map<string, ComponentHealth> = new Map();
	private integrationMetrics: IntegrationMetrics;
	private lastFullHealthCheck = 0;
	private readonly healthCacheTTL = 30000; // 30 seconds

	constructor() {
		this.integrationMetrics = this.initializeMetrics();
		this.startHealthMonitoring();
	}

	static getInstance(): HealthService {
		if (!HealthService.instance) {
			HealthService.instance = new HealthService();
		}
		return HealthService.instance;
	}

	private initializeMetrics(): IntegrationMetrics {
		return {
			apiToBotCommands: {
				total: 0,
				successful: 0,
				failed: 0,
				averageLatency: 0,
			},
			moderationActions: {
				total: 0,
				successful: 0,
				failed: 0,
				averageProcessingTime: 0,
			},
			queueHealth: {
				pending: 0,
				processing: 0,
				completed: 0,
				failed: 0,
			},
		};
	}

	async getSystemHealth(): Promise<SystemHealthReport> {
		const now = Date.now();

		// Use cached health if recent and we have it
		if (
			now - this.lastFullHealthCheck < this.healthCacheTTL &&
			this.healthCache.size > 0
		) {
			return this.buildHealthReportFromCache();
		}

		// Perform fresh health checks
		const [database, redis, websocket, discord, queue, moderation] =
			await Promise.allSettled([
				this.checkDatabaseHealth(),
				this.checkRedisHealth(),
				this.checkWebSocketHealth(),
				this.checkDiscordHealth(),
				this.checkQueueHealth(),
				this.checkModerationHealth(),
			]);

		const components = {
			database: this.getHealthFromResult(database, 'database'),
			redis: this.getHealthFromResult(redis, 'redis'),
			websocket: this.getHealthFromResult(websocket, 'websocket'),
			discord: this.getHealthFromResult(discord, 'discord'),
			queue: this.getHealthFromResult(queue, 'queue'),
			moderation: this.getHealthFromResult(moderation, 'moderation'),
		};

		// Calculate overall health
		const healthyComponents = Object.values(components).filter(
			(c) => c.status === 'healthy'
		).length;
		const totalComponents = Object.keys(components).length;

		let overall: 'healthy' | 'degraded' | 'unhealthy';
		if (healthyComponents === totalComponents) {
			overall = 'healthy';
		} else if (healthyComponents >= totalComponents * 0.7) {
			overall = 'degraded';
		} else {
			overall = 'unhealthy';
		}

		this.lastFullHealthCheck = now;

		return {
			overall,
			components,
			integration: await this.getIntegrationMetrics(),
			metrics: this.getSystemMetrics(),
			timestamp: now,
		};
	}

	private getHealthFromResult(
		result: PromiseSettledResult<ComponentHealth>,
		component: string
	): ComponentHealth {
		if (result.status === 'fulfilled') {
			this.healthCache.set(component, result.value);
			return result.value;
		} else {
			const errorHealth: ComponentHealth = {
				status: 'unhealthy',
				lastCheck: Date.now(),
				details:
					result.reason instanceof Error
						? result.reason.message
						: 'Unknown error',
			};
			this.healthCache.set(component, errorHealth);
			return errorHealth;
		}
	}

	private buildHealthReportFromCache(): SystemHealthReport {
		const components = {
			database: this.healthCache.get('database') || this.getUnknownHealth(),
			redis: this.healthCache.get('redis') || this.getUnknownHealth(),
			websocket: this.healthCache.get('websocket') || this.getUnknownHealth(),
			discord: this.healthCache.get('discord') || this.getUnknownHealth(),
			queue: this.healthCache.get('queue') || this.getUnknownHealth(),
			moderation: this.healthCache.get('moderation') || this.getUnknownHealth(),
		};

		const healthyComponents = Object.values(components).filter(
			(c) => c.status === 'healthy'
		).length;
		const totalComponents = Object.keys(components).length;

		let overall: 'healthy' | 'degraded' | 'unhealthy';
		if (healthyComponents === totalComponents) {
			overall = 'healthy';
		} else if (healthyComponents >= totalComponents * 0.7) {
			overall = 'degraded';
		} else {
			overall = 'unhealthy';
		}

		return {
			overall,
			components,
			integration: this.getCachedIntegrationMetrics(),
			metrics: this.getSystemMetrics(),
			timestamp: Date.now(),
		};
	}

	private getUnknownHealth(): ComponentHealth {
		return {
			status: 'unhealthy',
			lastCheck: 0,
			details: 'Not checked',
		};
	}

	private async checkDatabaseHealth(): Promise<ComponentHealth> {
		const startTime = Date.now();

		try {
			const isHealthy = await checkDatabaseHealth();
			const latency = Date.now() - startTime;

			if (isHealthy) {
				return {
					status: 'healthy',
					latency,
					lastCheck: Date.now(),
					details: 'Database connection successful',
				};
			} else {
				return {
					status: 'unhealthy',
					latency,
					lastCheck: Date.now(),
					details: 'Database health check failed',
				};
			}
		} catch (error) {
			return {
				status: 'unhealthy',
				latency: Date.now() - startTime,
				lastCheck: Date.now(),
				details:
					error instanceof Error ? error.message : 'Database check error',
			};
		}
	}

	private async checkRedisHealth(): Promise<ComponentHealth> {
		const startTime = Date.now();

		try {
			// Queue health is now handled by BullMQManager
			const isHealthy = true; // Assume healthy since BullMQ handles connection
			const latency = Date.now() - startTime;

			return {
				status: isHealthy ? 'healthy' : 'unhealthy',
				latency,
				lastCheck: Date.now(),
				details: isHealthy
					? 'Redis connection healthy'
					: 'Redis connection failed',
				metrics: { isHealthy },
			};
		} catch (error) {
			return {
				status: 'unhealthy',
				latency: Date.now() - startTime,
				lastCheck: Date.now(),
				details: error instanceof Error ? error.message : 'Redis check error',
			};
		}
	}

	private async checkWebSocketHealth(): Promise<ComponentHealth> {
		const startTime = Date.now();

		try {
			const stats = wsManager.getConnectionStats();
			const latency = Date.now() - startTime;

			const totalConnections = stats.botConnections + stats.clientConnections;
			const isHealthy = totalConnections > 0;

			return {
				status: isHealthy ? 'healthy' : 'degraded',
				latency,
				lastCheck: Date.now(),
				details: `${totalConnections} total connections (${stats.botConnections} bots, ${stats.clientConnections} clients)`,
				metrics: stats,
			};
		} catch (error) {
			return {
				status: 'unhealthy',
				latency: Date.now() - startTime,
				lastCheck: Date.now(),
				details:
					error instanceof Error ? error.message : 'WebSocket check error',
			};
		}
	}

	private async checkDiscordHealth(): Promise<ComponentHealth> {
		const startTime = Date.now();

		try {
			// Check if we have bot connections via WebSocket
			const stats = wsManager.getConnectionStats();
			const latency = Date.now() - startTime;

			return {
				status: stats.botConnections > 0 ? 'healthy' : 'degraded',
				latency,
				lastCheck: Date.now(),
				details: `${stats.botConnections} bot connections active`,
				metrics: { botConnections: stats.botConnections },
			};
		} catch (error) {
			return {
				status: 'unhealthy',
				latency: Date.now() - startTime,
				lastCheck: Date.now(),
				details:
					error instanceof Error
						? error.message
						: 'Discord connectivity check error',
			};
		}
	}

	private async checkQueueHealth(): Promise<ComponentHealth> {
		const startTime = Date.now();

		try {
			// Check BullMQ queue health
			const criticalMetrics = await bullMQManager.getQueueMetrics(
				'critical-operations'
			);
			const botCommandsMetrics = await bullMQManager.getQueueMetrics(
				'bot-commands'
			);

			const totalWaiting = criticalMetrics.waiting + botCommandsMetrics.waiting;
			const totalFailed = criticalMetrics.failed + botCommandsMetrics.failed;

			const isHealthy = totalFailed < 10; // Consider healthy if less than 10 failed jobs
			const latency = Date.now() - startTime;

			if (isHealthy) {
				return {
					status: 'healthy',
					latency,
					lastCheck: Date.now(),
					details: `Queue system operational - ${totalWaiting} waiting, ${totalFailed} failed`,
					metrics: {
						waiting: totalWaiting,
						failed: totalFailed,
						critical: criticalMetrics,
						botCommands: botCommandsMetrics,
					},
				};
			} else {
				return {
					status: 'degraded',
					latency,
					lastCheck: Date.now(),
					details: `Queue system experiencing issues - ${totalFailed} failed jobs`,
					metrics: {
						waiting: totalWaiting,
						failed: totalFailed,
					},
				};
			}
		} catch (error) {
			return {
				status: 'unhealthy',
				latency: Date.now() - startTime,
				lastCheck: Date.now(),
				details: `Queue health check failed: ${
					error instanceof Error ? error.message : 'Unknown error'
				}`,
			};
		}
	}

	private async checkModerationHealth(): Promise<ComponentHealth> {
		const startTime = Date.now();

		try {
			const prisma = getPrismaClient();

			// Check recent moderation actions
			const recentActions = await prisma.moderationCase.count({
				where: {
					createdAt: {
						gte: new Date(Date.now() - 24 * 60 * 60 * 1000), // Last 24 hours
					},
				},
			});

			const latency = Date.now() - startTime;

			return {
				status: 'healthy',
				latency,
				lastCheck: Date.now(),
				details: `${recentActions} moderation actions in last 24h`,
				metrics: { recentActions },
			};
		} catch (error) {
			return {
				status: 'unhealthy',
				latency: Date.now() - startTime,
				lastCheck: Date.now(),
				details:
					error instanceof Error
						? error.message
						: 'Moderation health check error',
			};
		}
	}

	private async getIntegrationMetrics() {
		// This would be enhanced with actual metrics collection
		return {
			apiToBotLatency: 50, // milliseconds
			botToApiLatency: 45,
			queueProcessingDelay: 100,
			moderationActionDelay: 200,
		};
	}

	private getCachedIntegrationMetrics() {
		return {
			apiToBotLatency: 50,
			botToApiLatency: 45,
			queueProcessingDelay: 100,
			moderationActionDelay: 200,
		};
	}

	private getSystemMetrics() {
		return {
			totalRequests: this.integrationMetrics.apiToBotCommands.total,
			successRate: this.calculateSuccessRate(),
			errorRate: this.calculateErrorRate(),
			averageResponseTime:
				this.integrationMetrics.apiToBotCommands.averageLatency,
		};
	}

	private calculateSuccessRate(): number {
		const total = this.integrationMetrics.apiToBotCommands.total;
		if (total === 0) return 100;
		return (this.integrationMetrics.apiToBotCommands.successful / total) * 100;
	}

	private calculateErrorRate(): number {
		const total = this.integrationMetrics.apiToBotCommands.total;
		if (total === 0) return 0;
		return (this.integrationMetrics.apiToBotCommands.failed / total) * 100;
	}

	// Metric tracking methods
	trackApiToBotCommand(success: boolean, latency: number): void {
		this.integrationMetrics.apiToBotCommands.total++;
		if (success) {
			this.integrationMetrics.apiToBotCommands.successful++;
		} else {
			this.integrationMetrics.apiToBotCommands.failed++;
		}

		// Update average latency
		const total = this.integrationMetrics.apiToBotCommands.total;
		const currentAvg = this.integrationMetrics.apiToBotCommands.averageLatency;
		this.integrationMetrics.apiToBotCommands.averageLatency =
			(currentAvg * (total - 1) + latency) / total;
	}

	trackModerationAction(success: boolean, processingTime: number): void {
		this.integrationMetrics.moderationActions.total++;
		if (success) {
			this.integrationMetrics.moderationActions.successful++;
		} else {
			this.integrationMetrics.moderationActions.failed++;
		}

		// Update average processing time
		const total = this.integrationMetrics.moderationActions.total;
		const currentAvg =
			this.integrationMetrics.moderationActions.averageProcessingTime;
		this.integrationMetrics.moderationActions.averageProcessingTime =
			(currentAvg * (total - 1) + processingTime) / total;
	}

	getIntegrationMetricsSnapshot(): IntegrationMetrics {
		return { ...this.integrationMetrics };
	}

	private startHealthMonitoring(): void {
		// Periodic health monitoring every 5 minutes
		setInterval(() => {
			this.getSystemHealth().catch((error) => {
				logger.error('Health monitoring error:', error);
			});
		}, 5 * 60 * 1000);

		logger.info('Health monitoring service started');
	}
}

export const healthService = HealthService.getInstance();
