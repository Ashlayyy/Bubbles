import type { Request, Response, NextFunction } from 'express';
import { env } from '@bubbles/shared';

export function requireMetricsToken(
	req: Request,
	res: Response,
	next: NextFunction
): void {
	const token = process.env.METRICS_TOKEN?.trim();
	if (env.NODE_ENV === 'production' && !token) {
		res.status(503).send('METRICS_TOKEN is not configured');
		return;
	}
	if (token) {
		const auth = req.headers.authorization ?? '';
		if (auth !== `Bearer ${token}`) {
			res.status(401).send('Unauthorized');
			return;
		}
	}
	next();
}
