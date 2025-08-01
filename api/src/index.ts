import express, { RequestHandler } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import session from 'express-session';
import { createServer } from 'http';
import { createLogger } from './types/shared.js';
import { config } from './config/index.js';
import { applySecureRouterPatch } from './utils/secureRouterPatch.js';
import { responseEnhancer } from './middleware/response.js';
import {
	metricsMiddleware,
	register as metricsRegister,
} from './metrics/index.js';
import '@bubbles/shared';
import { env } from '@bubbles/shared';
applySecureRouterPatch();

import apiRoutes from './routes/index.js';
import { wsManager } from './websocket/manager.js';
import { initializePrisma } from './services/databaseService.js';

// Queue names enum
const QUEUE_NAMES = {
	BOT_COMMANDS: 'bot-commands',
	MODERATION: 'moderation',
	ANALYTICS: 'analytics',
	NOTIFICATIONS: 'notifications',
} as const;

const logger = createLogger('api-server');
const app = express();

// Middleware
app.use(
	helmet({
		contentSecurityPolicy: env.NODE_ENV === 'production' ? undefined : false,
		crossOriginEmbedderPolicy: false,
	})
);
if (env.NODE_ENV === 'production') {
	app.use(
		helmet.hsts({
			maxAge: 31536000,
			includeSubDomains: true,
			preload: true,
		})
	);
}
app.use(
	cors({
		origin: config.cors.origin,
		credentials: true,
	})
);
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Attach res.success / res.failure helpers
app.use(responseEnhancer);

// Session middleware
app.use(
	session({
		secret: config.session.secret,
		resave: false,
		saveUninitialized: false,
		cookie: {
			secure: config.nodeEnv === 'production',
			maxAge: 8 * 60 * 60 * 1000, // 8 hours
		},
	}) as unknown as RequestHandler
);

// Add monitoring middleware for integration tracking
const { monitoringMiddleware } = await import('./middleware/monitoring.js');
app.use(monitoringMiddleware);

// Add metrics middleware
app.use(metricsMiddleware);

// Mount API routes
app.use('/api/v1', apiRoutes);

// Expose Prometheus metrics (no auth)
app.get('/metrics', async (_req, res) => {
	try {
		res.setHeader('Content-Type', metricsRegister.contentType);
		res.end(await metricsRegister.metrics());
	} catch (err) {
		res.status(500).send('Failed to collect metrics');
	}
});

// Development routes
if (config.nodeEnv === 'development') {
	// Test queue job endpoint
	app.post('/dev/test-queue', async (req, res) => {
		try {
			const testJob = {
				type: 'TEST_MESSAGE',
				timestamp: Date.now(),
				channelId: req.body.channelId || 'test-channel',
				content: req.body.message || 'This is a test message from the API!',
				guildId: req.body.guildId || 'test-guild',
			};

			// Queue functionality moved to BullMQManager
			logger.info('Test job functionality moved to BullMQManager');

			res.json({
				success: true,
				message: 'Test job added to queue',
				jobData: testJob,
			});

			logger.info('Test job added to queue:', testJob);
		} catch (error) {
			logger.error('Error adding test job to queue:', error);
			res.status(500).json({
				success: false,
				error: 'Failed to add test job to queue',
			});
		}
	});

	// Queue statistics endpoint
	app.get('/dev/queue-stats', async (req, res) => {
		try {
			// Basic queue info - will expand later
			res.json({
				success: true,
				stats: {
					message: 'Queue stats endpoint - implementation pending',
					timestamp: Date.now(),
				},
			});
		} catch (error) {
			logger.error('Error getting queue stats:', error);
			res.status(500).json({
				success: false,
				error: 'Failed to get queue statistics',
			});
		}
	});

	logger.info('🧪 Development routes enabled');
}

// Error handling middleware
app.use(
	(
		err: Error,
		req: express.Request,
		res: express.Response,
		next: express.NextFunction
	) => {
		logger.error('Unhandled error:', err);
		res.failure(
			config.nodeEnv === 'development' ? err.message : 'Internal server error',
			500
		);
	}
);

// 404 handler
app.use((req, res) => {
	res.failure('Endpoint not found', 404);
});

// Initialize server
const server = createServer(app);
const PORT = config.port;

// Initialize WebSocket server
wsManager.initialize(server);

// Graceful shutdown handler
const gracefulShutdown = async (signal: string) => {
	logger.info(`Received ${signal}, starting graceful shutdown...`);

	// Close server
	server.close(async () => {
		logger.info('HTTP server closed');

		try {
			// Close database connection
			const { closePrisma } = await import('./services/databaseService.js');
			await closePrisma();

			// Close WebSocket connections
			wsManager.shutdown();

			logger.info('Graceful shutdown completed');
			process.exit(0);
		} catch (error) {
			logger.error('Error during graceful shutdown:', error);
			process.exit(1);
		}
	});
};

// Handle process signals
process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

// Start server with database initialization
const startServer = async () => {
	try {
		// Initialize database connection
		await initializePrisma();
		logger.info('✅ Database initialized');

		// Start HTTP server
		server.listen(PORT, () => {
			logger.info(`🚀 API Server running on port ${PORT}`);
			logger.info(
				`📋 Health check available at http://localhost:${PORT}/api/v1/health`
			);
			logger.info(`🔗 CORS origin: ${config.cors.origin}`);
			logger.info(`🧪 Dev routes: POST /dev/test-queue, GET /dev/queue-stats`);
			logger.info(`🔌 WebSocket server available at ws://localhost:${PORT}/ws`);
			logger.info(`📊 Database: Shared MongoDB with Bot`);
		});
	} catch (error) {
		logger.error('❌ Failed to start server:', error);
		process.exit(1);
	}
};

// Start the server
startServer();
