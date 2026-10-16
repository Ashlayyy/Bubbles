import type { Response } from 'express';
import { createLogger } from '../types/shared.js';
import type { AuthRequest } from '../middleware/auth.js';
import { wsManager } from '../websocket/manager.js';
import { getPrismaClient } from '../services/databaseService.js';
import { hybridCommunicationService } from '../services/hybridCommunicationService.js';
import {
	createPlaylist,
	getHistory,
	getPlaylist,
	getQueue,
	listPlaylists,
	savePlaylist,
	saveQueue,
} from '../services/musicStore.js';

const logger = createLogger('music-controller');

function createWebSocketMessage(event: string, data: unknown) {
	return {
		type: 'MUSIC_EVENT',
		event,
		data,
		timestamp: Date.now(),
		messageId: `msg_${Date.now()}_${Math.random()
			.toString(36)
			.substring(2, 9)}`,
	};
}

async function runMusicCommand(
	command: string,
	guildId: string,
	data: Record<string, unknown>
) {
	return hybridCommunicationService.execute(command, { ...data, guildId }, {
		guildId,
		preferWebSocket: true,
		waitForResult: true,
		timeout: 25_000,
	});
}

function asStatus(payload: unknown, fallbackQueue: Awaited<ReturnType<typeof getQueue>>) {
	const data = (payload && typeof payload === 'object' ? payload : {}) as Record<
		string,
		unknown
	>;
	return {
		playbackEnabled: true,
		isPlaying: Boolean(data.isPlaying ?? fallbackQueue?.playing),
		isPaused: Boolean(data.isPaused ?? fallbackQueue?.paused),
		currentTrack: data.currentTrack ?? fallbackQueue?.currentTrack ?? null,
		queue: Array.isArray(data.queue) ? data.queue : fallbackQueue?.tracks ?? [],
		volume: Number(data.volume ?? fallbackQueue?.volume ?? 50),
		repeatMode: data.repeatMode ?? fallbackQueue?.repeat ?? 'OFF',
		shuffleEnabled: Boolean(data.shuffleEnabled ?? fallbackQueue?.shuffle),
		position: Number(data.position ?? 0),
		duration: Number(
			data.duration ??
				(fallbackQueue?.currentTrack as { duration?: number } | undefined)
					?.duration ??
				0
		),
		voiceChannelId: data.voiceChannelId ?? fallbackQueue?.channelId ?? null,
	};
}

export const getMusicStatus = async (req: AuthRequest, res: Response) => {
	try {
		const { guildId } = req.params;
		const queue = await getQueue(guildId);
		const live = await runMusicCommand('GET_NOW_PLAYING', guildId, {});
		res.success(asStatus(live.success ? live.data : null, queue));
	} catch (error) {
		logger.error('Error fetching music status:', error);
		res.failure('Failed to fetch music status', 500);
	}
};

export const playMusic = async (req: AuthRequest, res: Response) => {
	try {
		const { guildId } = req.params;
		const { query, url, voiceChannelId, volume } = req.body;
		const search = query || url;
		if (!search) {
			return res.failure('query is required', 400);
		}

		const result = await runMusicCommand('PLAY_MUSIC', guildId, {
			query: search,
			voiceChannelId,
			userId: req.user?.id,
			volume,
		});

		if (!result.success) {
			return res.failure(result.error || 'Failed to start playback', 502);
		}

		wsManager.broadcastToGuild(
			guildId,
			createWebSocketMessage('musicPlay', result.data)
		);
		res.success(result.data);
	} catch (error) {
		logger.error('Error playing music:', error);
		res.failure('Failed to play music', 500);
	}
};

export const pauseMusic = async (req: AuthRequest, res: Response) => {
	const { guildId } = req.params;
	const result = await runMusicCommand('PAUSE_MUSIC', guildId, {});
	if (!result.success) return res.failure(result.error || 'Failed to pause', 502);
	res.success(result.data);
};

export const resumeMusic = async (req: AuthRequest, res: Response) => {
	const { guildId } = req.params;
	const result = await runMusicCommand('RESUME_MUSIC', guildId, {});
	if (!result.success) return res.failure(result.error || 'Failed to resume', 502);
	res.success(result.data);
};

export const skipTrack = async (req: AuthRequest, res: Response) => {
	const { guildId } = req.params;
	const result = await runMusicCommand('SKIP_MUSIC', guildId, {});
	if (!result.success) return res.failure(result.error || 'Failed to skip', 502);
	res.success(result.data);
};

