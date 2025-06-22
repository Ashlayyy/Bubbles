import dotenv from 'dotenv';

dotenv.config();

export interface Config {
	port: number;
	nodeEnv: string;
	dbUrl: string;
	redis: {
		host: string;
		port: number;
		password?: string;
	};
	discord: {
		clientId: string;
		clientSecret: string;
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
		port: parseInt(process.env.PORT || '3001'),
		nodeEnv: process.env.NODE_ENV || 'development',
		dbUrl: process.env.DB_URL || 'mongodb://localhost:27017/discord-bot',
		redis: {
			host: process.env.REDIS_HOST || 'localhost',
			port: parseInt(process.env.REDIS_PORT || '6379'),
			password: process.env.REDIS_PASSWORD,
		},
		discord: {
			clientId: process.env.DISCORD_CLIENT_ID || 'default-client-id',
			clientSecret:
				process.env.DISCORD_CLIENT_SECRET || 'default-client-secret',
			redirectUri:
				process.env.DISCORD_REDIRECT_URI ||
				'http://localhost:3001/api/auth/discord/callback',
		},
		jwt: {
			secret: process.env.JWT_SECRET || 'default-jwt-secret-for-development',
			expiresIn: process.env.JWT_EXPIRES_IN || '24h',
		},
		cors: {
			origin: process.env.CORS_ORIGIN || 'http://localhost:3000',
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
	};
};

export const config = getConfig();
