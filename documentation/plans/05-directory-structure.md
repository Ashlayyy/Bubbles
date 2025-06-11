# Directory Structure & Organization

## 🏗️ Project Root Structure

```
discord-bot-microservices/
├── README.md
├── package.json                    # Root package.json for scripts
├── docker-compose.yml             # Development environment
├── docker-compose.prod.yml        # Production environment
├── .gitignore
├── .env.example
├── tsconfig.base.json             # Shared TypeScript config
│
├── bot/                           # Discord Bot Service
│   ├── src/
│   ├── package.json
│   ├── tsconfig.json
│   ├── Dockerfile
│   ├── .env.example
│   └── nodemon.json
│
├── api/                           # Express API Service
│   ├── src/
│   ├── package.json
│   ├── tsconfig.json
│   ├── Dockerfile
│   ├── .env.example
│   └── nodemon.json
│
├── frontend/                      # Vue.js Frontend
│   ├── src/
│   ├── public/
│   ├── package.json
│   ├── tsconfig.json
│   ├── vite.config.ts
│   ├── tailwind.config.js
│   ├── Dockerfile
│   └── .env.example
│
├── shared/                        # Shared code between services
│   ├── types/                     # TypeScript interfaces
│   ├── utils/                     # Utility functions
│   ├── queue/                     # Queue configurations
│   └── database/                  # Database schemas
│
├── documentation/                 # Project documentation
│   ├── plans/                     # Implementation plans
│   ├── api/                       # API documentation
│   ├── guides/                    # Setup and user guides
│   └── diagrams/                  # Architecture diagrams
│
├── scripts/                       # Build and deployment scripts
│   ├── setup.sh                   # Initial setup script
│   ├── build.sh                   # Build all services
│   └── deploy.sh                  # Deployment script
│
└── monitoring/                    # Monitoring configurations
    ├── prometheus/                # Metrics collection
    ├── grafana/                   # Dashboards
    └── logs/                      # Centralized logging
```

---

## 🤖 Bot Service Structure

```
bot/
├── src/
│   ├── commands/                  # Existing command structure
│   │   ├── admin/
│   │   ├── general/
│   │   ├── moderation/
│   │   ├── music/
│   │   └── context/
│   │
│   ├── events/                    # Discord event handlers
│   │   ├── client/
│   │   ├── musicPlayer/
│   │   └── prisma/
│   │
│   ├── structures/                # Bot class structures
│   │   ├── Client.ts
│   │   ├── Command.ts
│   │   ├── Event.ts
│   │   └── ...
│   │
│   ├── queue/                     # NEW: Queue integration
│   │   ├── consumers/             # Queue consumers
│   │   │   ├── messageConsumer.ts
│   │   │   ├── moderationConsumer.ts
│   │   │   ├── musicConsumer.ts
│   │   │   └── configConsumer.ts
│   │   │
│   │   ├── processors/            # Job processors
│   │   │   ├── sendMessage.ts
│   │   │   ├── banUser.ts
│   │   │   ├── kickUser.ts
│   │   │   └── playMusic.ts
│   │   │
│   │   ├── publishers/            # Event publishers
│   │   │   ├── discordEvents.ts
│   │   │   ├── moderationEvents.ts
│   │   │   └── musicEvents.ts
│   │   │
│   │   └── setup.ts               # Queue configuration
│   │
│   ├── services/                  # NEW: Service layer
│   │   ├── queueService.ts        # Queue management
│   │   ├── moderationService.ts   # Moderation logic
│   │   ├── musicService.ts        # Music logic
│   │   └── configService.ts       # Configuration management
│   │
│   ├── functions/                 # Existing utility functions
│   │   ├── discord/
│   │   ├── general/
│   │   └── music/
│   │
│   ├── database/                  # Existing database layer
│   │   ├── GuildConfig.ts
│   │   ├── ReactionRoles.ts
│   │   └── index.ts
│   │
│   ├── config/                    # Existing configurations
│   │   ├── appeals.ts
│   │   └── escalation.ts
│   │
│   ├── index.ts                   # Main bot entry point
│   ├── botConfig.ts               # Bot configuration
│   └── logger.ts                  # Logging setup
│
├── dist/                          # Compiled JavaScript output
├── logs/                          # Bot logs
├── package.json
├── tsconfig.json
├── Dockerfile
├── .env.example
├── .dockerignore
└── nodemon.json
```

