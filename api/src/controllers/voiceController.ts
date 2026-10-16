import type { Response } from 'express';
import { createLogger } from '../types/shared.js';
import type { AuthRequest } from '../middleware/auth.js';
import { getPrismaClient } from '../services/databaseService.js';
import { hybridCommunicationService } from '../services/hybridCommunicationService.js';

const logger = createLogger('voice-controller');

function startDateFor(period: string): Date {
	const now = Date.now();
	if (period === '24h') return new Date(now - 24 * 60 * 60 * 1000);
	if (period === '30d') return new Date(now - 30 * 24 * 60 * 60 * 1000);
	if (period === '90d') return new Date(now - 90 * 24 * 60 * 60 * 1000);
	return new Date(now - 7 * 24 * 60 * 60 * 1000);
}

export const getVoiceActivity = async (req: AuthRequest, res: Response) => {
	try {
		const { guildId } = req.params;
		const period = String(req.query.period || '7d');
		const startDate = startDateFor(period);
		const prisma = getPrismaClient();

		const [sessions, live] = await Promise.all([
			prisma.voiceSession.findMany({
				where: {
					guildId,
					joinedAt: { gte: startDate },
				},
				orderBy: { joinedAt: 'desc' },
				take: 500,
			}),
			hybridCommunicationService.execute(
				'GET_VOICE_STATUS',
				{ guildId },
				{ guildId, preferWebSocket: true, waitForResult: true, timeout: 8_000 }
			),
		]);

		const now = Date.now();
		const totals = new Map<
			string,
			{ userId: string; durationMs: number; sessions: number }
		>();
		const channelTotals = new Map<
			string,
			{ channelId: string; channelName: string; durationMs: number; uniqueUsers: Set<string> }
		>();

		for (const session of sessions) {
			const duration =
				session.durationMs ??
				Math.max(0, (session.leftAt?.getTime() ?? now) - session.joinedAt.getTime());
			const user = totals.get(session.userId) ?? {
				userId: session.userId,
				durationMs: 0,
				sessions: 0,
			};
			user.durationMs += duration;
			user.sessions += 1;
			totals.set(session.userId, user);

			const channel = channelTotals.get(session.channelId) ?? {
				channelId: session.channelId,
				channelName: session.channelName,
				durationMs: 0,
				uniqueUsers: new Set<string>(),
			};
			channel.durationMs += duration;
			channel.uniqueUsers.add(session.userId);
			channelTotals.set(session.channelId, channel);
		}

		const liveData = (live.success && live.data && typeof live.data === 'object'
			? live.data
			: {}) as {
			voiceChannels?: Array<{
				id: string;
				name: string;
				memberCount: number;
				members: Array<{ id: string; username: string; displayName: string }>;
			}>;
			usersInVoice?: number;
		};

		res.success({
			period,
			totalVoiceTimeMs: Array.from(totals.values()).reduce(
				(sum, user) => sum + user.durationMs,
				0
			),
			uniqueVoiceUsers: totals.size,
			activeVoiceUsers: liveData.usersInVoice ?? 0,
			topUsers: Array.from(totals.values())
				.sort((a, b) => b.durationMs - a.durationMs)
				.slice(0, 10),
			channels: Array.from(channelTotals.values())
				.map((channel) => ({
					id: channel.channelId,
					name: channel.channelName,
					durationMs: channel.durationMs,
					uniqueUsers: channel.uniqueUsers.size,
				}))
				.sort((a, b) => b.durationMs - a.durationMs),
			liveChannels: liveData.voiceChannels ?? [],
		});
	} catch (error) {
		logger.error('Error fetching voice activity:', error);
		res.failure('Failed to fetch voice activity', 500);
	}
};
