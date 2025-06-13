# Technology Stack & Setup Guide

## 🛠️ Technology Overview

### Core Stack

- **Backend**: Node.js + TypeScript + Express.js
- **Frontend**: Vue.js 3 + TypeScript + Vite
- **Bot**: Discord.js + TypeScript (existing)
- **Database**: MongoDB + Prisma (existing)
- **Message Queue**: Redis + Bull Queue
- **Real-time**: Socket.io
- **Authentication**: JWT + Discord OAuth

### Development Tools

- **Package Manager**: npm
- **Type Checking**: TypeScript 5.x
- **Code Quality**: ESLint + Prettier
- **Testing**: Vitest (for unit tests)
- **Containerization**: Docker + Docker Compose
- **Process Management**: PM2 (production)

---

## 🤖 Bot Service Stack

### Dependencies

```json
{
  "dependencies": {
    // Existing Discord.js stack
    "discord.js": "^14.14.1",
    "discord-player": "^7.1.0",
    "@discord-player/extractor": "^7.1.0",
    "@prisma/client": "^6.9.0",

    // Queue & Redis
    "bull": "^4.12.2",
    "ioredis": "^5.3.2",

    // Utilities
    "dotenv": "^16.4.7",
    "winston": "^3.17.0",
    "lodash": "^4.17.21"
  },
  "devDependencies": {
    "@types/node": "^22.13.10",
    "@types/bull": "^4.10.0",
    "typescript": "^5.8.2",
    "nodemon": "^3.1.9"
  }
}
```

### TypeScript Configuration

```json
// bot/tsconfig.json
{
  "extends": "../tsconfig.base.json",
  "compilerOptions": {
    "outDir": "./dist",
    "rootDir": "./src",
    "types": ["node"]
  },
  "include": ["src/**/*"],
  "exclude": ["node_modules", "dist"]
}
```

### Environment Setup

```env
# bot/.env
# Discord Configuration
DISCORD_TOKEN=your_bot_token
CLIENT_ID=your_client_id
TEST_GUILD_ID=your_test_guild_id

# Database
DB_URL=mongodb+srv://username:password@cluster.mongodb.net/dbname

# Redis Queue
REDIS_URL=redis://localhost:6379
QUEUE_PREFIX=discord_bot

# Service Configuration
BOT_SERVICE_PORT=3002
NODE_ENV=development

# Developer IDs
DEVELOPER_USER_IDS=user_id_1,user_id_2
```

---

## 🔌 API Service Stack

### Dependencies

```json
{
  "dependencies": {
    // Express & HTTP
    "express": "^4.18.2",
    "cors": "^2.8.5",
    "helmet": "^7.1.0",
    "compression": "^1.7.4",
    "express-rate-limit": "^7.1.5",

    // Authentication
    "jsonwebtoken": "^9.0.2",
    "passport": "^0.7.0",
    "passport-discord": "^0.1.4",

    // Real-time Communication
    "socket.io": "^4.7.4",

    // Queue & Redis
    "bull": "^4.12.2",
    "ioredis": "^5.3.2",

    // Database
    "@prisma/client": "^6.9.0",

    // Validation
    "joi": "^17.11.0",
    "express-validator": "^7.0.1",

    // Utilities
    "dotenv": "^16.4.7",
    "winston": "^3.17.0",
    "lodash": "^4.17.21",
    "dayjs": "^1.11.10"
  },
  "devDependencies": {
    "@types/express": "^4.17.21",
    "@types/cors": "^2.8.17",
    "@types/jsonwebtoken": "^9.0.5",
    "@types/passport": "^1.0.16",
    "@types/compression": "^1.7.5",
    "@types/node": "^22.13.10",
    "typescript": "^5.8.2",
    "nodemon": "^3.1.9",
    "vitest": "^1.1.0"
  }
}
```

### Express Server Setup

```typescript
// api/src/app.ts
import express from "express";
import cors from "cors";
import helmet from "helmet";
import compression from "compression";
import rateLimit from "express-rate-limit";
import { Server as SocketServer } from "socket.io";
import { createServer } from "http";

const app = express();
const server = createServer(app);
const io = new SocketServer(server, {
  cors: {
    origin: process.env.FRONTEND_URL || "http://localhost:3000",
    credentials: true,
  },
});

// Middleware
app.use(helmet());
app.use(compression());
app.use(
  cors({
    origin: process.env.FRONTEND_URL || "http://localhost:3000",
    credentials: true,
  })
);
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true }));

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // limit each IP to 100 requests per windowMs
});
app.use("/api/", limiter);
```