---

## 🔌 API Service Structure

```
api/
├── src/
│   ├── controllers/               # HTTP route handlers
│   │   ├── authController.ts      # Authentication endpoints
│   │   ├── serverController.ts    # Server management
│   │   ├── moderationController.ts # Moderation endpoints
│   │   ├── musicController.ts     # Music control endpoints
│   │   ├── dashboardController.ts # Dashboard data
│   │   ├── appealsController.ts   # Appeals management
│   │   └── configController.ts    # Configuration endpoints
│   │
│   ├── middleware/                # Express middleware
│   │   ├── auth.ts                # JWT authentication
│   │   ├── validation.ts          # Request validation
│   │   ├── rateLimiter.ts         # Rate limiting
│   │   ├── errorHandler.ts        # Error handling
│   │   └── cors.ts                # CORS configuration
│   │
│   ├── routes/                    # API route definitions
│   │   ├── auth.ts                # Authentication routes
│   │   ├── servers.ts             # Server routes
│   │   ├── moderation.ts          # Moderation routes
│   │   ├── music.ts               # Music routes
│   │   ├── dashboard.ts           # Dashboard routes
│   │   ├── appeals.ts             # Appeals routes
│   │   └── index.ts               # Route aggregation
│   │
│   ├── services/                  # Business logic layer
│   │   ├── authService.ts         # Authentication logic
│   │   ├── discordService.ts      # Discord API integration
│   │   ├── moderationService.ts   # Moderation business logic
│   │   ├── musicService.ts        # Music business logic
│   │   ├── statsService.ts        # Statistics calculation
│   │   └── cacheService.ts        # Caching layer
│   │
│   ├── websocket/                 # WebSocket handlers
│   │   ├── handlers/              # Socket event handlers
│   │   │   ├── connectionHandler.ts
│   │   │   ├── dashboardHandler.ts
│   │   │   ├── moderationHandler.ts
│   │   │   └── musicHandler.ts
│   │   │
│   │   ├── middleware/            # Socket middleware
│   │   │   ├── authMiddleware.ts
│   │   │   └── rateLimitMiddleware.ts
│   │   │
│   │   └── setup.ts               # Socket.io configuration
│   │
│   ├── queue/                     # Queue integration
│   │   ├── producers/             # Queue producers
│   │   │   ├── botCommands.ts     # Send commands to bot
│   │   │   └── notifications.ts   # Send notifications
│   │   │
│   │   ├── consumers/             # Queue consumers
│   │   │   ├── botEvents.ts       # Receive bot events
│   │   │   └── webhooks.ts        # Process webhooks
│   │   │
│   │   └── setup.ts               # Queue configuration
│   │
│   ├── database/                  # Database layer
│   │   ├── models/                # Database models
│   │   ├── repositories/          # Data access layer
│   │   └── migrations/            # Database migrations
│   │
│   ├── utils/                     # Utility functions
│   │   ├── validators.ts          # Input validation
│   │   ├── helpers.ts             # Helper functions
│   │   ├── constants.ts           # Application constants
│   │   └── errors.ts              # Custom error classes
│   │
│   ├── types/                     # TypeScript type definitions
│   │   ├── api.ts                 # API types
│   │   ├── discord.ts             # Discord types
│   │   ├── database.ts            # Database types
│   │   └── queue.ts               # Queue types
│   │
│   ├── config/                    # Configuration files
│   │   ├── database.ts            # Database configuration
│   │   ├── redis.ts               # Redis configuration
│   │   ├── discord.ts             # Discord configuration
│   │   └── app.ts                 # Application configuration
│   │
│   ├── app.ts                     # Express app setup
│   ├── server.ts                  # Server startup
│   └── logger.ts                  # Logging configuration
│
├── dist/                          # Compiled JavaScript output
├── logs/                          # API logs
├── tests/                         # Unit and integration tests
├── package.json
├── tsconfig.json
├── Dockerfile
├── .env.example
├── .dockerignore
└── nodemon.json
```

