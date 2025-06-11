# 🚀 PM2 Setup Guide for Bubbles Discord Bot

This guide replaces the Docker Compose setup with PM2 process management for better development and production workflows.

## 📋 Prerequisites

Before starting, ensure you have:

- **Node.js 20.10.0+** and **npm 10.0.0+**
- **Redis Server** running locally or remotely
- **MongoDB** database (local or cloud)
- **PM2** installed globally: `npm install -g pm2`

## 🏗️ Initial Setup

### 1. Install Dependencies

```bash
# Install all dependencies and build shared package
npm run setup

# Or manually:
npm install
cd shared && npm install && npm run build
cd ../api && npm install
cd ../bot && npm install  
cd ../frontend && npm install
cd ..
```

### 2. Environment Configuration

```bash
# Copy environment template
cp env.example .env

# Edit with your values
nano .env
```

**Required Environment Variables:**

```env
# Discord Bot Configuration
DISCORD_TOKEN=your_discord_bot_token_here
CLIENT_ID=your_discord_client_id_here
TEST_GUILD_ID=your_test_guild_id_here
DEVELOPER_USER_IDS=your_user_id_here

# Database Configuration
DB_URL=mongodb+srv://username:password@cluster.mongodb.net/database

# Redis Configuration
REDIS_HOST=localhost
REDIS_PORT=6379
REDIS_PASSWORD=

# API Configuration
DISCORD_CLIENT_SECRET=your_discord_oauth_client_secret
JWT_SECRET=your_super_secret_jwt_key_here_make_it_long_and_random

# URLs
API_URL=http://localhost:3001
FRONTEND_URL=http://localhost:3000
```

### 3. Start Redis Server

**Local Redis (Windows):**
```bash
# Install Redis via WSL or Redis for Windows
redis-server
```

**Local Redis (Linux/Mac):**
```bash
redis-server /etc/redis/redis.conf
```

**Check Redis:**
```bash
redis-cli ping
# Should return: PONG
```

## 🎯 PM2 Commands

### Development Mode

```bash
# Start all services in development mode
npm run dev

# View logs from all services
npm run dev:logs

# Check status of all processes
npm run status

# Monitor processes in real-time
npm run monit

# Stop all services
npm run stop

# Restart all services
npm run restart

# Reload services (zero-downtime)
npm run reload

# Delete all processes
npm run delete
```

### Individual Service Commands

```bash
# Start specific services
pm2 start ecosystem.config.js --only bubbles-shared
pm2 start ecosystem.config.js --only bubbles-api
pm2 start ecosystem.config.js --only bubbles-bot
pm2 start ecosystem.config.js --only bubbles-frontend

# View logs for specific service
pm2 logs bubbles-api
pm2 logs bubbles-bot

# Restart specific service
pm2 restart bubbles-api
```

### Production Mode

```bash
# Build all services for production
npm run build:all

# Start in production mode
npm run start

# Or manually
pm2 start ecosystem.config.js --env production
```

### Multi-Environment Deployment

**For deployment to remote servers:**

```bash
# Setup both environments (first time only)
pm2 deploy ecosystem.config.js production setup
pm2 deploy ecosystem.config.js development setup

# Deploy to development (from develop branch)
pm2 deploy ecosystem.config.js development

# Deploy to production (from main branch)  
pm2 deploy ecosystem.config.js production

# Check both environments
pm2 status
```

## 🔧 Service Details

### **bubbles-shared** (TypeScript Package Builder)
- **Purpose**: Builds and watches the shared TypeScript package
- **Port**: N/A (build tool)
- **Script**: `npm run dev` (tsc --watch)
- **Dependencies**: None

### **bubbles-api** (Express.js API)
- **Purpose**: REST API and WebSocket server
- **Port**: 3001
- **Script**: `npm run dev` (nodemon + tsx)
- **Health Check**: http://localhost:3001/health
- **Dependencies**: Redis, Shared package

