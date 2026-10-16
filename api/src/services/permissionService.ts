import { prisma } from '@shared/database.js';
import Redis from 'ioredis';
import { createLogger } from '../types/shared.js';

const logger = createLogger('permission-service');
const redis = new Redis({
	host: process.env.REDIS_HOST || 'localhost',
	port: parseInt(process.env.REDIS_PORT || '6379', 10),
	password: process.env.REDIS_PASSWORD || undefined,
	db: 0,
});
redis.on('error', (err) => {
	logger.warn(`Redis error: ${err.message}`);
});

function redisKeyRole(guildId: string) {
	return `perm:roles:${guildId}`;
}
function redisKeyUser(guildId: string, userId: string) {
	return `perm:user:${guildId}:${userId}`;
}

export class PermissionService {
	async getRolePermissions(guildId: string): Promise<any[]> {
		const cache = await redis.get(redisKeyRole(guildId));
		if (cache) return JSON.parse(cache);

		const roles = await prisma.rolePermission.findMany({
			where: { guildId },
		});
		await redis.set(redisKeyRole(guildId), JSON.stringify(roles), 'EX', 300);
		return roles;
	}

	async getUserPermission(
		guildId: string,
		userId: string
	): Promise<any | null> {
		const key = redisKeyUser(guildId, userId);
		const cache = await redis.get(key);
		if (cache) return JSON.parse(cache);

		const perm = await prisma.userPermission.findUnique({
			where: { guildId_userId: { guildId, userId } },
		});
		if (perm) await redis.set(key, JSON.stringify(perm), 'EX', 60);
		return perm;
	}

	async setRolePermission(data: any) {
		await redis.del(redisKeyRole(data.guildId));
		return prisma.rolePermission.upsert({
			where: {
				guildId_roleId: { guildId: data.guildId, roleId: data.roleId },
			},
			update: {
				permissions: data.permissions,
				customNodes: data.customNodes,
			},
			create: {
				guildId: data.guildId,
				roleId: data.roleId,
				permissions: data.permissions,
				customNodes: data.customNodes,
			},
		});
	}

	async setUserPermission(data: any) {
		await redis.del(redisKeyUser(data.guildId, data.userId));
		return prisma.userPermission.upsert({
			where: {
				guildId_userId: { guildId: data.guildId, userId: data.userId },
			},
			update: {
				permissions: data.permissions,
				customNodes: data.customNodes,
			},
			create: {
				guildId: data.guildId,
				userId: data.userId,
				permissions: data.permissions,
				customNodes: data.customNodes,
			},
		});
	}
}

export const permissionService = new PermissionService();
void logger;
