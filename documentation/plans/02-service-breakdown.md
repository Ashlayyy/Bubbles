# Service Breakdown & Specifications

## 🤖 Bot Service (`bot/`)

### Core Responsibilities

- **Discord Gateway**: Handle all Discord.js events and interactions
- **Command Processing**: Execute slash commands and context menus
- **Moderation Engine**: Perform moderation actions (ban, kick, timeout, etc.)
- **Music Player**: Control Discord voice connections and audio
- **Queue Consumer**: Process commands from other services
- **Event Publisher**: Broadcast Discord events to other services

### Key Components

```typescript
bot/
├── src/
│   ├── commands/           # Existing command structure
│   ├── events/            # Discord event handlers
│   ├── structures/        # Existing bot structures
│   ├── queue/             # Queue consumer setup
│   │   ├── consumers/     # Event consumers
│   │   ├── processors/    # Job processors
│   │   └── publisher.ts   # Event publisher
│   └── services/
│       ├── moderationService.ts
│       ├── musicService.ts
│       └── queueService.ts
├── package.json
└── Dockerfile
```

### Queue Events Consumed

```typescript
// Commands from API/Web
- SEND_MESSAGE: Send message to Discord channel
- BAN_USER: Execute user ban
- KICK_USER: Execute user kick
- TIMEOUT_USER: Execute user timeout
- PLAY_MUSIC: Add song to music queue
- SKIP_SONG: Skip current song
- PAUSE_MUSIC: Pause/resume music
- UPDATE_CONFIG: Reload bot configuration
```

### Queue Events Published

```typescript
// Events to API/Web
- MEMBER_JOINED: User joined server
- MEMBER_LEFT: User left server
- MESSAGE_DELETED: Message was deleted
- CASE_CREATED: New moderation case
- MUSIC_STARTED: Song started playing
- MUSIC_STOPPED: Music playback stopped
- COMMAND_EXECUTED: Command was processed
- ERROR_OCCURRED: Error in bot operation
```

### Environment Variables

```env
# Existing bot variables
DISCORD_TOKEN=your_bot_token
CLIENT_ID=your_client_id
DB_URL=mongodb_connection

# New queue variables
REDIS_URL=redis://localhost:6379
QUEUE_PREFIX=discord_bot
BOT_SERVICE_PORT=3002
```

---

## 🔌 API Service (`api/`)

### Core Responsibilities

- **REST API**: Provide HTTP endpoints for web dashboard
- **WebSocket Gateway**: Real-time communication with frontend
- **Authentication**: Handle user login and permissions
- **Data Aggregation**: Combine and format data from database
- **Queue Producer**: Send commands to bot service
- **Queue Consumer**: Receive events from bot service

### Key Components

```typescript
api/
├── src/
│   ├── controllers/       # HTTP route handlers
│   │   ├── authController.ts
│   │   ├── moderationController.ts
│   │   ├── musicController.ts
│   │   ├── serverController.ts
│   │   └── dashboardController.ts
│   ├── middleware/        # Express middleware
│   │   ├── auth.ts
│   │   ├── rateLimiter.ts
│   │   └── validation.ts
│   ├── routes/           # API route definitions
│   ├── services/         # Business logic
│   ├── websocket/        # Socket.io handlers
│   ├── queue/           # Queue setup and processors
│   └── types/           # Shared TypeScript types
├── package.json
└── Dockerfile
```

### API Endpoints

```typescript
// Authentication
POST /api/auth/login          # Discord OAuth login
POST /api/auth/logout         # Logout user
GET  /api/auth/me            # Get current user info

// Server Management
GET  /api/servers            # Get user's servers
GET  /api/servers/:id        # Get server details
GET  /api/servers/:id/stats  # Get server statistics

// Moderation
GET  /api/servers/:id/cases         # Get moderation cases
POST /api/servers/:id/cases         # Create new case
GET  /api/servers/:id/cases/:caseId # Get specific case
POST /api/servers/:id/ban           # Ban user
POST /api/servers/:id/kick          # Kick user
POST /api/servers/:id/timeout       # Timeout user

// Music
GET  /api/servers/:id/music/queue   # Get music queue
POST /api/servers/:id/music/play    # Add song to queue
POST /api/servers/:id/music/skip    # Skip current song
POST /api/servers/:id/music/pause   # Pause/resume

// Configuration
GET  /api/servers/:id/config        # Get server config
PUT  /api/servers/:id/config        # Update server config

// Appeals
GET  /api/servers/:id/appeals       # Get appeals list
POST /api/servers/:id/appeals       # Submit appeal
PUT  /api/servers/:id/appeals/:id   # Update appeal status
```

### WebSocket Events

```typescript
// Real-time events sent to frontend
- server_stats_update: Live server statistics
- member_joined: New member notification
- member_left: Member left notification
- case_created: New moderation case
- music_update: Music player state change
- appeal_submitted: New appeal received
- config_updated: Configuration changed
```

### Environment Variables

```env
# API Configuration
PORT=3001
NODE_ENV=development
JWT_SECRET=your_jwt_secret

# Database
DB_URL=mongodb_connection

# Discord OAuth
DISCORD_CLIENT_ID=your_client_id
DISCORD_CLIENT_SECRET=your_client_secret
DISCORD_REDIRECT_URI=http://localhost:3000/auth/callback

# Redis Queue
REDIS_URL=redis://localhost:6379
QUEUE_PREFIX=discord_bot

# CORS
FRONTEND_URL=http://localhost:3000
```

