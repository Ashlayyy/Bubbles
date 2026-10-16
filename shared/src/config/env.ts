import { cleanEnv, str, num, bool, url } from 'envalid';

/**
 * Validate and expose environment variables.
 * This is imported by every service at startup to ensure a single, shared schema.
 */
export const env = cleanEnv(process.env, {
	// =============================================================================
	// SERVER CONFIGURATION
	// =============================================================================
	NODE_ENV: str({
		default: 'development',
		choices: ['development', 'production', 'test'],
	}),
	PORT: num({ default: 3001 }), // API port
	API_PORT: num({ default: 3001 }),
	FRONTEND_PORT: num({ default: 8080 }),

	// Base URLs
	API_BASE_URL: url({ default: 'http://localhost:3001' }),
	FRONTEND_BASE_URL: url({ default: 'http://localhost:8080' }),
	VITE_API_URL: url({ default: 'http://localhost:3001/api/v1' }),
	VITE_DISCORD_CLIENT_ID: str({ default: '' }),

	// =============================================================================
	// DATABASE CONFIGURATION
	// =============================================================================
	DB_URL: str(),

	// =============================================================================
	// REDIS CONFIGURATION
	// =============================================================================
	REDIS_HOST: str({ default: 'localhost' }),
	REDIS_PORT: num({ default: 6379 }),
	REDIS_PASSWORD: str({ default: '' }),
	REDIS_URL: str({ default: 'redis://localhost:6379' }),

	// =============================================================================
	// DISCORD APPLICATION CONFIGURATION
	// =============================================================================
	DISCORD_CLIENT_ID: str(),
	DISCORD_CLIENT_SECRET: str(),
	DISCORD_TOKEN: str(),
	DISCORD_REDIRECT_URI: url({
		default: 'http://localhost:3001/api/v1/auth/discord/callback',
	}),

	// Discord specific settings
	TEST_GUILD_ID: str({ default: '' }),
	DEVELOPER_USER_IDS: str({ default: '' }),
	BLACKLIST_SERVER_IDS: str({ default: '' }),

	// =============================================================================
	// JWT AUTHENTICATION
	// =============================================================================
	JWT_SECRET: str(),
	JWT_EXPIRES_IN: str({ default: '24h' }),
	SESSION_SECRET: str({ default: 'your_super_secure_session_secret_here' }),

	// =============================================================================
	// CORS CONFIGURATION
	// =============================================================================
	CORS_ORIGIN: str({ default: 'http://localhost:8080' }),

	// =============================================================================
	// RATE LIMITING
	// =============================================================================
	RATE_LIMIT_WINDOW_MS: num({ default: 900000 }), // 15 minutes
	RATE_LIMIT_MAX_REQUESTS: num({ default: 100 }),

	// =============================================================================
	// WEBSOCKET CONFIGURATION
	// =============================================================================
	WS_URL: str({ default: '' }),
	WS_ORIGIN: str({ default: '' }),
	WS_LOG_ALL: bool({ default: false }),

	// =============================================================================
	// WEBHOOK CONFIGURATION
	// =============================================================================
	DISCORD_WEBHOOK_SECRET: str({ default: '' }),

	// =============================================================================
	// METRICS CONFIGURATION
	// =============================================================================
	METRICS_PORT: num({ default: 9321 }),
	METRICS_ENABLED: bool({ default: true }),
});

export type Env = typeof env;
