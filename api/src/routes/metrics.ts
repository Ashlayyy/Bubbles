import { Router } from 'express';
import * as promClient from 'prom-client';
import { createLogger } from '../types/shared.js';

const router = Router();
const register = promClient.register;

const logger = createLogger('metrics-route');

// Collect default metrics
promClient.collectDefaultMetrics();

/** Get Prometheus metrics */
router.get('/', async (req, res) => {
	try {
		// Set content type for Prometheus
		res.set('Content-Type', promClient.register.contentType);

		// Get metrics
		const metrics = await promClient.register.metrics();

		res.send(metrics);
	} catch (error) {
		logger.error('Failed to get Prometheus metrics:', error);
		res.status(500).json({
			success: false,
			error: 'Failed to get Prometheus metrics',
		});
	}
});

/** Get metrics in JSON format */
router.get('/json', async (req, res) => {
	try {
		const metrics = await promClient.register.getMetricsAsJSON();

		res.json({
			success: true,
			data: metrics,
		});
	} catch (error) {
		logger.error('Failed to get metrics as JSON:', error);
		res.status(500).json({
			success: false,
			error: 'Failed to get metrics as JSON',
		});
	}
});

export default router;
