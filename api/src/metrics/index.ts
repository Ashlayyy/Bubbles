import { Registry, collectDefaultMetrics, Histogram, Gauge } from 'prom-client';
import type { Request, Response, NextFunction } from 'express';
import { bullMQManager } from '../queue/bullmqManager.js';

// Create a dedicated registry so we don't pollute the global default one
export const register = new Registry();

// Default process metrics (CPU, memory, event-loop lag, etc.)
collectDefaultMetrics({ register });

// HTTP request duration histogram
const httpRequestDuration = new Histogram({
	name: 'http_request_duration_seconds',
	help: 'Duration of HTTP requests in seconds',
	labelNames: ['method', 'path', 'status_code'],
	buckets: [0.05, 0.1, 0.2, 0.5, 1, 2, 5],
	registers: [register],
});

// Queue gauges – will be updated periodically
const queueActive = new Gauge({
	name: 'queue_active_jobs',
	help: 'Number of active jobs across all queues',
	registers: [register],
});
const queueCompleted = new Gauge({
	name: 'queue_completed_jobs_total',
	help: 'Number of completed jobs across all queues',
	registers: [register],
});
const queueFailed = new Gauge({
	name: 'queue_failed_jobs_total',
	help: 'Number of failed jobs across all queues',
	registers: [register],
});
const queueWaiting = new Gauge({
	name: 'queue_waiting_jobs',
	help: 'Number of waiting jobs across all queues',
	registers: [register],
});

// Express middleware to time each request
export function metricsMiddleware(
	req: Request,
	res: Response,
	next: NextFunction
) {
	const path = req.route?.path || req.path;
	const end = httpRequestDuration.startTimer({ method: req.method, path });
	res.once('finish', () => {
		end({ status_code: res.statusCode });
	});
	next();
}

// Periodically refresh queue gauges from BullMQManager
async function refreshQueueMetrics() {
	try {
		const criticalStats = await bullMQManager.getQueueMetrics(
			'critical-operations'
		);
		const botCommandsStats = await bullMQManager.getQueueMetrics(
			'bot-commands'
		);

		const totals = {
			active: criticalStats.active + botCommandsStats.active,
			completed: criticalStats.completed + botCommandsStats.completed,
			failed: criticalStats.failed + botCommandsStats.failed,
			waiting: criticalStats.waiting + botCommandsStats.waiting,
		};

		queueActive.set(totals.active);
		queueCompleted.set(totals.completed);
		queueFailed.set(totals.failed);
		queueWaiting.set(totals.waiting);
	} catch (err) {
		// swallow errors, metrics will be stale
	}
}

setInterval(refreshQueueMetrics, 10_000).unref();

// Initial run
void refreshQueueMetrics();