### **bubbles-bot** (Discord.js Bot)
- **Purpose**: Discord bot with queue processing
- **Port**: N/A (Discord WebSocket)
- **Script**: `npm run dev` (nodemon + tsx)
- **Dependencies**: Redis, MongoDB, Shared package

### **bubbles-frontend** (Vue.js Dashboard)
- **Purpose**: Web dashboard for bot management
- **Port**: 3000
- **Script**: `npm run dev` (Vite dev server)
- **Dependencies**: API service

## 🔄 Shared Package Usage

The `/shared` directory provides:

### **Common Types**
```typescript
// In any service
import { 
  ApiResponse, 
  ModerationActionJob, 
  QueueManager 
} from '@bubbles/shared';
```

### **Queue Management**
```typescript
// API sending command to bot
import { QueueManager, QUEUE_NAMES } from '@bubbles/shared';

const queueManager = new QueueManager();
const commandQueue = queueManager.getQueue(QUEUE_NAMES.BOT_COMMANDS);

await commandQueue.add('BAN_USER', {
  type: 'BAN_USER',
  targetUserId: '123456789',
  reason: 'Spamming'
});
```

### **Logging**
```typescript
// Consistent logging across services
import { createConsoleLogger } from '@bubbles/shared';

const logger = createConsoleLogger('my-service');
logger.info('Service started');
```

## 🚨 Troubleshooting

### Common Issues

**1. Shared package not found:**
```bash
cd shared && npm run build
```

**2. Redis connection failed:**
```bash
# Check if Redis is running
redis-cli ping

# Start Redis if not running
redis-server
```

**3. Port already in use:**
```bash
# Check what's using the port
netstat -ano | findstr :3000
netstat -ano | findstr :3001

# Kill process using port
taskkill /PID <PID> /F
```

**4. PM2 processes not starting:**
```bash
# Clear PM2 process list
pm2 delete all
pm2 kill

# Restart from scratch
npm run dev
```

**5. Database connection issues:**
```bash
# Verify MongoDB connection string in .env
# Check if DB_URL is accessible
```

### Debugging

```bash
# View detailed logs for a service
pm2 logs bubbles-bot --lines 100

# Monitor resource usage
pm2 monit

# Check PM2 configuration
pm2 show bubbles-api

# Restart with fresh logs
pm2 restart bubbles-api && pm2 logs bubbles-api
```

### Health Checks

```bash
# API Health Check
curl http://localhost:3001/health

# Frontend (should return HTML)
curl http://localhost:3000

# Redis
redis-cli ping

# Bot status (check PM2 logs)
pm2 logs bubbles-bot --lines 5
```

## 📊 Monitoring

### PM2 Monitoring Dashboard

```bash
# Real-time monitoring
npm run monit

# Or directly
pm2 monit
```

### Process Status

```bash
# Quick status overview
npm run status

# Detailed process info
pm2 show bubbles-api
```

### Log Management

```bash
# View all logs
pm2 logs

# View specific service logs
pm2 logs bubbles-bot

# Clear all logs
pm2 flush

# Rotate logs
pm2 reloadLogs
```

## 🎉 Success Indicators

When everything is working correctly, you should see:

1. **PM2 Status**: All 4 services showing `online`
2. **API Health**: http://localhost:3001/health returns `{"status":"ok"}`
3. **Frontend**: http://localhost:3000 loads the dashboard
4. **Bot**: PM2 logs show "Bot is ready!" or similar
5. **Redis**: `redis-cli ping` returns `PONG`

## 🔄 Development Workflow

1. **Start development**: `npm run dev`
2. **Make changes**: Files are watched by nodemon/vite
3. **Check logs**: `npm run dev:logs` 
4. **Debug issues**: `pm2 logs <service-name>`
5. **Restart if needed**: `pm2 restart <service-name>`
6. **Stop when done**: `npm run stop`

The PM2 setup provides better process isolation, easier debugging, and more granular control compared to Docker Compose while maintaining the same microservices architecture. 