import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import { createLogger } from './types/shared.js';
import { config } from './config/index.js';
import messageRoutes from './routes/messages.js';

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
}); 