export const stopMusic = async (req: AuthRequest, res: Response) => {
	const { guildId } = req.params;
	const result = await runMusicCommand('STOP_MUSIC', guildId, {});
	if (!result.success) return res.failure(result.error || 'Failed to stop', 502);
	res.success(result.data);
};

export const getQueueHandler = async (req: AuthRequest, res: Response) => {
	try {
		const { guildId } = req.params;
		const { includeHistory = false } = req.query;
		const live = await runMusicCommand('GET_QUEUE_STATUS', guildId, {});
		const queue = live.success ? live.data : await getQueue(guildId);
		const history =
			String(includeHistory) === 'true'
				? (await getHistory(guildId)).slice(-10)
				: [];

		res.success({
			queue,
			history,
		});
	} catch (error) {
		logger.error('Error getting queue:', error);
		res.failure('Failed to get queue', 500);
	}
};

export const clearQueue = async (req: AuthRequest, res: Response) => {
	try {
		const { guildId } = req.params;
		const result = await runMusicCommand('CLEAR_QUEUE', guildId, {});
		if (!result.success) {
			const queue = await getQueue(guildId);
			if (!queue) {
				return res.failure('No active music queue', 404);
			}
			queue.tracks = [];
			await saveQueue(queue);
			res.success({ message: 'Queue cleared' });
			return;
		}
		wsManager.broadcastToGuild(
			guildId,
			createWebSocketMessage('musicQueueClear', result.data)
		);
		res.success(result.data);
	} catch (error) {
		logger.error('Error clearing queue:', error);
		res.failure('Failed to clear queue', 500);
	}
};

export const shuffleQueue = async (req: AuthRequest, res: Response) => {
	const { guildId } = req.params;
	const result = await runMusicCommand('SHUFFLE_QUEUE', guildId, {});
	if (!result.success) return res.failure(result.error || 'Failed to shuffle', 502);
	res.success(result.data);
};

export const setVolume = async (req: AuthRequest, res: Response) => {
	const { guildId } = req.params;
	const volume = Number(req.body.volume);
	if (!Number.isFinite(volume)) {
		return res.failure('volume is required', 400);
	}
	const result = await runMusicCommand('SET_VOLUME', guildId, { volume });
	if (!result.success) return res.failure(result.error || 'Failed to set volume', 502);
	res.success(result.data);
};

export const setRepeatMode = async (req: AuthRequest, res: Response) => {
	const { guildId } = req.params;
	const mode = req.body.mode || req.body.repeat || 'OFF';
	const result = await runMusicCommand('SET_REPEAT', guildId, { mode });
	if (!result.success) return res.failure(result.error || 'Failed to set repeat', 502);
	res.success(result.data);
};

export const getMusicSettings = async (req: AuthRequest, res: Response) => {
	try {
		const { guildId } = req.params;
		const prisma = getPrismaClient();

		const guildConfig = await prisma.guildConfig.findUnique({
			where: { guildId },
			select: {
				musicSettings: true,
				musicChannelId: true,
			},
		});

		const stored =
			guildConfig?.musicSettings && typeof guildConfig.musicSettings === 'object'
				? (guildConfig.musicSettings as Record<string, unknown>)
				: {};

		res.success({
			enabled: true,
			maxQueueSize: 100,
			maxTrackDuration: 3600,
			allowExplicit: false,
			djRole: null,
			musicChannelId: guildConfig?.musicChannelId || null,
			...stored,
		});
	} catch (error) {
		logger.error('Error getting music settings:', error);
		res.failure('Failed to get music settings', 500);
	}
};

export const updateMusicSettings = async (req: AuthRequest, res: Response) => {
	try {
		const { guildId } = req.params;
		const settings = req.body;
		const prisma = getPrismaClient();

		await prisma.guildConfig.upsert({
			where: { guildId },
			update: {
				musicSettings: settings,
				musicChannelId: settings.musicChannelId ?? undefined,
			},
			create: {
				guildId,
				musicSettings: settings,
				musicChannelId: settings.musicChannelId ?? '',
			},
		});

		res.success(settings);
	} catch (error) {
		logger.error('Error updating music settings:', error);
		res.failure('Failed to update music settings', 500);
	}
};

