import dotenv from 'dotenv';
import { resolve } from 'path';
import { existsSync } from 'fs';

// 1) Load repository-root .env first (base config)
const rootEnvPath = resolve(process.cwd(), '../.env');
if (existsSync(rootEnvPath)) {
	dotenv.config({ path: rootEnvPath });
}

// 2) Load environment-specific config (development/production) as override
const nodeEnv = process.env.NODE_ENV ?? 'development';
const envSpecificPath = resolve(process.cwd(), `../.env.${nodeEnv}`);
if (existsSync(envSpecificPath)) {
	dotenv.config({ path: envSpecificPath, override: true });
}

// 3) Load local env (within /api) as final override if present
const localEnvPath = resolve(process.cwd(), '.env');
if (existsSync(localEnvPath)) {
	dotenv.config({ path: localEnvPath, override: true });
}

export interface Config {
	port: number;
	nodeEnv: string;
	dbUrl: string;
	redis: {
		host: string;
		port: number;
		password?: string;
		url: string;
	};
	discord: {
		clientId: string;
		clientSecret: string;
		botToken: string;
		redirectUri: string;
	};
	jwt: {
		secret: string;
		expiresIn: string;
	};
	cors: {
		origin: string;
	};
	rateLimit: {
		windowMs: number;
		max: number;
	};
	session: {
		secret: string;
	};
	websocket: {
		logAll: boolean;
	};
	features: {
		devRoutes: boolean;
		analytics: boolean;
		auditLog: boolean;
	};
}

const getConfig = (): Config => {
	// Only require essential variables for basic functionality
	const requiredEnvVars = ['JWT_SECRET'];

	for (const envVar of requiredEnvVars) {
		if (!process.env[envVar]) {
			console.warn(
				`Missing required environment variable: ${envVar}. Using default value.`
			);
		}
	}

	return {
		port: parseInt(process.env.API_PORT || process.env.PORT || '3001'),
		nodeEnv: process.env.NODE_ENV || 'development',
		dbUrl: process.env.DB_URL || 'mongodb://localhost:27017/bubbles',
		redis: {
			host: process.env.REDIS_HOST || 'localhost',
			port: parseInt(process.env.REDIS_PORT || '6379'),
			password: process.env.REDIS_PASSWORD,
			url:
				process.env.REDIS_URL ||
				`redis://${process.env.REDIS_HOST || 'localhost'}:${
					process.env.REDIS_PORT || '6379'
				}`,
		},
		discord: {
			clientId: process.env.DISCORD_CLIENT_ID || 'default-client-id',
			clientSecret:
				process.env.DISCORD_CLIENT_SECRET || 'default-client-secret',
			botToken: process.env.DISCORD_TOKEN || 'default-bot-token',
			redirectUri:
				process.env.DISCORD_REDIRECT_URI ||
				'http://localhost:8080/auth/callback',
		},
		jwt: {
			secret: process.env.JWT_SECRET || 'default-jwt-secret-for-development',
			expiresIn: process.env.JWT_EXPIRES_IN || '24h',
		},
		cors: {
			origin: process.env.CORS_ORIGIN || 'http://localhost:8080',
		},
		rateLimit: {
			windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS || '900000'),
			max: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS || '100'),
		},
		session: {
			secret:
				process.env.SESSION_SECRET ||
				'a-secure-default-session-secret-for-development',
		},
		websocket: {
			logAll: process.env.WS_LOG_ALL === 'true',
		},
		features: {
			devRoutes:
				process.env.ENABLE_DEV_ROUTES === 'true' ||
				process.env.NODE_ENV === 'development',
			analytics: process.env.ENABLE_ANALYTICS !== 'false',
			auditLog: process.env.ENABLE_AUDIT_LOG !== 'false',
		},
	};
};

export const config = getConfig();
