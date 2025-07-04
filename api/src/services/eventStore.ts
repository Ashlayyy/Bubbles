import { prisma } from '@shared/database.js';
import { createLogger } from '../types/shared.js';

const logger = createLogger('event-store');

type DiscordEventPayload = Record<string, unknown>;

type GithubEventPayload = Record<string, unknown>;

export class EventStoreService {
	/** Persist a Discord event */
	async saveDiscordEvent(event: {
		type: string;
		guildId?: string;
		userId?: string;
		channelId?: string;
		messageId?: string;
		payload: DiscordEventPayload;
		metadata?: Record<string, unknown>;
	}) {
		// NOTE: skipping actual DB write until migrations run
		logger.debug('Storing Discord event', {
			type: event.type,
			guildId: event.guildId,
		});
		// await prisma.eventDiscord.create({ data: event });
	}

	/** Persist a GitHub webhook */
	async saveGithubEvent(event: {
		type: string;
		repository?: string;
		payload: GithubEventPayload;
		metadata?: Record<string, unknown>;
	}) {
		// await prisma.eventGithub.create({ data: event });
		logger.debug('Storing GitHub event', {
			type: event.type,
			repo: event.repository,
		});
	}

	/** Retrieve Discord events with basic filtering */
	async getDiscordEvents(options: {
		guildId?: string;
		type?: string;
		limit?: number;
	}) {
		const { guildId, type, limit = 50 } = options;
		// const where: any = {};
		// if (guildId) where.guildId = guildId;
		// if (type) where.type = type;
		// return prisma.eventDiscord.findMany({ where, orderBy: { createdAt: 'desc' }, take: limit });
		return [];
	}
}

export const eventStore = new EventStoreService();