---

## 🌐 Frontend Service (`frontend/`)

### Core Responsibilities

- **User Interface**: Responsive web dashboard
- **Real-time Updates**: WebSocket connection for live data
- **Authentication**: Discord OAuth integration
- **Server Management**: Multi-server dashboard
- **Moderation Interface**: Case management and user actions
- **Music Control**: Remote music player interface

### Key Components

```typescript
frontend/
├── src/
│   ├── components/        # Vue components
│   │   ├── common/        # Shared components
│   │   ├── moderation/    # Moderation-specific components
│   │   ├── music/         # Music player components
│   │   └── dashboard/     # Dashboard components
│   ├── views/            # Page-level components
│   │   ├── Dashboard.vue
│   │   ├── Moderation.vue
│   │   ├── Music.vue
│   │   ├── Appeals.vue
│   │   └── Settings.vue
│   ├── stores/           # Pinia state management
│   │   ├── auth.ts
│   │   ├── servers.ts
│   │   ├── moderation.ts
│   │   └── music.ts
│   ├── services/         # API service layer
│   │   ├── api.ts
│   │   ├── websocket.ts
│   │   └── auth.ts
│   ├── router/           # Vue Router setup
│   ├── composables/      # Vue composition functions
│   └── types/           # TypeScript interfaces
├── package.json
└── Dockerfile
```

### Key Features

```typescript
// Dashboard Features
- Server overview with live stats
- Member count and activity graphs
- Recent moderation cases
- Music player status
- Quick action buttons

// Moderation Features
- Case management table
- User lookup and history
- Bulk moderation actions
- Appeal review interface
- Ban/kick/timeout controls

// Music Features
- Current song display
- Queue management
- Playback controls
- Volume control
- Search and add songs

// Settings Features
- Bot configuration
- Permission management
- Appeals system setup
- Logging configuration
```

### State Management

```typescript
// Pinia stores structure
interface AuthStore {
  user: DiscordUser | null;
  token: string | null;
  isAuthenticated: boolean;
  login(): Promise<void>;
  logout(): void;
}

interface ServerStore {
  selectedServer: Guild | null;
  servers: Guild[];
  stats: ServerStats | null;
  setSelectedServer(serverId: string): void;
  loadStats(): Promise<void>;
}

interface ModerationStore {
  cases: ModerationCase[];
  selectedCase: ModerationCase | null;
  loadCases(): Promise<void>;
  createCase(data: CreateCaseData): Promise<void>;
}
```

### Environment Variables

```env
# API Configuration
VITE_API_URL=http://localhost:3001
VITE_WS_URL=ws://localhost:3001

# Discord OAuth
VITE_DISCORD_CLIENT_ID=your_client_id
VITE_DISCORD_REDIRECT_URI=http://localhost:3000/auth/callback

# App Configuration
VITE_APP_NAME=Discord Bot Dashboard
VITE_APP_VERSION=1.0.0
```

---

## 📨 Message Queue (Redis + Bull)

### Purpose

Facilitate asynchronous communication between services without direct HTTP calls.

### Queue Structure

```typescript
// Queue naming convention
const queues = {
  BOT_COMMANDS: 'bot:commands',      # API → Bot
  BOT_EVENTS: 'bot:events',          # Bot → API
  NOTIFICATIONS: 'notifications',     # Cross-service
  SCHEDULED_TASKS: 'scheduled'       # Delayed/recurring jobs
}
```

### Message Types

```typescript
// Command Messages (API → Bot)
interface BotCommand {
  type: "BAN_USER" | "KICK_USER" | "SEND_MESSAGE" | "PLAY_MUSIC";
  guildId: string;
  userId?: string;
  data: any;
  requestId: string;
  timestamp: Date;
}

// Event Messages (Bot → API)
interface BotEvent {
  type: "MEMBER_JOINED" | "CASE_CREATED" | "MUSIC_STARTED";
  guildId: string;
  data: any;
  timestamp: Date;
}

// Notification Messages (Any → Any)
interface NotificationMessage {
  type: "SUCCESS" | "ERROR" | "WARNING" | "INFO";
  title: string;
  message: string;
  targetUsers?: string[];
  guildId?: string;
}
```

### Redis Configuration

```yaml
# docker-compose.yml Redis service
redis:
  image: redis:7-alpine
  ports:
    - "6379:6379"
  volumes:
    - redis_data:/data
  command: redis-server --appendonly yes
```

## 🔄 Service Communication Matrix

| From / To    | Bot      | API     | Frontend | Queue           |
| ------------ | -------- | ------- | -------- | --------------- |
| **Bot**      | -        | Events  | -        | Publish/Consume |
| **API**      | Commands | -       | HTTP/WS  | Publish/Consume |
| **Frontend** | -        | HTTP/WS | -        | -               |
| **Queue**    | Deliver  | Deliver | -        | -               |

## 📚 Related Documentation

- [[01-architecture-overview]] - System overview
- [[03-technology-stack]] - Technology setup guides
- [[04-implementation-phases]] - Development roadmap
- [[06-api-design]] - API specifications
- [[07-message-queue-patterns]] - Queue event patterns
