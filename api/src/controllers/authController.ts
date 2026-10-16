import type { Response } from 'express';
import { createLogger, type ApiResponse } from '../types/shared.js';
import type { AuthRequest } from '../middleware/auth.js';
import { config } from '../config/index.js';
import { SignJWT } from 'jose';
import { blacklistToken } from '../services/tokenBlacklistService.js';
import { Session, SessionData } from 'express-session';
import 'express-session';

const logger = createLogger('auth-controller');

type AuthenticatedRequest = AuthRequest & {
	session: Session &
		Partial<SessionData> & {
			accessToken?: string;
			user?: any; // Stored user object
		};
};

// Discord OAuth login
export const discordLogin = async (req: AuthRequest, res: Response) => {
	try {
		const state = generateRandomString(16);
		const scope = 'identify email guilds';

		const discordAuthUrl = `https://discord.com/api/oauth2/authorize?client_id=${
			config.discord.clientId
		}&redirect_uri=${encodeURIComponent(
			config.discord.redirectUri
		)}&response_type=code&scope=${encodeURIComponent(scope)}&state=${state}`;

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

		if (!code) {
			return res.status(400).json({
				success: false,
				error: 'Authorization code is required',
			} as ApiResponse);
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

		// If this is a JSON POST request, return payload instead of redirect
		if (req.method === 'POST') {
			return res.json({
				success: true,
				data: {
					user: userData,
					token: jwtToken,
					// Convert expiresIn (e.g. "24h") to seconds (default 86400)
					expiresIn: 24 * 60 * 60,
				},
			} as ApiResponse);
		}

		// Default behaviour – redirect browser back to frontend including token
		const frontendUrl =
			process.env.FRONTEND_BASE_URL ||
			process.env.CORS_ORIGIN ||
			'http://localhost:8080';
		const redirectUrl = `${frontendUrl}/login/callback?token=${jwtToken}`;

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

// Utility function to generate random string
function generateRandomString(length: number): string {
	const characters =
		'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
	let result = '';
	for (let i = 0; i < length; i++) {
		result += characters.charAt(Math.floor(Math.random() * characters.length));
	}
	return result;
}