export const getPlaylists = async (req: AuthRequest, res: Response) => {
	try {
		const { guildId } = req.params;
		const { includePublic = true, createdBy } = req.query;
		const playlists = await listPlaylists(guildId, {
			includePublic: String(includePublic) !== 'false',
			createdBy: typeof createdBy === 'string' ? createdBy : undefined,
		});

		res.success(
			playlists.map((playlist) => ({
				id: playlist.id,
				name: playlist.name,
				description: playlist.description,
				isPublic: playlist.isPublic,
				trackCount: playlist.tracks.length,
				totalDuration: playlist.tracks.reduce(
					(sum, track) => sum + track.duration,
					0
				),
				createdBy: playlist.createdBy,
				createdAt: playlist.createdAt,
				updatedAt: playlist.updatedAt,
			}))
		);
	} catch (error) {
		logger.error('Error getting playlists:', error);
		res.failure('Failed to get playlists', 500);
	}
};

export const createPlaylistHandler = async (req: AuthRequest, res: Response) => {
	try {
		const { guildId } = req.params;
		const { name, description, isPublic = false } = req.body;

		if (!name || name.trim().length === 0) {
			return res.failure('Playlist name is required', 400);
		}

		const existing = (await listPlaylists(guildId)).find(
			(playlist) => playlist.name.toLowerCase() === name.trim().toLowerCase()
		);
		if (existing) {
			return res.failure('A playlist with this name already exists', 400);
		}

		const playlist = await createPlaylist({
			guildId,
			name: name.trim(),
			description: description?.trim(),
			isPublic,
			createdBy: req.user?.id || 'unknown',
		});

		logger.info(`Created playlist "${name}" for guild ${guildId}`);
		res.success(playlist, 201);
	} catch (error) {
		logger.error('Error creating playlist:', error);
		res.failure('Failed to create playlist', 500);
	}
};

export const addToPlaylist = async (req: AuthRequest, res: Response) => {
	try {
		const { guildId, playlistId } = req.params;
		const { url, title, artist, thumbnail, duration } = req.body;
		const playlist = await getPlaylist(guildId, playlistId);
		if (!playlist) {
			return res.failure('Playlist not found', 404);
		}

		if (!url || !title) {
			return res.failure('URL and title are required', 400);
		}

		if (playlist.tracks.find((track) => track.url === url)) {
			return res.failure('Track already exists in playlist', 400);
		}

		const track = {
			title,
			artist: artist || 'Unknown Artist',
			url,
			thumbnail,
			duration: duration || 0,
			addedBy: req.user?.id || 'unknown',
			position: playlist.tracks.length,
		};
		playlist.tracks.push(track);
		const saved = await savePlaylist(playlist);

		logger.info(`Added track to playlist "${playlist.name}": ${title}`);
		res.success({ track, playlist: saved });
	} catch (error) {
		logger.error('Error adding to playlist:', error);
		res.failure('Failed to add track to playlist', 500);
	}
};

export const getMusicStatistics = async (req: AuthRequest, res: Response) => {
	try {
		const { guildId } = req.params;
		const { timeframe = '7d' } = req.query;
		const now = new Date();
		const startDate = new Date();
		switch (timeframe) {
			case '24h':
				startDate.setHours(now.getHours() - 24);
				break;
			case '30d':
				startDate.setDate(now.getDate() - 30);
				break;
			default:
				startDate.setDate(now.getDate() - 7);
		}

		const history = await getHistory(guildId);
		const recentTracks = history.filter((track) => track.playedAt >= startDate);

		res.success({
			totalTracks: recentTracks.length,
			totalDuration: recentTracks.reduce(
				(sum, track) => sum + track.duration,
				0
			),
			uniqueRequesters: new Set(recentTracks.map((track) => track.requestedBy))
				.size,
			topArtists: getTopItems(recentTracks, 'artist', 5),
			topRequesters: getTopItems(recentTracks, 'requestedBy', 5),
			averageTrackDuration:
				recentTracks.length > 0
					? Math.round(
							recentTracks.reduce((sum, track) => sum + track.duration, 0) /
								recentTracks.length
					  )
					: 0,
			timeframe,
		});
	} catch (error) {
		logger.error('Error getting music statistics:', error);
		res.failure('Failed to get music statistics', 500);
	}
};

function getTopItems(
	items: Array<{ artist: string; requestedBy: string }>,
	field: 'artist' | 'requestedBy',
	limit: number
) {
	const counts = new Map<string, number>();
	items.forEach((item) => {
		const value = String(item[field] ?? '');
		counts.set(value, (counts.get(value) || 0) + 1);
	});

	return Array.from(counts.entries())
		.sort((a, b) => b[1] - a[1])
		.slice(0, limit)
		.map(([name, count]) => ({ name, count }));
}

export { getQueueHandler as getQueue, createPlaylistHandler as createPlaylist };
