import type { Request, Response, NextFunction } from 'express';
import type { ZodSchema } from 'zod';
import { z } from 'zod';

import '../middleware/response.js'; // ensures module augmentation is loaded

/**
 * Returns an Express middleware that validates `req[source]` against the given Zod schema.
 * On success it overwrites the request property with the parsed value (typesafe) and calls `next()`.
 * On failure it responds via `res.failure()` with status 400 and the Zod error list.
 */
export const validateZod = (
	schema: ZodSchema,
	source: 'body' | 'query' | 'params' = 'body'
) => {
	return (req: Request, res: Response, next: NextFunction) => {
		const result = schema.safeParse(req[source]);
		if (!result.success) {
			return res.failure('Validation failed', 400, result.error.errors);
		}
		// Replace with parsed/validated data so downstream code has correct types
		(req as any)[source] = result.data;
		next();
	};
};

// -----------------------------------------------------------------------------
// Re-usable common schemas (guildId, userId, etc.)
// -----------------------------------------------------------------------------
export const Snowflake = () => z.string().regex(/^\d{17,19}$/);

export const GuildIdParam = z.object({ guildId: Snowflake() });
export type GuildIdParam = z.infer<typeof GuildIdParam>;