### Environment Setup

```env
# api/.env
# Server Configuration
PORT=3001
NODE_ENV=development

# Database
DB_URL=mongodb+srv://username:password@cluster.mongodb.net/dbname

# JWT Configuration
JWT_SECRET=your_super_secret_jwt_key_here
JWT_EXPIRES_IN=7d

# Discord OAuth
DISCORD_CLIENT_ID=your_discord_client_id
DISCORD_CLIENT_SECRET=your_discord_client_secret
DISCORD_REDIRECT_URI=http://localhost:3000/auth/callback

# Redis Queue
REDIS_URL=redis://localhost:6379
QUEUE_PREFIX=discord_bot

# CORS
FRONTEND_URL=http://localhost:3000

# Rate Limiting
RATE_LIMIT_WINDOW_MS=900000
RATE_LIMIT_MAX_REQUESTS=100
```

---

## 🌐 Frontend Service Stack

### Dependencies

```json
{
  "dependencies": {
    // Vue.js Core
    "vue": "^3.4.0",
    "vue-router": "^4.2.5",
    "pinia": "^2.1.7",

    // HTTP & WebSocket
    "axios": "^1.6.2",
    "socket.io-client": "^4.7.4",

    // UI Framework
    "@headlessui/vue": "^1.7.16",
    "@heroicons/vue": "^2.0.18",
    "tailwindcss": "^3.3.6",

    // Charts & Visualization
    "chart.js": "^4.4.0",
    "vue-chartjs": "^5.2.0",

    // Form Handling
    "vee-validate": "^4.12.2",
    "yup": "^1.3.3",

    // Utilities
    "dayjs": "^1.11.10",
    "lodash-es": "^4.17.21",
    "@vueuse/core": "^10.7.0"
  },
  "devDependencies": {
    // Build Tools
    "@vitejs/plugin-vue": "^4.5.2",
    "vite": "^5.0.8",

    // TypeScript
    "typescript": "^5.3.3",
    "vue-tsc": "^1.8.25",

    // CSS
    "@tailwindcss/forms": "^0.5.7",
    "@tailwindcss/typography": "^0.5.10",
    "autoprefixer": "^10.4.16",
    "postcss": "^8.4.32",

    // Types
    "@types/lodash-es": "^4.17.12"
  }
}
```

### Vite Configuration

```typescript
// frontend/vite.config.ts
import { defineConfig } from "vite";
import vue from "@vitejs/plugin-vue";
import { resolve } from "path";

export default defineConfig({
  plugins: [vue()],
  resolve: {
    alias: {
      "@": resolve(__dirname, "src"),
      "@components": resolve(__dirname, "src/components"),
      "@views": resolve(__dirname, "src/views"),
      "@stores": resolve(__dirname, "src/stores"),
      "@services": resolve(__dirname, "src/services"),
      "@types": resolve(__dirname, "src/types"),
    },
  },
  server: {
    port: 3000,
    proxy: {
      "/api": {
        target: "http://localhost:3001",
        changeOrigin: true,
      },
    },
  },
  build: {
    target: "esnext",
    outDir: "dist",
    sourcemap: true,
  },
});
```

### Tailwind Configuration

```javascript
// frontend/tailwind.config.js
module.exports = {
  content: ["./index.html", "./src/**/*.{vue,js,ts,jsx,tsx}"],
  theme: {
    extend: {
      colors: {
        discord: {
          primary: "#5865F2",
          secondary: "#4752C4",
          success: "#57F287",
          warning: "#FEE75C",
          danger: "#ED4245",
          dark: "#2C2F33",
          darker: "#23272A",
        },
      },
    },
  },
  plugins: [require("@tailwindcss/forms"), require("@tailwindcss/typography")],
};
```

### Environment Setup

```env
# frontend/.env
# API Configuration
VITE_API_URL=http://localhost:3001
VITE_WS_URL=ws://localhost:3001

# Discord OAuth
VITE_DISCORD_CLIENT_ID=your_discord_client_id
VITE_DISCORD_REDIRECT_URI=http://localhost:3000/auth/callback

# App Configuration
VITE_APP_NAME=Discord Bot Dashboard
VITE_APP_VERSION=1.0.0
VITE_APP_DESCRIPTION=Manage your Discord bot from the web

# Feature Flags
VITE_ENABLE_MUSIC=true
VITE_ENABLE_MODERATION=true
VITE_ENABLE_APPEALS=true
```

---

## 📨 Redis & Message Queue Setup

### Redis Configuration

