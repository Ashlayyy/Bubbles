import { Router, RequestHandler } from 'express';
import { authenticateToken } from '../middleware/auth.js';
import { requireUniversalPermissions } from '../middleware/permissions.js';

export interface RouteOptions {
	authRequired?: boolean; // require JWT (default true)
	tokenRequired?: boolean; // alias for authRequired
	discordPermissions?: string[]; // raw discord:<FLAG>
	customPermissions?: string[]; // raw custom:<NAME>
	permissionsOverride?: boolean; // when true, skip patch's default perms
	devAllowedOverride?: boolean; // allow dev users to bypass perms
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
		permissionsOverride = false,
		devAllowedOverride = false,
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

	const pushAuthPerms = () => {
		if (tokenRequired) middlewares.push(authenticateToken);
		const perms = tokenRequired ? ['token', ...combinedPerms] : combinedPerms;

		if (devAllowedOverride) {
			const devBypass: RequestHandler = (req, _res, next) => {
				const devIds = (process.env.DEVELOPER_USER_IDS || '')
					.split(',')
					.filter(Boolean);
				const user = (req as any).user;
				if (
					process.env.NODE_ENV !== 'production' &&
					user &&
					devIds.includes(user.id)
				) {
					return next();
				}
				return (requireUniversalPermissions(perms) as any)(req, _res, next);
			};
			middlewares.push(devBypass);
		} else if (perms.length) {
			middlewares.push(requireUniversalPermissions(perms));
		}
	};

	if (permissionsOverride) {
		// inject a noop with secure=false to suppress patch
		const noop: RequestHandler = (_, __, next) => next();
		(noop as any).secure = false;
		middlewares.push(noop);
		pushAuthPerms();
	} else if (tokenRequired || combinedPerms.length) {
		pushAuthPerms();
	} else if (combinedPerms.length) {
		middlewares.push(requireUniversalPermissions(combinedPerms));
	}

	(router as any)[method](path, ...middlewares, ...handlers);
};