---

## 🌐 Frontend Service Structure

```
frontend/
├── src/
│   ├── components/                # Vue components
│   │   ├── common/                # Shared components
│   │   │   ├── BaseButton.vue
│   │   │   ├── BaseModal.vue
│   │   │   ├── BaseInput.vue
│   │   │   ├── LoadingSpinner.vue
│   │   │   └── ErrorMessage.vue
│   │   │
│   │   ├── layout/                # Layout components
│   │   │   ├── AppHeader.vue
│   │   │   ├── AppSidebar.vue
│   │   │   ├── AppFooter.vue
│   │   │   └── MainLayout.vue
│   │   │
│   │   ├── dashboard/             # Dashboard components
│   │   │   ├── ServerStats.vue
│   │   │   ├── ActivityFeed.vue
│   │   │   ├── QuickActions.vue
│   │   │   └── ServerSelector.vue
│   │   │
│   │   ├── moderation/            # Moderation components
│   │   │   ├── CasesList.vue
│   │   │   ├── CaseDetail.vue
│   │   │   ├── UserLookup.vue
│   │   │   ├── ModerationActions.vue
│   │   │   └── BulkActions.vue
│   │   │
│   │   ├── music/                 # Music components
│   │   │   ├── MusicPlayer.vue
│   │   │   ├── MusicQueue.vue
│   │   │   ├── SongSearch.vue
│   │   │   └── PlaylistManager.vue
│   │   │
│   │   ├── appeals/               # Appeals components
│   │   │   ├── AppealsList.vue
│   │   │   ├── AppealDetail.vue
│   │   │   ├── AppealForm.vue
│   │   │   └── AppealReview.vue
│   │   │
│   │   └── settings/              # Settings components
│   │       ├── BotConfig.vue
│   │       ├── PermissionConfig.vue
│   │       ├── LoggingConfig.vue
│   │       └── GeneralSettings.vue
│   │
│   ├── views/                     # Page-level components
│   │   ├── Dashboard.vue          # Main dashboard page
│   │   ├── Moderation.vue         # Moderation management
│   │   ├── Music.vue              # Music player page
│   │   ├── Appeals.vue            # Appeals management
│   │   ├── Settings.vue           # Settings page
│   │   ├── Login.vue              # Login page
│   │   └── NotFound.vue           # 404 page
│   │
│   ├── stores/                    # Pinia state management
│   │   ├── auth.ts                # Authentication store
│   │   ├── servers.ts             # Server management store
│   │   ├── moderation.ts          # Moderation store
│   │   ├── music.ts               # Music player store
│   │   ├── appeals.ts             # Appeals store
│   │   ├── notifications.ts       # Notifications store
│   │   └── websocket.ts           # WebSocket store
│   │
│   ├── services/                  # API service layer
│   │   ├── api.ts                 # Base API client
│   │   ├── authService.ts         # Authentication API
│   │   ├── serverService.ts       # Server API
│   │   ├── moderationService.ts   # Moderation API
│   │   ├── musicService.ts        # Music API
│   │   ├── appealsService.ts      # Appeals API
│   │   └── websocketService.ts    # WebSocket client
│   │
│   ├── composables/               # Vue composition functions
│   │   ├── useAuth.ts             # Authentication composable
│   │   ├── useWebSocket.ts        # WebSocket composable
│   │   ├── useNotifications.ts    # Notifications composable
│   │   ├── usePagination.ts       # Pagination composable
│   │   └── useModal.ts            # Modal composable
│   │
│   ├── router/                    # Vue Router setup
│   │   ├── index.ts               # Router configuration
│   │   ├── guards.ts              # Route guards
│   │   └── routes.ts              # Route definitions
│   │
│   ├── types/                     # TypeScript interfaces
│   │   ├── api.ts                 # API response types
│   │   ├── discord.ts             # Discord types
│   │   ├── auth.ts                # Authentication types
│   │   ├── moderation.ts          # Moderation types
│   │   └── music.ts               # Music types
│   │
│   ├── utils/                     # Utility functions
│   │   ├── formatters.ts          # Data formatters
│   │   ├── validators.ts          # Form validation
│   │   ├── constants.ts           # Application constants
│   │   └── helpers.ts             # Helper functions
│   │
│   ├── styles/                    # Global styles
│   │   ├── globals.css            # Global CSS
│   │   ├── components.css         # Component styles
│   │   └── utilities.css          # Utility classes
│   │
│   ├── assets/                    # Static assets
│   │   ├── images/                # Images
│   │   ├── icons/                 # Icons
│   │   └── fonts/                 # Custom fonts
│   │
│   ├── App.vue                    # Root Vue component
│   ├── main.ts                    # Application entry point
│   └── vite-env.d.ts              # Vite type definitions
│
├── public/                        # Public assets
│   ├── favicon.ico
│   ├── manifest.json
│   └── robots.txt
│
├── dist/                          # Built application
├── tests/                         # Frontend tests
├── package.json
├── tsconfig.json
├── vite.config.ts
├── tailwind.config.js
├── postcss.config.js
├── Dockerfile
├── nginx.conf                     # Nginx configuration
├── .env.example
└── .dockerignore
```

