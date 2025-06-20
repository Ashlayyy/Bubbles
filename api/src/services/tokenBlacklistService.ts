import { getPrismaClient } from './databaseService.js';
import jwt from 'jsonwebtoken';
import crypto from 'crypto';

// Helper to hash the raw JWT – avoids storing the full token in DB
function hashToken(token: string): string {
	return crypto.createHash('sha256').update(token).digest('hex');
}

/**
 * Add the supplied JWT to the blacklist so it can no longer be used.
 * The token is stored as a SHA-256 hash (as jti primary key) together with its expiry
 * so that a background job can delete expired entries if desired.
 */
export async function blacklistToken(
	token: string,
	userId: string
): Promise<void> {
	try {
		const prisma = getPrismaClient();
		const decoded: any = jwt.decode(token);
		const expiresAt = decoded?.exp
			? new Date(decoded.exp * 1000)
			: new Date(Date.now() + 24 * 60 * 60 * 1000);

		await prisma.tokenBlacklist.create({
			data: {
				jti: hashToken(token),
				userId,
				expiresAt,
			},
		});
	} catch (err) {
		// If the record already exists or DB unavailable we just log – we don't block logout
		console.warn('Failed to blacklist token:', err);
	}
}

/**
 * Quick lookup utility for middleware. Returns true when token **is** blacklisted.
 */
export async function isTokenBlacklisted(token: string): Promise<boolean> {
	try {
		const prisma = getPrismaClient();
		const record = await prisma.tokenBlacklist.findUnique({
			where: { jti: hashToken(token) },
		});
		if (!record) return false;
		// Consider blacklisted only if record not expired
		return record.expiresAt.getTime() > Date.now();
	} catch (err) {
		console.warn('Token blacklist lookup failed:', err);
		return false;
	}
}
