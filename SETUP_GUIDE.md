# Bubbles Discord Bot - Setup Guide

This guide will help you set up both the API backend and Vue.js frontend for the Bubbles Discord Bot management dashboard.

## 🚀 Quick Start

### 1. Clone and Install Dependencies

```bash
# Install root dependencies
npm install

# Install API dependencies
cd api && npm install

# Install Frontend dependencies
cd ../frontend && npm install

# Install Shared dependencies
cd ../shared && npm install
```

### 2. Environment Configuration

Copy the root environment example file:

```bash
cp env.example .env
```

Fill in your configuration values in the `.env` file:

#### Required Variables:

- `DISCORD_CLIENT_ID` - Your Discord application client ID
- `DISCORD_CLIENT_SECRET` - Your Discord application client secret
- `DISCORD_BOT_TOKEN` - Your Discord bot token
- `JWT_SECRET` - A secure random string for JWT signing
- `DB_URL` - Your MongoDB connection string

#### Optional Variables:

- `REDIS_HOST`, `REDIS_PORT` - Redis configuration for caching
- `API_PORT` - Port for API server (default: 3001)
- `FRONTEND_PORT` - Port for frontend dev server (default: 8080)

### 3. Run the Applications

#### Development Mode (Both API + Frontend):

```bash
# From root directory - runs both API and frontend
npm run dev
```

#### Or run them separately:

**API Server:**

```bash
cd api
npm run dev
# Runs on http://localhost:3001
```

**Frontend:**

```bash
cd frontend
npm run dev
# Runs on http://localhost:8080
```

### 4. Access the Application

- **Frontend Dashboard:** http://localhost:8080
- **API Documentation:** http://localhost:3001/api/v1
- **Health Check:** http://localhost:3001

## 🏗️ Architecture Overview

```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   Frontend      │    │   API Server    │    │   Discord Bot   │
│   (Vue.js)      │◄──►│   (Express)     │◄──►│   (Node.js)     │
│   Port: 8080    │    │   Port: 3001    │    │                 │
└─────────────────┘    └─────────────────┘    └─────────────────┘
         │                       │                       │
         │                       │                       │
         ▼                       ▼                       ▼
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   Web Browser   │    │   Database      │    │   Discord API   │
│                 │    │   (MongoDB)     │    │                 │
└─────────────────┘    └─────────────────┘    └─────────────────┘
```

## 📁 Project Structure

```
Bubbles/
├── api/                    # Express.js API server
│   ├── src/
│   │   ├── controllers/    # Route handlers
│   │   ├── middleware/     # Express middleware
│   │   ├── routes/         # API routes
│   │   ├── services/       # Business logic
│   │   └── types/          # TypeScript definitions
│   └── package.json
├── frontend/               # Vue.js frontend application
│   ├── src/
│   │   ├── components/     # Vue components
│   │   ├── stores/         # Pinia stores (state management)
│   │   ├── views/          # Page components
│   │   └── lib/            # Utilities and API client
│   └── package.json
├── bot/                    # Discord bot implementation
├── shared/                 # Shared types and utilities
├── .env                    # Environment configuration
└── package.json           # Root package.json with scripts
```

## 🔧 API Configuration

The API server automatically loads configuration from:

1. Root `.env` file (primary configuration)
2. `api/.env` file (local overrides)

### Key API Endpoints:

- `GET /api/v1/health` - Health check
- `POST /api/v1/auth/discord/login` - Discord OAuth login
- `GET /api/v1/auth/me` - Get current user
- `GET /api/v1/guilds` - Get user's Discord servers
- `GET /api/v1/guilds/{id}/...` - Guild-specific endpoints

## 🎨 Frontend Configuration

The frontend is built with:

- **Vue 3** - Progressive JavaScript framework
- **Vite** - Fast build tool and dev server
- **Pinia** - State management
- **Vue Router** - Client-side routing
- **Axios** - HTTP client for API requests

### Environment Variables:

- `VITE_API_URL` - API base URL (default: /api/v1)
- `VITE_WS_URL` - WebSocket URL for real-time features

### Development Features:

- Hot module replacement
- TypeScript support
- Auto-proxy to API server
- Component auto-imports

## 🔗 API-Frontend Integration

### Authentication Flow:

1. User clicks "Login with Discord" in frontend
2. Redirected to Discord OAuth (via API)
3. Discord redirects back to frontend callback
4. Frontend receives JWT token
5. Token stored and used for API requests

### Request Flow:

```
Frontend → Vite Dev Proxy → API Server
  :8080        /api/*         :3001
```

In production, you'll typically:

- Serve frontend as static files
- Use reverse proxy (nginx) to route API requests
- Or deploy to separate domains with CORS

## 🗄️ Database Setup

### MongoDB Options:

**Option 1: MongoDB Atlas (Cloud)**

```bash
DB_URL=mongodb+srv://username:password@cluster.mongodb.net/bubbles
```

**Option 2: Local MongoDB**

```bash
# Install MongoDB locally
DB_URL=mongodb://localhost:27017/bubbles
```

**Option 3: Docker MongoDB**

```bash
docker run -d -p 27017:27017 --name mongodb mongo:latest
DB_URL=mongodb://localhost:27017/bubbles
```

## 🚦 Development Scripts

```bash
# Root scripts (runs both API + Frontend)
npm run dev          # Start both in development mode
npm run build        # Build both applications
npm run start        # Start in production mode

# API scripts
npm run api:dev      # Start API in development
npm run api:build    # Build API
npm run api:start    # Start API in production

# Frontend scripts
npm run frontend:dev   # Start frontend in development
npm run frontend:build # Build frontend
npm run frontend:preview # Preview frontend build
```

## 🐛 Troubleshooting

### Common Issues:

**1. CORS Errors**

- Ensure `CORS_ORIGIN` matches your frontend URL
- Check that `FRONTEND_BASE_URL` is correct

**2. Authentication Issues**

- Verify Discord app settings match redirect URIs
- Check that `JWT_SECRET` is set and secure
- Ensure Discord client ID/secret are correct

**3. Database Connection**

- Verify MongoDB is running and accessible
- Check `DB_URL` format and credentials
- Ensure database allows connections from your IP

**4. Port Conflicts**

- Change `API_PORT` or `FRONTEND_PORT` if defaults are in use
- Kill existing processes: `lsof -ti:3001` or `lsof -ti:8080`

### Debug Mode:

Enable verbose logging by setting:

```bash
WS_LOG_ALL=true
VITE_DEBUG=true
```

## 🔐 Security Considerations

### Development:

- Use strong, unique `JWT_SECRET`
- Never commit real credentials to git
- Use `.env.local` for sensitive overrides

### Production:

- Use HTTPS for all connections
- Set `NODE_ENV=production`
- Use secure session cookies
- Implement rate limiting
- Keep dependencies updated

## 📚 Additional Resources

- [Discord Developer Portal](https://discord.com/developers/applications)
- [Vue.js Documentation](https://vuejs.org/)
- [Express.js Documentation](https://expressjs.com/)
- [MongoDB Documentation](https://docs.mongodb.com/)

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch: `git checkout -b feature/amazing-feature`
3. Make your changes
4. Test locally with `npm run dev`
5. Commit changes: `git commit -m 'Add amazing feature'`
6. Push to branch: `git push origin feature/amazing-feature`
7. Open a Pull Request

---

🎉 **You're all set!** The API and frontend should now be properly connected and running together.
