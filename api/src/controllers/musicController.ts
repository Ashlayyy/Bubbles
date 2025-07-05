import type { Response } from 'express';
import { createLogger } from '../types/shared.js';
import type { AuthRequest } from '../middleware/auth.js';
import { wsManager } from '../websocket/manager.js';
import { getPrismaClient } from '../services/databaseService.js';

const logger = createLogger('music-controller');

// In-memory music data storage
interface MusicTrack {
	id: string;
	title: string;
	artist: string;
	url: string;
	thumbnail?: string;
	duration: number;
	position: number;
	requestedBy: string;
	addedAt: Date;
}

interface MusicQueue {
	id: string;
	guildId: string;
	channelId?: string;
	playing: boolean;
	paused: boolean;
	volume: number;
	repeat: 'OFF' | 'TRACK' | 'QUEUE';
	shuffle: boolean;
	currentTrack?: {
		title: string;
		artist: string;
		url: string;
		thumbnail?: string;
		duration: number;
		requestedBy: string;
	};
	tracks: MusicTrack[];
	createdAt: Date;
	updatedAt: Date;
}

interface MusicPlaylist {
	id: string;
	guildId: string;
	name: string;
	description?: string;
	isPublic: boolean;
	tracks: Array<{
		title: string;
		artist: string;
		url: string;
		thumbnail?: string;
		duration: number;
		addedBy: string;
		position: number;
	}>;
	createdBy: string;
	createdAt: Date;
	updatedAt: Date;
}

// In-memory storage
const musicQueues = new Map<string, MusicQueue>();
const musicPlaylists = new Map<string, MusicPlaylist>();
const trackHistory = new Map<
	string,
	Array<{
		title: string;
		artist: string;
		url: string;
		duration: number;
		requestedBy: string;
		playedAt: Date;
	}>
>();

