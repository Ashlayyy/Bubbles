import express, { RequestHandler } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import session from 'express-session';
import { createServer } from 'http';
import { createLogger } from './types/shared.js';
import { config } from './config/index.js';
import apiRoutes from './routes/index.js';
import queueManager from './queue/manager.js';
import { wsManager } from './websocket/manager.js';
import {
	initializePrisma,
	checkDatabaseHealth,
} from './services/databaseService.js';

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
app.use(helmet());
app.use(
	cors({
		origin: config.cors.origin,
		credentials: true,
	})
);
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

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

// Health check endpoint
app.get('/', async (req, res) => {
	const isDbHealthy = await checkDatabaseHealth();

	res.json({
		status: isDbHealthy ? 'healthy' : 'degraded',
		timestamp: new Date().toISOString(),
		version: '1.0.0',
		services: {
			database: isDbHealthy ? 'healthy' : 'unhealthy',
			redis: 'unknown', // Will implement Redis health check later
			websocket: 'unknown', // Will implement WebSocket health check later
		},
	});
});

// Mount API routes
app.use('/api', apiRoutes);

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

			await queueManager.addJob(QUEUE_NAMES.BOT_COMMANDS, testJob);

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
		res.status(500).json({
			success: false,
			error:
				config.nodeEnv === 'development'
					? err.message
					: 'Internal server error',
		});
	}
);

// 404 handler
app.use((req, res) => {
	res.status(404).json({
		success: false,
		error: 'Endpoint not found',
	});
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

			// Close queue connections
			await queueManager.disconnect();

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
			logger.info(`📋 Health check available at http://localhost:${PORT}/`);
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
