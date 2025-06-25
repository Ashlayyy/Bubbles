import { Router, RequestHandler } from 'express';
import { authenticateToken } from '../middleware/auth.js';
import { requireUniversalPermissions } from '../middleware/permissions.js';

export interface RouteOptions {
	authRequired?: boolean; // require JWT (default true)
	discordPermissions?: string[]; // raw discord:<FLAG>
	customPermissions?: string[]; // raw custom:<NAME>
	tokenRequired?: boolean; // alias for authRequired
}

type Method = 'get' | 'post' | 'put' | 'patch' | 'delete' | 'all';

export const addRoute = (
	router: Router,
	method: Method,
	path: string,
	options: RouteOptions = {},
	...handlers: RequestHandler[]
) => {
	const {
		authRequired = true,
		tokenRequired = authRequired,
		discordPermissions = [],
		customPermissions = [],
	} = options;

	const middlewares: RequestHandler[] = [];

	const combinedPerms: string[] = [
		...discordPermissions.map((p) =>
			p.startsWith('discord:') ? p : `discord:${p}`
		),
		...customPermissions.map((p) =>
			p.startsWith('custom:') ? p : `custom:${p}`
		),
	];

	if (tokenRequired) {
		middlewares.push(authenticateToken);
		if (combinedPerms.length) {
			middlewares.push(
				requireUniversalPermissions(['token', ...combinedPerms])
			);
		} else {
			middlewares.push(requireUniversalPermissions(['token']));
		}
	} else if (combinedPerms.length) {
		middlewares.push(requireUniversalPermissions(combinedPerms));
	}

	(router as any)[method](path, ...middlewares, ...handlers);
};