---

## 📚 Shared Code Structure

```
shared/
├── types/                         # Shared TypeScript interfaces
│   ├── discord.ts                 # Discord-related types
│   ├── database.ts                # Database schema types
│   ├── queue.ts                   # Queue message types
│   ├── api.ts                     # API request/response types
│   └── common.ts                  # Common utility types
│
├── utils/                         # Shared utility functions
│   ├── validation.ts              # Input validation helpers
│   ├── formatting.ts              # Data formatting utilities
│   ├── constants.ts               # Application constants
│   └── errors.ts                  # Custom error classes
│
├── queue/                         # Queue configuration
│   ├── config.ts                  # Queue setup configuration
│   ├── events.ts                  # Queue event definitions
│   └── types.ts                   # Queue-specific types
│
└── database/                      # Shared database code
    ├── schemas/                   # Prisma schemas
    ├── seeders/                   # Database seeders
    └── types.ts                   # Database types
```

---

## 📁 Migration Strategy

### Phase 1: Setup New Structure

1. **Create new directories**: `api/`, `frontend/`, `shared/`
2. **Move existing bot**: Copy current `src/` to `bot/src/`
3. **Setup shared types**: Extract common interfaces to `shared/types/`
4. **Update imports**: Update bot imports to use shared types

### Phase 2: Add Services Incrementally

1. **API Service**: Create basic Express server
2. **Frontend Service**: Initialize Vue.js application
3. **Queue Integration**: Add queue to bot and API
4. **Database Sharing**: Update all services to use shared database

### Phase 3: Organize and Optimize

1. **Code Organization**: Refactor into proper service boundaries
2. **Shared Utilities**: Move common code to shared folder
3. **Type Safety**: Ensure all services use shared types
4. **Documentation**: Document the new structure

## 📚 Related Documentation

- [[01-architecture-overview]] - System overview
- [[02-service-breakdown]] - Service specifications
- [[03-technology-stack]] - Technology setup
- [[04-implementation-phases]] - Development phases
- [[06-api-design]] - API specifications
- [[08-development-workflow]] - Development process