// Helper function to create WebSocket messages
function createWebSocketMessage(event: string, data: any) {
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

// Helper function to generate IDs
function generateId(): string {
	return Date.now().toString() + Math.random().toString(36).substring(2);
}

// Get music player status
export const getMusicStatus = async (req: AuthRequest, res: Response) => {
	try {
		const { guildId } = req.params;

		const queue = musicQueues.get(guildId);

		const status = {
			isPlaying: queue?.playing || false,
			isPaused: queue?.paused || false,
			currentTrack: queue?.currentTrack || null,
			queue: queue?.tracks || [],
			volume: queue?.volume || 50,
			repeatMode: queue?.repeat || 'OFF',
			shuffleEnabled: queue?.shuffle || false,
			position: 0, // Would be tracked by actual music player
			duration: queue?.currentTrack?.duration || 0,
		};

		res.success(status);
	} catch (error) {
		logger.error('Error fetching music status:', error);
		res.failure('Failed to fetch music status', 500);
	}
};

// Play music
export const playMusic = async (req: AuthRequest, res: Response) => {
	try {
		const { guildId } = req.params;
		const { query, platform = 'youtube' } = req.body;

		if (!query) {
			return res.failure('Query is required', 400);
		}

		// Simulate track resolution (in real implementation, would use YouTube API, Spotify, etc.)
		const track = {
			title: `Track: ${query}`,
			artist: 'Unknown Artist',
			url: `https://example.com/track/${generateId()}`,
			thumbnail: 'https://example.com/thumbnail.jpg',
			duration: 180000, // 3 minutes
			requestedBy: req.user?.username || 'Unknown',
		};

		// Get or create queue
		let queue = musicQueues.get(guildId);
		if (!queue) {
			queue = {
				id: generateId(),
				guildId,
				channelId: req.body.channelId,
				playing: false,
				paused: false,
				volume: 50,
				repeat: 'OFF',
				shuffle: false,
				tracks: [],
				createdAt: new Date(),
				updatedAt: new Date(),
			};
			musicQueues.set(guildId, queue);
		}

		// Add track to queue
		const newTrack: MusicTrack = {
			id: generateId(),
			...track,
			position: queue.tracks.length,
			addedAt: new Date(),
		};

		queue.tracks.push(newTrack);
		queue.updatedAt = new Date();

		// If no current track and not playing, start playing
		if (!queue.currentTrack && !queue.playing) {
			queue.currentTrack = track;
			queue.playing = true;
		}

		// Broadcast track addition
		wsManager.broadcastToGuild(
			guildId,
			createWebSocketMessage('musicTrackAdd', {
				track: newTrack,
				queueId: queue.id,
			})
		);

		logger.info(`Added track '${track.title}' to queue for guild ${guildId}`, {
			trackId: newTrack.id,
			requestedBy: req.user?.id,
		});

		res.success({
			added: true,
			position: newTrack.position + 1,
			track: newTrack,
		});
	} catch (error) {
		logger.error('Error playing music:', error);
		res.failure('Failed to play music', 500);
	}
};

// Pause music
export const pauseMusic = async (req: AuthRequest, res: Response) => {
	try {
		const { guildId } = req.params;

		const queue = musicQueues.get(guildId);
		if (!queue) {
			return res.failure('No active music queue', 404);
		}

		queue.paused = true;
		queue.updatedAt = new Date();

		// Broadcast pause
		wsManager.broadcastToGuild(
			guildId,
			createWebSocketMessage('musicPause', { queueId: queue.id })
		);

		logger.info(`Paused music for guild ${guildId}`);

		res.success({ message: 'Music paused' });
	} catch (error) {
		logger.error('Error pausing music:', error);
		res.failure('Failed to pause music', 500);
	}
};

// Resume music
export const resumeMusic = async (req: AuthRequest, res: Response) => {
	try {
		const { guildId } = req.params;

		const queue = musicQueues.get(guildId);
		if (!queue) {
			return res.failure('No active music queue', 404);
		}

		queue.paused = false;
		queue.playing = true;
		queue.updatedAt = new Date();

		// Broadcast resume
		wsManager.broadcastToGuild(
			guildId,
			createWebSocketMessage('musicResume', { queueId: queue.id })
		);

		logger.info(`Resumed music for guild ${guildId}`);

		res.success({ message: 'Music resumed' });
	} catch (error) {
		logger.error('Error resuming music:', error);
		res.failure('Failed to resume music', 500);
	}
};

// Skip track
export const skipTrack = async (req: AuthRequest, res: Response) => {
	try {
		const { guildId } = req.params;

		const queue = musicQueues.get(guildId);
		if (!queue) {
			return res.failure('No active music queue', 404);
		}

		// Add current track to history
		if (queue.currentTrack) {
			const history = trackHistory.get(guildId) || [];
			history.push({
				...queue.currentTrack,
				playedAt: new Date(),
			});
			// Keep only last 50 tracks in history
			if (history.length > 50) {
				history.shift();
			}
			trackHistory.set(guildId, history);
		}

		// Get next track
		if (queue.tracks.length > 0) {
			const nextTrack = queue.tracks.shift();
			if (nextTrack) {
				queue.currentTrack = {
					title: nextTrack.title,
					artist: nextTrack.artist,
					url: nextTrack.url,
					thumbnail: nextTrack.thumbnail,
					duration: nextTrack.duration,
					requestedBy: nextTrack.requestedBy,
				};
				// Update positions
				queue.tracks.forEach((track, index) => {
					track.position = index;
				});
			}
		} else {
			queue.currentTrack = undefined;
			queue.playing = false;
		}

		queue.updatedAt = new Date();

		// Broadcast skip
		wsManager.broadcastToGuild(
			guildId,
			createWebSocketMessage('musicSkip', {
				queueId: queue.id,
				currentTrack: queue.currentTrack,
			})
		);

		logger.info(`Skipped track for guild ${guildId}`);

		res.success({ message: 'Track skipped' });
	} catch (error) {
		logger.error('Error skipping track:', error);
		res.failure('Failed to skip track', 500);
	}
};

// Stop music
export const stopMusic = async (req: AuthRequest, res: Response) => {
	try {
		const { guildId } = req.params;

		const queue = musicQueues.get(guildId);
		if (!queue) {
			return res.failure('No active music queue', 404);
		}

		// Clear queue and stop
		queue.tracks = [];
		queue.currentTrack = undefined;
		queue.playing = false;
		queue.paused = false;
		queue.updatedAt = new Date();

		// Broadcast stop
		wsManager.broadcastToGuild(
			guildId,
			createWebSocketMessage('musicStop', { queueId: queue.id })
		);

		logger.info(`Stopped music for guild ${guildId}`);

		res.success({ message: 'Music stopped and queue cleared' });
	} catch (error) {
		logger.error('Error stopping music:', error);
		res.failure('Failed to stop music', 500);
	}
};

// Get current queue for guild
export const getQueue = async (req: AuthRequest, res: Response) => {
	try {
		const { guildId } = req.params;
		const { includeHistory = false } = req.query;

		const queue = musicQueues.get(guildId);
		const history = includeHistory ? trackHistory.get(guildId) || [] : [];

		res.success({
			queue: queue || null,
			history: history.slice(-10), // Last 10 tracks
		});
	} catch (error) {
		logger.error('Error getting queue:', error);
		res.failure('Failed to get queue', 500);
	}
};

// Clear queue
export const clearQueue = async (req: AuthRequest, res: Response) => {
	try {
		const { guildId } = req.params;

		const queue = musicQueues.get(guildId);
		if (!queue) {
			return res.failure('No active music queue', 404);
		}

		queue.tracks = [];
		queue.updatedAt = new Date();

		// Broadcast queue clear
		wsManager.broadcastToGuild(
			guildId,
			createWebSocketMessage('musicQueueClear', { queueId: queue.id })
		);

		logger.info(`Cleared queue for guild ${guildId}`);

		res.success({ message: 'Queue cleared' });
	} catch (error) {
		logger.error('Error clearing queue:', error);
		res.failure('Failed to clear queue', 500);
	}
};

// Shuffle queue
export const shuffleQueue = async (req: AuthRequest, res: Response) => {
	try {
		const { guildId } = req.params;

		const queue = musicQueues.get(guildId);
		if (!queue) {
			return res.failure('No active music queue', 404);
		}

		// Shuffle tracks using Fisher-Yates algorithm
		for (let i = queue.tracks.length - 1; i > 0; i--) {
			const j = Math.floor(Math.random() * (i + 1));
			[queue.tracks[i], queue.tracks[j]] = [queue.tracks[j], queue.tracks[i]];
		}

		// Update positions
		queue.tracks.forEach((track, index) => {
			track.position = index;
		});

		queue.shuffle = !queue.shuffle;
		queue.updatedAt = new Date();

		// Broadcast shuffle
		wsManager.broadcastToGuild(
			guildId,
			createWebSocketMessage('musicShuffle', {
				queueId: queue.id,
				shuffled: queue.shuffle,
			})
		);

		logger.info(`Shuffled queue for guild ${guildId}`);

		res.success({ message: 'Queue shuffled', queue });
	} catch (error) {
		logger.error('Error shuffling queue:', error);
		res.failure('Failed to shuffle queue', 500);
	}
};

// Set volume
export const setVolume = async (req: AuthRequest, res: Response) => {
	try {
		const { guildId } = req.params;
		const { volume } = req.body;

		if (typeof volume !== 'number' || volume < 0 || volume > 200) {
			return res.failure('Volume must be between 0 and 200', 400);
		}

		const queue = musicQueues.get(guildId);
		if (!queue) {
			return res.failure('No active music queue', 404);
		}

		queue.volume = volume;
		queue.updatedAt = new Date();

		// Broadcast volume change
		wsManager.broadcastToGuild(
			guildId,
			createWebSocketMessage('musicVolumeChange', {
				queueId: queue.id,
				volume,
			})
		);

		logger.info(`Set volume to ${volume} for guild ${guildId}`);

		res.success({ volume });
	} catch (error) {
		logger.error('Error setting volume:', error);
		res.failure('Failed to set volume', 500);
	}
};

// Set repeat mode
export const setRepeatMode = async (req: AuthRequest, res: Response) => {
	try {
		const { guildId } = req.params;
		const { mode } = req.body;

		if (!['OFF', 'TRACK', 'QUEUE'].includes(mode)) {
			return res.failure(
				'Invalid repeat mode. Must be OFF, TRACK, or QUEUE',
				400
			);
		}

		const queue = musicQueues.get(guildId);
		if (!queue) {
			return res.failure('No active music queue', 404);
		}

		queue.repeat = mode;
		queue.updatedAt = new Date();

		// Broadcast repeat mode change
		wsManager.broadcastToGuild(
			guildId,
			createWebSocketMessage('musicRepeatChange', {
				queueId: queue.id,
				mode,
			})
		);

		logger.info(`Set repeat mode to ${mode} for guild ${guildId}`);

		res.success({ repeatMode: mode });
	} catch (error) {
		logger.error('Error setting repeat mode:', error);
		res.failure('Failed to set repeat mode', 500);
	}
};

// Get music settings
export const getMusicSettings = async (req: AuthRequest, res: Response) => {
	try {
		const { guildId } = req.params;
		const prisma = getPrismaClient();

		const guildConfig = await prisma.guildConfig.findUnique({
			where: { guildId },
			select: {
				musicSettings: true,
			},
		});

		const settings = guildConfig?.musicSettings || {
			enabled: true,
			maxQueueSize: 100,
			maxTrackDuration: 3600, // 1 hour
			allowExplicit: false,
			djRole: null,
		};

		res.success(settings);
	} catch (error) {
		logger.error('Error getting music settings:', error);
		res.failure('Failed to get music settings', 500);
	}
};

// Update music settings
export const updateMusicSettings = async (req: AuthRequest, res: Response) => {
	try {
		const { guildId } = req.params;
		const settings = req.body;
		const prisma = getPrismaClient();

		await prisma.guildConfig.upsert({
			where: { guildId },
			update: {
				musicSettings: settings,
				updatedAt: new Date(),
			},
			create: {
				guildId,
				musicSettings: settings,
			},
		});

		res.success(settings);
	} catch (error) {
		logger.error('Error updating music settings:', error);
		res.failure('Failed to update music settings', 500);
	}
};

// Get playlists
export const getPlaylists = async (req: AuthRequest, res: Response) => {
	try {
		const { guildId } = req.params;
		const { includePublic = true, createdBy } = req.query;

		const playlists: MusicPlaylist[] = [];

		// Get guild playlists
		musicPlaylists.forEach((playlist) => {
			if (playlist.guildId === guildId) {
				if (createdBy && playlist.createdBy !== createdBy) return;
				if (!includePublic && playlist.isPublic) return;
				playlists.push(playlist);
			}
		});

		// Sort by creation date (newest first)
		playlists.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());

		const playlistSummaries = playlists.map((playlist) => ({
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
		}));

		res.success(playlistSummaries);
	} catch (error) {
		logger.error('Error getting playlists:', error);
		res.failure('Failed to get playlists', 500);
	}
};

