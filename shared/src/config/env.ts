import { cleanEnv, str, num, bool, url } from 'envalid';

/**
 * Validate and expose environment variables.
 * This is imported by every service at startup to ensure a single, shared schema.
 */
export const env = cleanEnv(process.env, {
	NODE_ENV: str({ default: 'development' }),
	PORT: num({ default: 3001 }),

	// Discord credentials
	DISCORD_TOKEN: str(),
	DISCORD_CLIENT_ID: str(),
	DISCORD_CLIENT_SECRET: str({ default: '' }),
	TEST_GUILD_ID: str({ default: '' }), // optional, dev only

	// Backend services / URLs
	DB_URL: str(),
	REDIS_HOST: str({ default: 'localhost' }),
	REDIS_PORT: num({ default: 6379 }),
	JWT_SECRET: str(),
	JWT_EXPIRES_IN: str({ default: '24h' }),
	SESSION_SECRET: str({ default: '' }),
	WS_URL: str({ default: '' }),
	WS_ORIGIN: str({ default: '' }),

	// Misc
	METRICS_PORT: num({ default: 9321 }),
	METRICS_ENABLED: bool({ default: true }),
	METRICS_TOKEN: str({ default: '' }),
});

export type Env = typeof env;
