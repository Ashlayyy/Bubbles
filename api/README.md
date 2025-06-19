# Discord Bot API

A comprehensive REST API for managing Discord bot functionality, including authentication, guild management, moderation, and more.

## 🚀 Quick Start

```bash
# Install dependencies
npm install

# Copy environment configuration
cp env.example .env

# Start development server
npm run dev
```

## 📋 Implementation Status

### ✅ Completed Features

#### 🔐 Authentication & Authorization

- **POST** `/api/auth/discord/login` - Discord OAuth login
- **POST** `/api/auth/discord/callback` - OAuth callback
- **POST** `/api/auth/logout` - Logout user
- **GET** `/api/auth/me` - Get current user info
- **GET** `/api/auth/refresh` - Refresh token

#### 🏰 Guild Management

- **GET** `/api/users/@me/guilds` - Get user's guilds
- **GET** `/api/guilds/{guildId}` - Get guild info
- **GET** `/api/guilds/{guildId}/dashboard` - Get dashboard stats
- **GET** `/api/guilds/{guildId}/channels` - Get guild channels
- **GET** `/api/guilds/{guildId}/roles` - Get guild roles
- **GET** `/api/guilds/{guildId}/members` - Get guild members (paginated)
- **GET** `/api/guilds/{guildId}/emojis` - Get custom emojis

#### ⚖️ Moderation System (Partial)

- **GET** `/api/guilds/{guildId}/moderation/cases` - Get moderation cases
- **POST** `/api/guilds/{guildId}/moderation/cases` - Create moderation case
- **GET** `/api/guilds/{guildId}/moderation/bans` - Get banned users
- **GET** `/api/guilds/{guildId}/moderation/settings` - Get moderation settings

### 🔧 Infrastructure Components

#### Middleware

- **Authentication**: JWT-based authentication with Discord OAuth
- **Validation**: Joi-based request validation for all endpoints
- **Rate Limiting**: Feature-specific rate limits (auth, moderation, config, etc.)
- **Permissions**: Discord permission checking for guild operations
- **CORS**: Cross-origin resource sharing configuration
- **Security**: Helmet for security headers

#### Type System

- **Discord Types**: Complete Discord API type definitions
- **Moderation Types**: Comprehensive moderation system types
- **Feature Types**: Types for tickets, welcome, leveling, etc.
- **API Types**: Standardized API response types

#### Queue System

- **Integration**: Bull queue integration for bot command execution
- **Job Types**: Moderation actions, configuration updates, etc.

## 🏗️ Architecture

```
api/
├── src/
│   ├── controllers/          # Request handlers
│   │   ├── authController.ts
│   │   ├── guildController.ts
│   │   └── moderationController.ts
│   ├── middleware/           # Request middleware
│   │   ├── auth.ts
│   │   ├── validation.ts
│   │   ├── permissions.ts
│   │   └── rateLimiting.ts
│   ├── routes/              # Route definitions
│   │   ├── auth.ts
│   │   ├── guilds.ts
│   │   ├── moderation.ts
│   │   └── index.ts
│   ├── types/               # TypeScript definitions
│   │   ├── discord.ts
│   │   ├── moderation.ts
│   │   ├── features.ts
│   │   └── shared.ts
│   ├── config/              # Configuration management
│   └── queue/               # Queue management
```

## 🔒 Security Features

- **JWT Authentication**: Secure token-based authentication
- **Rate Limiting**: Per-user and per-guild rate limits
- **Permission Checking**: Discord permission validation
- **Input Validation**: Comprehensive request validation
- **CORS**: Configurable cross-origin policies
- **Security Headers**: Helmet.js integration

## 📝 API Response Format

All API endpoints return responses in a consistent format:

```typescript
interface ApiResponse<T = any> {
	success: boolean;
	data?: T;
	error?: string;
	message?: string;
	pagination?: {
		total?: number;
		limit: number;
		offset: number;
		hasMore: boolean;
	};
}
```

## 🔄 Rate Limits

Different rate limits apply to different endpoint categories:

- **Authentication**: 5 requests per 15 minutes
- **General API**: 100 requests per 15 minutes
- **Moderation**: 20 requests per 5 minutes
- **Configuration**: 30 requests per 10 minutes
- **Analytics**: 50 requests per 5 minutes

## 🚧 Planned Features

The following features are designed but not yet implemented:

### 🎫 Ticket System

- Ticket creation, management, and auto-closure
- Support role assignment and ticket categories
- Thread-based tickets support

### 🎉 Welcome System

- Welcome/goodbye messages with embed support
- Auto-role assignment for new members
- DM welcome messages

### 🎯 Custom Commands

- Text, embed, and reaction-based commands
- Permission-based command restrictions
- Usage statistics and cooldowns

### 📈 Leveling System

- XP tracking and level calculations
- Role rewards and multipliers
- Leaderboards and statistics

### 🎭 Reaction Roles

- Multi-role reaction role systems
- Usage limits and role toggling
- Message-based role assignment

### 📮 Appeals System

- Ban/punishment appeal management
- Review workflow and notifications
- Evidence submission support

### ⭐ Starboard

- Message starring and leaderboards
- Configurable thresholds and emojis
- NSFW filtering and channel exclusions

### ⏰ Reminders

- User and channel reminders
- Recurring reminder support
- Timezone-aware scheduling

### 📊 Analytics

- Server growth and activity metrics
- Moderation statistics
- Member engagement analytics

### 🤖 Automation

- Event-triggered automation rules
- Multi-action automation chains
- Cooldown and trigger limits

### 📋 Applications

- Custom application forms
- Review workflows and auto-roles
- Multi-question form support

### 🎮 Entertainment

- Economy system with daily rewards
- Trivia games and mini-games
- User statistics and achievements

### 🔗 Webhooks

- External webhook integrations
- Event-based webhook triggers
- Secure webhook authentication

## 🛠️ Development

### Environment Variables

Create a `.env` file based on `env.example`:

```bash
# Server Configuration
PORT=3001
NODE_ENV=development

# Discord OAuth
DISCORD_CLIENT_ID=your_discord_client_id
DISCORD_CLIENT_SECRET=your_discord_client_secret
DISCORD_REDIRECT_URI=http://localhost:3001/api/auth/discord/callback

# JWT Configuration
JWT_SECRET=your_super_secret_jwt_key
JWT_EXPIRES_IN=24h

# Redis Configuration (for rate limiting and caching)
REDIS_URL=redis://localhost:6379

# Database Configuration
DATABASE_URL=postgresql://user:password@localhost:5432/discord_bot

# CORS
CORS_ORIGIN=http://localhost:3000
```

### Available Scripts

```bash
npm run dev          # Start development server with nodemon
npm run build        # Build for production
npm run start        # Start production server
npm run lint         # Run ESLint
npm run type-check   # Run TypeScript compiler check
```

## 📚 API Documentation

For detailed API documentation with request/response examples, see the individual route files or use an API documentation tool like Postman or Insomnia with the provided collection.

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add some amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.
