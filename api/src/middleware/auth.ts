import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { config } from '../config/index.js';
import { isTokenBlacklisted } from '../services/tokenBlacklistService.js';
import 'express-session';

export interface User {
	id: string;
	username: string;
	discriminator: string;
	avatar?: string;
	email?: string;
}

export interface AuthRequest extends Request {
	user?: User;
}

export const authenticateToken = async (
	req: AuthRequest,
	res: Response,
	next: NextFunction
) => {
	// 1) Prefer authenticated user stored in the session (set after OAuth callback)
	const sessionUser = (req.session as any)?.user;
	if (sessionUser) {
		req.user = sessionUser;
		return next();
	}

	const authHeader = req.headers['authorization'];
	const token = authHeader && authHeader.split(' ')[1]; // Bearer TOKEN

	if (!token) {
		return res.status(401).json({
			success: false,
			error: 'Access token required',
		});
	}

	// Reject blacklisted tokens early
	if (await isTokenBlacklisted(token)) {
		return res
			.status(403)
			.json({ success: false, error: 'Token has been revoked' });
	}

	try {
		const decoded = jwt.verify(token, config.jwt.secret) as any;
		req.user = decoded.user;
		next();
	} catch (error) {
		return res.status(403).json({
			success: false,
			error: 'Invalid or expired token',
		});
	}
};

export const optionalAuth = async (
	req: AuthRequest,
	res: Response,
	next: NextFunction
) => {
	// Session-based authentication support
	const sessionUser = (req.session as any)?.user;
	if (sessionUser) {
		req.user = sessionUser;
		return next();
	}

	const authHeader = req.headers['authorization'];
	const token = authHeader && authHeader.split(' ')[1];

	if (token) {
		try {
			if (!(await isTokenBlacklisted(token))) {
				const decoded = jwt.verify(token, config.jwt.secret) as any;
				req.user = decoded.user;
			}
		} catch (error) {
			// invalid token ignored for optional auth
		}
	}

	next();
};
