import type { Response } from 'express';
import { createLogger, type ApiResponse } from '../types/shared.js';
import type { AuthRequest } from '../middleware/auth.js';
import { config } from '../config/index.js';
import { SignJWT } from 'jose';
import { blacklistToken } from '../services/tokenBlacklistService.js';
import { storeDiscordTokens, clearDiscordTokens } from '../services/discordTokenStore.js';
import { Session, SessionData } from 'express-session';
import crypto from 'node:crypto';
import 'express-session';

const logger = createLogger('auth-controller');
const OAUTH_STATE_TTL_MS = 10 * 60 * 1000;

type AuthenticatedRequest = AuthRequest & {
	session: Session &
		Partial<SessionData> & {
			accessToken?: string;
			user?: any; // Stored user object
		};
};

function oauthSigningKey(): string {
	return config.jwt.secret || config.session.secret || 'bubbles-oauth-dev';
}

function signOAuthState(): string {
	const nonce = crypto.randomBytes(16).toString('hex');
	const ts = Date.now().toString(16);
	const payload = `${nonce}.${ts}`;
	const sig = crypto
		.createHmac('sha256', oauthSigningKey())
		.update(payload)
		.digest('hex')
		.slice(0, 32);
	return `${payload}.${sig}`;
}

function safeEqual(a: string, b: string): boolean {
	const left = Buffer.from(a);
	const right = Buffer.from(b);
	if (left.length !== right.length) {
		return false;
	}
	return crypto.timingSafeEqual(left, right);
}

function verifyOAuthState(state: string | undefined, sessionState?: string): boolean {
	if (!state) {
		return false;
	}
	if (sessionState && safeEqual(state, sessionState)) {
		return true;
	}

	const parts = state.split('.');
	if (parts.length !== 3) {
		return false;
	}
	const [nonce, tsHex, sig] = parts;
	if (!nonce || !tsHex || !sig) {
		return false;
	}
	const payload = `${nonce}.${tsHex}`;
	const expected = crypto
		.createHmac('sha256', oauthSigningKey())
		.update(payload)
		.digest('hex')
		.slice(0, 32);
	if (!safeEqual(sig, expected)) {
		return false;
	}
	const createdAt = Number.parseInt(tsHex, 16);
	if (!Number.isFinite(createdAt)) {
		return false;
	}
	const age = Date.now() - createdAt;
	return age >= 0 && age < OAUTH_STATE_TTL_MS;
}

function frontendBaseUrl(): string {
	return (
		process.env.FRONTEND_BASE_URL ||
		process.env.CORS_ORIGIN ||
		'http://localhost:8080'
	);
}

// Discord OAuth login
export const discordLogin = async (req: AuthRequest, res: Response) => {
	try {
		const state = signOAuthState();
		if (req.session) {
			(req.session as any).oauthState = state;
		}
		const scope = 'identify email guilds';

		const discordAuthUrl = `https://discord.com/api/oauth2/authorize?client_id=${
			config.discord.clientId
		}&redirect_uri=${encodeURIComponent(
			config.discord.redirectUri
		)}&response_type=code&scope=${encodeURIComponent(scope)}&state=${encodeURIComponent(state)}`;

		logger.info('Discord OAuth login initiated');

		res.redirect(discordAuthUrl);
	} catch (error) {
		logger.error('Error in Discord login:', error);
		res.status(500).json({
			success: false,
			error: 'Failed to initiate Discord OAuth',
		} as ApiResponse);
	}
};

