import { Router, RequestHandler } from 'express';
import { authenticateToken } from '../middleware/auth.js';
import { requireUniversalPermissions } from '../middleware/permissions.js';

const METHODS = ['get', 'post', 'put', 'patch', 'delete', 'all'] as const;

export function applySecureRouterPatch() {
	const proto = (Router as any).prototype;
	METHODS.forEach((method) => {
		const original = proto[method];
		proto[method] = function patched(
			path: string,
			...handlers: RequestHandler[]
		) {
			if (handlers.length === 0) return original.call(this, path);

			// opt-out: if first handler has secure === false
			const secureDisabled = (handlers[0] as any)?.secure === false;

			if (!secureDisabled) {
				handlers.unshift(
					authenticateToken as RequestHandler,
					requireUniversalPermissions([
						'token',
						'discord:MANAGE_GUILD',
					]) as RequestHandler
				);
			}
			return original.call(this, path, ...handlers);
		};
	});
}
