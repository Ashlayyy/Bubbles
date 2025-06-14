import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import { createLogger } from './types/shared.js';
import { config } from './config/index.js';
import messageRoutes from './routes/messages.js';
import queueManager from './queue/manager.js';
import { QUEUE_NAMES } from '../../shared/src/types/queue.js';

const logger = createLogger('api-server');
const app = express();

// Middleware
app.use(helmet());
app.use(cors({ origin: config.cors.origin }));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// Request logging middleware
app.use((req, res, next) => {
  logger.info(`${req.method} ${req.path} - ${req.ip}`);
  next();
});

// Health check
app.get('/health', (req, res) => {
  res.json({ 
    status: 'ok', 
    timestamp: new Date().toISOString(),
    service: 'api',
    version: '1.0.0'
  });
});

// Dev routes for testing queue
app.post('/dev/test-queue', async (req, res) => {
  try {
    const botCommandsQueue = queueManager.getQueue(QUEUE_NAMES.BOT_COMMANDS);
    
    const testJob = {
      type: 'SEND_MESSAGE' as const,
      id: `test-${Date.now()}`,
      timestamp: Date.now(),
      channelId: req.body.channelId || 'test-channel',
      content: req.body.message || 'This is a test message from the API!',
      guildId: req.body.guildId || 'test-guild'
    };

    const job = await botCommandsQueue.add('send-message', testJob);
    
    logger.info(`Added test job to queue: ${job.id}`);
    
    res.status(201).json({
      success: true,
      message: 'Test job added to the bot commands queue.',
      jobId: job.id,
      jobData: testJob
    });
  } catch (error) {
    logger.error('Failed to add job to queue:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to add job to queue.',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

app.get('/dev/queue-stats', async (req, res) => {
  try {
    const stats = await queueManager.getQueueStats(QUEUE_NAMES.BOT_COMMANDS);
    res.json({
      success: true,
      stats
    });
  } catch (error) {
    logger.error('Failed to get queue stats:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get queue stats.',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// Routes
app.use('/api/messages', messageRoutes);

// Error handling
app.use((err: Error, req: express.Request, res: express.Response, next: express.NextFunction) => {
  logger.error('Unhandled error:', err.stack);
  res.status(500).json({
    success: false,
    error: 'Something went wrong!'
  });
});

// 404 handler
app.use('*', (req, res) => {
  logger.warn(`404 - Route not found: ${req.method} ${req.originalUrl}`);
  res.status(404).json({
    success: false,
    error: 'Route not found'
  });
});

const PORT = config.port;

app.listen(PORT, () => {
  logger.info(`🚀 API Server running on port ${PORT}`);
  logger.info(`📋 Health check available at http://localhost:${PORT}/health`);
  logger.info(`🔗 CORS origin: ${config.cors.origin}`);
  logger.info(`🧪 Dev routes: POST /dev/test-queue, GET /dev/queue-stats`);
}); 