// Create playlist
export const createPlaylist = async (req: AuthRequest, res: Response) => {
	try {
		const { guildId } = req.params;
		const { name, description, isPublic = false } = req.body;

		if (!name || name.trim().length === 0) {
			return res.failure('Playlist name is required', 400);
		}

		// Check if playlist name already exists for this guild
		const existingPlaylist = Array.from(musicPlaylists.values()).find(
			(p) =>
				p.guildId === guildId && p.name.toLowerCase() === name.toLowerCase()
		);

		if (existingPlaylist) {
			return res.failure('A playlist with this name already exists', 400);
		}

		const playlist: MusicPlaylist = {
			id: generateId(),
			guildId,
			name: name.trim(),
			description: description?.trim(),
			isPublic,
			tracks: [],
			createdBy: req.user?.id || 'unknown',
			createdAt: new Date(),
			updatedAt: new Date(),
		};

		musicPlaylists.set(playlist.id, playlist);

		logger.info(`Created playlist "${name}" for guild ${guildId}`);

		res.success(playlist, 201);
	} catch (error) {
		logger.error('Error creating playlist:', error);
		res.failure('Failed to create playlist', 500);
	}
};

// Add to playlist
export const addToPlaylist = async (req: AuthRequest, res: Response) => {
	try {
		const { guildId, playlistId } = req.params;
		const { url, title, artist, thumbnail, duration } = req.body;

		const playlist = musicPlaylists.get(playlistId);
		if (!playlist || playlist.guildId !== guildId) {
			return res.failure('Playlist not found', 404);
		}

		if (!url || !title) {
			return res.failure('URL and title are required', 400);
		}

		// Check if track already exists in playlist
		const existingTrack = playlist.tracks.find((t) => t.url === url);
		if (existingTrack) {
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
		playlist.updatedAt = new Date();

		logger.info(`Added track to playlist "${playlist.name}": ${title}`);

		res.success({ track, playlist });
	} catch (error) {
		logger.error('Error adding to playlist:', error);
		res.failure('Failed to add track to playlist', 500);
	}
};

// Get music statistics
export const getMusicStatistics = async (req: AuthRequest, res: Response) => {
	try {
		const { guildId } = req.params;
		const { timeframe = '7d' } = req.query;

		// Calculate timeframe
		const now = new Date();
		let startDate = new Date();
		switch (timeframe) {
			case '24h':
				startDate.setHours(now.getHours() - 24);
				break;
			case '7d':
				startDate.setDate(now.getDate() - 7);
				break;
			case '30d':
				startDate.setDate(now.getDate() - 30);
				break;
			default:
				startDate.setDate(now.getDate() - 7);
		}

		const history = trackHistory.get(guildId) || [];
		const recentTracks = history.filter((track) => track.playedAt >= startDate);

		const stats = {
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
		};

		res.success(stats);
	} catch (error) {
		logger.error('Error getting music statistics:', error);
		res.failure('Failed to get music statistics', 500);
	}
};

// Helper function to get top items from an array
function getTopItems(items: any[], field: string, limit: number) {
	const counts = new Map();
	items.forEach((item) => {
		const value = item[field];
		counts.set(value, (counts.get(value) || 0) + 1);
	});

	return Array.from(counts.entries())
		.sort((a, b) => b[1] - a[1])
		.slice(0, limit)
		.map(([name, count]) => ({ name, count }));
}