// Discord OAuth callback
export const discordCallback = async (
	req: AuthenticatedRequest,
	res: Response
) => {
	try {
		// Accept code/state from either query (GET) or body (POST JSON)
		const { code: queryCode, state: queryState } = req.query as {
			code?: string;
			state?: string;
		};
		const { code: bodyCode, state: bodyState } = (req.body || {}) as {
			code?: string;
			state?: string;
		};

		const code = bodyCode || queryCode;
		const state = bodyState || queryState;
		const expectedState = (req.session as any)?.oauthState as string | undefined;

		if (!code) {
			return res.status(400).json({
				success: false,
				error: 'Authorization code is required',
			} as ApiResponse);
		}

		if (!verifyOAuthState(state, expectedState)) {
			return res.status(403).json({
				success: false,
				error: 'Invalid OAuth state',
			} as ApiResponse);
		}

		if (req.session) {
			delete (req.session as any).oauthState;
		}

		// Exchange code for access token with Discord
		const tokenResponse = await fetch(
			'https://discord.com/api/v10/oauth2/token',
			{
				method: 'POST',
				headers: {
					'Content-Type': 'application/x-www-form-urlencoded',
				},
				body: new URLSearchParams({
					client_id: config.discord.clientId,
					client_secret: config.discord.clientSecret,
					grant_type: 'authorization_code',
					code: code,
					redirect_uri: config.discord.redirectUri,
				}).toString(),
			}
		);

		if (!tokenResponse.ok) {
			const details = await tokenResponse.text();
			logger.error(
				`Discord token exchange failed (${tokenResponse.status}) redirect=${config.discord.redirectUri} ${details}`
			);
			throw new Error('Failed to exchange code for token');
		}

		const tokenData = (await tokenResponse.json()) as any;
		const accessToken = tokenData.access_token;
		const refreshToken = tokenData.refresh_token;

		// Fetch user information from Discord
		const userResponse = await fetch('https://discord.com/api/v10/users/@me', {
			headers: {
				Authorization: `Bearer ${accessToken}`,
			},
		});

		if (!userResponse.ok) {
			throw new Error('Failed to fetch user information');
		}

		const user = (await userResponse.json()) as any;

		// Fetch user's guilds from Discord
		const guildsResponse = await fetch(
			'https://discord.com/api/v10/users/@me/guilds',
			{
				headers: {
					Authorization: `Bearer ${accessToken}`,
				},
			}
		);

		let guilds: any[] = [];
		if (guildsResponse.ok) {
			guilds = (await guildsResponse.json()) as any[];
		}

		const userData = {
			id: user.id,
			username: user.username,
			discriminator: user.discriminator,
			globalName: user.global_name,
			avatar: user.avatar,
			email: user.email,
			verified: user.verified,
			guilds: guilds.map((guild: any) => ({
				id: guild.id,
				name: guild.name,
				icon: guild.icon,
				owner: guild.owner,
				permissions: guild.permissions,
			})),
		};

		storeDiscordTokens(userData.id, { accessToken, refreshToken });

		// Store user and access token in session for subsequent requests
		if (req.session) {
			(req.session as any).accessToken = accessToken;
			(req.session as any).user = userData;
		}

		// Generate JWT for frontend authentication using jose
		const secret = new TextEncoder().encode(config.jwt.secret);
		const jwtToken = await new SignJWT({ user: userData })
			.setProtectedHeader({ alg: 'HS256' })
			.setExpirationTime(config.jwt.expiresIn)
			.sign(secret);

		logger.info(
			`User authenticated: ${userData.username}#${userData.discriminator}`
		);

		const expiresIn = 24 * 60 * 60;

		// SPA posts the Discord code here after /auth/callback
		if (req.method === 'POST') {
			return res.json({
				success: true,
				data: {
					user: userData,
					token: jwtToken,
					expiresIn,
				},
			} as ApiResponse);
		}

		// Discord redirected to the API: send the JWT in the hash so it is
		// not leaked via Referer, then the frontend stores the session.
		const redirectUrl = `${frontendBaseUrl()}/login/callback#token=${encodeURIComponent(
			jwtToken
		)}&expiresIn=${expiresIn}`;

		res.redirect(redirectUrl);
	} catch (error) {
		logger.error('Error in Discord callback:', error);
		res.status(500).json({
			success: false,
			error: 'Authentication failed',
		} as ApiResponse);
	}
};

// Logout user
export const logout = async (req: AuthRequest, res: Response) => {
	try {
		// Extract raw token from Authorization header
		const authHeader = req.headers['authorization'];
		const token = authHeader && authHeader.split(' ')[1];

		if (token && req.user) {
			await blacklistToken(token, req.user.id);
			clearDiscordTokens(req.user.id);
		}

		// Destroy server-side session
		if (req.session) {
			req.session.destroy(() => {
				/* no-op */
			});
		}

		logger.info(`User logged out: ${req.user?.username || 'Unknown'}`);

		res.json({
			success: true,
			message: 'Logged out successfully',
		} as ApiResponse);
	} catch (error) {
		logger.error('Error in logout:', error);
		res.status(500).json({
			success: false,
			error: 'Logout failed',
		} as ApiResponse);
	}
};

// Get current user info
export const getCurrentUser = async (req: AuthRequest, res: Response) => {
	try {
		const user = req.user;

		if (!user) {
			return res.status(401).json({
				success: false,
				error: 'Not authenticated',
			} as ApiResponse);
		}

		// TODO: Optionally refresh user data from Discord
		// TODO: Update guilds list if needed

		logger.info(`User info requested: ${user.username}#${user.discriminator}`);

		res.json({
			success: true,
			data: user,
		} as ApiResponse);
	} catch (error) {
		logger.error('Error getting current user:', error);
		res.status(500).json({
			success: false,
			error: 'Failed to get user information',
		} as ApiResponse);
	}
};

// Refresh token
export const refreshToken = async (req: AuthRequest, res: Response) => {
	try {
		const user = req.user;

		if (!user) {
			return res.status(401).json({
				success: false,
				error: 'Not authenticated',
			} as ApiResponse);
		}

		// Generate new JWT token using jose
		const secret = new TextEncoder().encode(config.jwt.secret);
		const newToken = await new SignJWT({ user })
			.setProtectedHeader({ alg: 'HS256' })
			.setExpirationTime(config.jwt.expiresIn)
			.sign(secret);

		logger.info(
			`Token refreshed for user: ${user.username}#${user.discriminator}`
		);

		res.json({
			success: true,
			data: {
				token: newToken,
				expiresIn: 86400, // 24 hours in seconds
			},
		} as ApiResponse);
	} catch (error) {
		logger.error('Error refreshing token:', error);
		res.status(500).json({
			success: false,
			error: 'Failed to refresh token',
		} as ApiResponse);
	}
};
