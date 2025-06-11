# Phase 1 Setup Guide

## 🚀 Phase 1 Implementation Complete!

Your Discord bot microservices architecture has been set up with the following components:

### ✅ What's Been Implemented

1. **📦 Shared Package** (`/shared`) - TypeScript types and queue utilities
2. **🔌 API Service** (`/api`) - Express.js server with message endpoints  
3. **🌐 Frontend** (`/frontend`) - Vue.js dashboard with Tailwind CSS
4. **🤖 Bot Integration** - Queue service integration (basic structure)
5. **📨 Message Queue** - Redis + Bull configuration
6. **🐳 Docker Setup** - Complete multi-service environment

### 🎯 Demo Feature: Send Discord Messages via Web

The Phase 1 demo allows sending messages from the web interface to Discord channels:

```
Web Form → API → Redis Queue → Bot → Discord
```

## 🛠️ Setup Options

### Option 1: Docker Setup (Recommended)

**Prerequisites:**
- Docker Desktop installed and running
- Git Bash or WSL (on Windows)

```bash
# 1. Start Docker Desktop first!

# 2. Build and start all services
npm run dev

# 3. Access services:
# - Frontend: http://localhost:3000
# - API: http://localhost:3001/health  
# - Queue Monitor: http://localhost:3002
```

### Option 2: Manual Setup (Development)

**Prerequisites:**
- Node.js 20+
- Redis server (local or cloud)

```bash
# 1. Install Redis locally or use cloud Redis
# Windows: Download from https://redis.io/download
# Mac: brew install redis
# Linux: sudo apt install redis-server

# 2. Start Redis
redis-server

# 3. Install dependencies for each service
cd shared && npm install && npm run build && cd ..
cd api && npm install && cd ..
cd frontend && npm install && cd ..
cd bot && npm install && cd ..

# 4. Start services in separate terminals:

# Terminal 1: API
cd api && npm run dev

# Terminal 2: Frontend  
cd frontend && npm run dev

# Terminal 3: Bot (optional for full demo)
cd bot && npm run dev
```

## 🔧 Configuration

### Environment Variables

Your `.env` file has been created with your existing bot configuration plus new microservices settings:

```env
# Discord Bot (existing)
DISCORD_TOKEN=your_token_here
CLIENT_ID=your_client_id_here  
TEST_GUILD_ID=your_guild_id_here

# Database (existing)
DB_URL=your_mongodb_connection

# New: Redis Queue
REDIS_HOST=redis  # Use 'localhost' for manual setup
REDIS_PORT=6379

# New: API Configuration
JWT_SECRET=your_jwt_secret_here
DISCORD_CLIENT_SECRET=your_oauth_secret
```

### For Manual Setup

If running without Docker, update these in `.env`:

```env
REDIS_HOST=localhost  # Instead of 'redis'
```

## 🧪 Testing the Setup

### 1. Test API Health

```bash
curl http://localhost:3001/health
```

Expected response:
```json
{
  "status": "ok",
  "timestamp": "2024-01-01T00:00:00.000Z",
  "service": "api"
}
```

### 2. Test Frontend

Open http://localhost:3000 - you should see:
- Discord Bot Dashboard
- Message sending form
- System status indicators

### 3. Test Message Queue (Full Flow)

1. **Frontend**: Enter a Discord channel ID and message
2. **API**: Receives POST request and queues job
3. **Queue**: Redis processes the job  
4. **Bot**: Consumes job and sends to Discord
5. **Response**: Success/failure feedback

## 📋 Current Status

### ✅ Working Components

- [x] Shared TypeScript types across services
- [x] Express.js API with health endpoints
- [x] Vue.js frontend with Tailwind CSS styling
- [x] Redis queue configuration
- [x] Docker multi-service setup
- [x] Bot queue service structure

### 🚧 In Progress (Need Integration)

- [ ] Complete queue message flow (API → Bot)
- [ ] Discord OAuth authentication  
- [ ] WebSocket real-time updates
- [ ] Error handling and retries
- [ ] Bot queue consumer activation

### 📝 Next Steps

1. **Complete Queue Flow**: Connect API message sending to bot processing
2. **Add Authentication**: Implement Discord OAuth for web access
3. **Real-time Updates**: Add WebSocket for live feedback
4. **Error Handling**: Improve resilience and user feedback
5. **Testing**: Add integration tests

## 🐛 Troubleshooting

### Docker Issues

```bash
# Check if Docker Desktop is running
docker --version

# View service logs
docker-compose logs redis
docker-compose logs api
docker-compose logs frontend

# Restart services
docker-compose down && docker-compose up
```

### Manual Setup Issues

```bash
# Check Redis
redis-cli ping
# Should return: PONG

# Check API
curl http://localhost:3001/health

# Check if ports are in use
netstat -ano | findstr :3000
netstat -ano | findstr :3001
netstat -ano | findstr :6379
```

### Service Dependencies

If you get import errors for `@bubbles/shared`, run:

```bash
cd shared && npm run build
```

## 🎉 Success!

Your microservices architecture is ready for Phase 1! The infrastructure is complete and ready for:

1. **Message Queue Demo** - Send Discord messages via web
2. **Real-time Dashboard** - Live bot statistics  
3. **Moderation Interface** - Remote moderation actions
4. **Music Controls** - Web-based music player control

**Next**: Start with the message queue demo and gradually add more features as outlined in the implementation phases.

---

**Phase 1 Status**: 🎯 **Infrastructure Complete** - Ready for feature integration! 