```yaml
# docker-compose.yml
version: "3.8"
services:
  redis:
    image: redis:7-alpine
    container_name: discord_bot_redis
    ports:
      - "6379:6379"
    volumes:
      - redis_data:/data
    command: >
      redis-server 
      --appendonly yes 
      --appendfsync everysec
      --maxmemory 256mb
      --maxmemory-policy allkeys-lru
    healthcheck:
      test: ["CMD", "redis-cli", "ping"]
      interval: 30s
      timeout: 10s
      retries: 3

volumes:
  redis_data:
```

### Bull Queue Configuration

```typescript
// shared/queue/config.ts
import Bull from "bull";
import Redis from "ioredis";

const redisConfig = {
  host: process.env.REDIS_HOST || "localhost",
  port: parseInt(process.env.REDIS_PORT || "6379"),
  password: process.env.REDIS_PASSWORD,
  db: parseInt(process.env.REDIS_DB || "0"),
  retryDelayOnFailover: 100,
  enableReadyCheck: false,
  lazyConnect: true,
};

export const createQueue = (name: string) =>
  new Bull(name, {
    redis: redisConfig,
    defaultJobOptions: {
      removeOnComplete: 10,
      removeOnFail: 5,
      attempts: 3,
      backoff: {
        type: "exponential",
        delay: 2000,
      },
    },
  });

export const redis = new Redis(redisConfig);
```

---

## 🐳 Docker Configuration

### Multi-Service Docker Compose

```yaml
# docker-compose.yml
version: "3.8"

services:
  redis:
    image: redis:7-alpine
    ports:
      - "6379:6379"
    volumes:
      - redis_data:/data
    command: redis-server --appendonly yes

  bot:
    build:
      context: ./bot
      dockerfile: Dockerfile
    ports:
      - "3002:3002"
    depends_on:
      - redis
    environment:
      - NODE_ENV=production
      - REDIS_URL=redis://redis:6379
    volumes:
      - ./bot/.env:/app/.env
    restart: unless-stopped

  api:
    build:
      context: ./api
      dockerfile: Dockerfile
    ports:
      - "3001:3001"
    depends_on:
      - redis
    environment:
      - NODE_ENV=production
      - REDIS_URL=redis://redis:6379
    volumes:
      - ./api/.env:/app/.env
    restart: unless-stopped

  frontend:
    build:
      context: ./frontend
      dockerfile: Dockerfile
    ports:
      - "3000:3000"
    depends_on:
      - api
    environment:
      - NODE_ENV=production
    volumes:
      - ./frontend/.env:/app/.env
    restart: unless-stopped

volumes:
  redis_data:
```

### Individual Dockerfiles

```dockerfile
# bot/Dockerfile
FROM node:20-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production
COPY . .
RUN npm run build
EXPOSE 3002
CMD ["npm", "start"]

# api/Dockerfile
FROM node:20-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production
COPY . .
RUN npm run build
EXPOSE 3001
CMD ["npm", "start"]

# frontend/Dockerfile
FROM node:20-alpine as builder
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

FROM nginx:alpine
COPY --from=builder /app/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/nginx.conf
EXPOSE 3000
CMD ["nginx", "-g", "daemon off;"]
```

---

## 🚀 Development Setup Commands

### Initial Setup

```bash
# Clone and setup
git clone <your-repo>
cd discord-bot-microservices

# Install dependencies for all services
npm run install:all

# Setup environment files
cp bot/.env.example bot/.env
cp api/.env.example api/.env
cp frontend/.env.example frontend/.env

# Start Redis
docker-compose up redis -d

# Generate Prisma client
npm run prisma:generate

# Start all services in development
npm run dev
```

### Package.json Scripts

```json
{
  "scripts": {
    "install:all": "npm install && cd bot && npm install && cd ../api && npm install && cd ../frontend && npm install",
    "dev": "concurrently \"npm run dev:bot\" \"npm run dev:api\" \"npm run dev:frontend\"",
    "dev:bot": "cd bot && npm run dev",
    "dev:api": "cd api && npm run dev",
    "dev:frontend": "cd frontend && npm run dev",
    "build:all": "npm run build:bot && npm run build:api && npm run build:frontend",
    "docker:dev": "docker-compose -f docker-compose.dev.yml up",
    "docker:prod": "docker-compose up -d"
  }
}
```

## 📚 Related Documentation

- [[01-architecture-overview]] - System overview
- [[02-service-breakdown]] - Service specifications
- [[04-implementation-phases]] - Development phases
- [[05-directory-structure]] - Project organization
- [[08-development-workflow]] - Development process
