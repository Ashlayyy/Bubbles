import type { Response } from 'express';
import { createLogger, type ApiResponse } from '../types/shared.js';
import type { AuthRequest } from '../middleware/auth.js';
import { wsManager } from '../websocket/manager.js';

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

		res.json({
			success: true,
			data: status,
		} as ApiResponse);
	} catch (error) {
		logger.error('Error fetching music status:', error);
		res.status(500).json({
			success: false,
			error: 'Failed to fetch music status',
		} as ApiResponse);
	}
};

// Play music
export const playMusic = async (req: AuthRequest, res: Response) => {
	try {
		const { guildId } = req.params;
		const { query, platform = 'youtube' } = req.body;

		if (!query) {
			return res.status(400).json({
				success: false,
				error: 'Query is required',
			} as ApiResponse);
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

		res.json({
			success: true,
			message: 'Track added to queue',
			data: {
				added: true,
				position: newTrack.position + 1,
				track: newTrack,
			},
		} as ApiResponse);
	} catch (error) {
		logger.error('Error playing music:', error);
		res.status(500).json({
			success: false,
			error: 'Failed to play music',
		} as ApiResponse);
	}
};

// Pause music
export const pauseMusic = async (req: AuthRequest, res: Response) => {
	try {
		const { guildId } = req.params;

		const queue = musicQueues.get(guildId);
		if (!queue) {
			return res.status(404).json({
				success: false,
				error: 'No active music queue',
			} as ApiResponse);
		}

		queue.paused = true;
		queue.updatedAt = new Date();

		// Broadcast pause
		wsManager.broadcastToGuild(
			guildId,
			createWebSocketMessage('musicPause', { queueId: queue.id })
		);

		logger.info(`Paused music for guild ${guildId}`);

		res.json({
			success: true,
			message: 'Music paused',
		} as ApiResponse);
	} catch (error) {
		logger.error('Error pausing music:', error);
		res.status(500).json({
			success: false,
			error: 'Failed to pause music',
		} as ApiResponse);
	}
};

// Resume music
export const resumeMusic = async (req: AuthRequest, res: Response) => {
	try {
		const { guildId } = req.params;

		const queue = musicQueues.get(guildId);
		if (!queue) {
			return res.status(404).json({
				success: false,
				error: 'No active music queue',
			} as ApiResponse);
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

		res.json({
			success: true,
			message: 'Music resumed',
		} as ApiResponse);
	} catch (error) {
		logger.error('Error resuming music:', error);
		res.status(500).json({
			success: false,
			error: 'Failed to resume music',
		} as ApiResponse);
	}
};

// Skip track
export const skipTrack = async (req: AuthRequest, res: Response) => {
	try {
		const { guildId } = req.params;

		const queue = musicQueues.get(guildId);
		if (!queue) {
			return res.status(404).json({
				success: false,
				error: 'No active music queue',
			} as ApiResponse);
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

		res.json({
			success: true,
			message: 'Track skipped',
		} as ApiResponse);
	} catch (error) {
		logger.error('Error skipping track:', error);
		res.status(500).json({
			success: false,
			error: 'Failed to skip track',
		} as ApiResponse);
	}
};

// Stop music
export const stopMusic = async (req: AuthRequest, res: Response) => {
	try {
		const { guildId } = req.params;

		const queue = musicQueues.get(guildId);
		if (!queue) {
			return res.status(404).json({
				success: false,
				error: 'No active music queue',
			} as ApiResponse);
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

		res.json({
			success: true,
			message: 'Music stopped and queue cleared',
		} as ApiResponse);
	} catch (error) {
		logger.error('Error stopping music:', error);
		res.status(500).json({
			success: false,
			error: 'Failed to stop music',
		} as ApiResponse);
	}
};

// Get current queue for guild
export const getQueue = async (req: AuthRequest, res: Response) => {
	try {
		const { guildId } = req.params;
		const { includeHistory = false } = req.query;

		const queue = musicQueues.get(guildId);
		const history =
			includeHistory === 'true' ? trackHistory.get(guildId) || [] : [];

		if (!queue) {
			return res.json({
				success: true,
				data: {
					playing: false,
					queue: [],
					currentTrack: null,
					history: [],
				},
			} as ApiResponse);
		}

		const queueData = {
			id: queue.id,
			guildId: queue.guildId,
			channelId: queue.channelId,
			playing: queue.playing,
			paused: queue.paused,
			volume: queue.volume,
			repeat: queue.repeat,
			shuffle: queue.shuffle,
			currentTrack: queue.currentTrack,
			queue: queue.tracks,
			history,
		};

		res.json({
			success: true,
			data: queueData,
		} as ApiResponse);
	} catch (error) {
		logger.error('Error fetching music queue:', error);
		res.status(500).json({
			success: false,
			error: 'Failed to fetch music queue',
		} as ApiResponse);
	}
};

// Clear queue
export const clearQueue = async (req: AuthRequest, res: Response) => {
	try {
		const { guildId } = req.params;

		const queue = musicQueues.get(guildId);
		if (!queue) {
			return res.status(404).json({
				success: false,
				error: 'No active music queue',
			} as ApiResponse);
		}

		queue.tracks = [];
		queue.updatedAt = new Date();

		// Broadcast queue clear
		wsManager.broadcastToGuild(
			guildId,
			createWebSocketMessage('musicQueueClear', { queueId: queue.id })
		);

		logger.info(`Cleared queue for guild ${guildId}`);

		res.json({
			success: true,
			message: 'Queue cleared',
		} as ApiResponse);
	} catch (error) {
		logger.error('Error clearing queue:', error);
		res.status(500).json({
			success: false,
			error: 'Failed to clear queue',
		} as ApiResponse);
	}
};

// Shuffle queue
export const shuffleQueue = async (req: AuthRequest, res: Response) => {
	try {
		const { guildId } = req.params;

		const queue = musicQueues.get(guildId);
		if (!queue) {
			return res.status(404).json({
				success: false,
				error: 'No active music queue',
			} as ApiResponse);
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

		res.json({
			success: true,
			message: 'Queue shuffled',
		} as ApiResponse);
	} catch (error) {
		logger.error('Error shuffling queue:', error);
		res.status(500).json({
			success: false,
			error: 'Failed to shuffle queue',
		} as ApiResponse);
	}
};

// Set volume
export const setVolume = async (req: AuthRequest, res: Response) => {
	try {
		const { guildId } = req.params;
		const { volume } = req.body;

		if (typeof volume !== 'number' || volume < 0 || volume > 100) {
			return res.status(400).json({
				success: false,
				error: 'Volume must be a number between 0 and 100',
			} as ApiResponse);
		}

		const queue = musicQueues.get(guildId);
		if (!queue) {
			return res.status(404).json({
				success: false,
				error: 'No active music queue',
			} as ApiResponse);
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

		res.json({
			success: true,
			message: `Volume set to ${volume}%`,
			data: { volume },
		} as ApiResponse);
	} catch (error) {
		logger.error('Error setting volume:', error);
		res.status(500).json({
			success: false,
			error: 'Failed to set volume',
		} as ApiResponse);
	}
};

// Set repeat mode
export const setRepeatMode = async (req: AuthRequest, res: Response) => {
	try {
		const { guildId } = req.params;
		const { mode } = req.body;

		const validModes = ['OFF', 'TRACK', 'QUEUE'];
		if (!validModes.includes(mode)) {
			return res.status(400).json({
				success: false,
				error: 'Invalid repeat mode. Must be: OFF, TRACK, or QUEUE',
			} as ApiResponse);
		}

		const queue = musicQueues.get(guildId);
		if (!queue) {
			return res.status(404).json({
				success: false,
				error: 'No active music queue',
			} as ApiResponse);
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

		res.json({
			success: true,
			message: `Repeat mode set to ${mode}`,
			data: { mode },
		} as ApiResponse);
	} catch (error) {
		logger.error('Error setting repeat mode:', error);
		res.status(500).json({
			success: false,
			error: 'Failed to set repeat mode',
		} as ApiResponse);
	}
};

// Get music settings
export const getMusicSettings = async (req: AuthRequest, res: Response) => {
	try {
		const { guildId } = req.params;

		// Default settings (in real implementation, would come from database)
		const settings = {
			enabled: true,
			djRoleId: null,
			maxQueueSize: 100,
			maxTrackDuration: 600000, // 10 minutes
			allowNSFW: false,
			defaultVolume: 50,
			autoLeave: true,
			autoLeaveDelay: 300000, // 5 minutes
			allowedChannels: [],
			blockedChannels: [],
		};

		res.json({
			success: true,
			data: settings,
		} as ApiResponse);
	} catch (error) {
		logger.error('Error fetching music settings:', error);
		res.status(500).json({
			success: false,
			error: 'Failed to fetch music settings',
		} as ApiResponse);
	}
};

// Update music settings
export const updateMusicSettings = async (req: AuthRequest, res: Response) => {
	try {
		const { guildId } = req.params;
		const settings = req.body;

		// In a real implementation, would save to database
		logger.info(`Update music settings for guild ${guildId}`, settings);

		res.json({
			success: true,
			message: 'Music settings updated',
			data: settings,
		} as ApiResponse);
	} catch (error) {
		logger.error('Error updating music settings:', error);
		res.status(500).json({
			success: false,
			error: 'Failed to update music settings',
		} as ApiResponse);
	}
};

// Get in-memory playlists
export const getPlaylists = async (req: AuthRequest, res: Response) => {
	try {
		const { guildId } = req.params;
		const { page = 1, limit = 20, search } = req.query;

		const skip = (parseInt(page as string) - 1) * parseInt(limit as string);
		const take = parseInt(limit as string);

		// Get playlists for guild
		const guildPlaylists = Array.from(musicPlaylists.values())
			.filter((playlist) => {
				if (playlist.guildId !== guildId) return false;
				if (search) {
					const searchLower = (search as string).toLowerCase();
					return (
						playlist.name.toLowerCase().includes(searchLower) ||
						playlist.description?.toLowerCase().includes(searchLower)
					);
				}
				return true;
			})
			.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());

		const total = guildPlaylists.length;
		const playlists = guildPlaylists.slice(skip, skip + take);

		const formattedPlaylists = playlists.map((playlist) => ({
			id: playlist.id,
			name: playlist.name,
			description: playlist.description,
			isPublic: playlist.isPublic,
			trackCount: playlist.tracks.length,
			totalDuration: playlist.tracks.reduce(
				(sum, track) => sum + track.duration,
				0
			),
			createdAt: playlist.createdAt,
			updatedAt: playlist.updatedAt,
		}));

		res.json({
			success: true,
			data: {
				playlists: formattedPlaylists,
				pagination: {
					page: parseInt(page as string),
					limit: parseInt(limit as string),
					total,
					pages: Math.ceil(total / take),
				},
			},
		} as ApiResponse);
	} catch (error) {
		logger.error('Error fetching playlists:', error);
		res.status(500).json({
			success: false,
			error: 'Failed to fetch playlists',
		} as ApiResponse);
	}
};

// Create playlist
export const createPlaylist = async (req: AuthRequest, res: Response) => {
	try {
		const { guildId } = req.params;
		const { name, description = '', isPublic = true } = req.body;

		// Check if playlist name exists
		const existingPlaylist = Array.from(musicPlaylists.values()).find(
			(p) =>
				p.guildId === guildId && p.name.toLowerCase() === name.toLowerCase()
		);

		if (existingPlaylist) {
			return res.status(400).json({
				success: false,
				error: 'Playlist name already exists',
			} as ApiResponse);
		}

		// Create playlist
		const playlist: MusicPlaylist = {
			id: generateId(),
			guildId,
			name,
			description,
			isPublic,
			tracks: [],
			createdBy: req.user?.id || 'unknown',
			createdAt: new Date(),
			updatedAt: new Date(),
		};

		musicPlaylists.set(playlist.id, playlist);

		// Broadcast playlist creation
		wsManager.broadcastToGuild(
			guildId,
			createWebSocketMessage('musicPlaylistCreate', playlist)
		);

		logger.info(`Created playlist '${name}' for guild ${guildId}`, {
			playlistId: playlist.id,
			createdBy: req.user?.id,
		});

		res.status(201).json({
			success: true,
			message: 'Playlist created successfully',
			data: playlist,
		} as ApiResponse);
	} catch (error) {
		logger.error('Error creating playlist:', error);
		res.status(500).json({
			success: false,
			error: 'Failed to create playlist',
		} as ApiResponse);
	}
};

// Add tracks to playlist
export const addToPlaylist = async (req: AuthRequest, res: Response) => {
	try {
		const { guildId, playlistId } = req.params;
		const { tracks } = req.body;

		const playlist = musicPlaylists.get(playlistId);
		if (!playlist || playlist.guildId !== guildId) {
			return res.status(404).json({
				success: false,
				error: 'Playlist not found',
			} as ApiResponse);
		}

		// Add tracks to playlist
		const startPosition = playlist.tracks.length;
		const newTracks = tracks.map((track: any, index: number) => ({
			title: track.title,
			artist: track.artist || 'Unknown Artist',
			url: track.url,
			thumbnail: track.thumbnail || null,
			duration: track.duration || 0,
			position: startPosition + index,
			addedBy: req.user?.id || 'unknown',
		}));

		playlist.tracks.push(...newTracks);
		playlist.updatedAt = new Date();

		// Broadcast playlist update
		wsManager.broadcastToGuild(
			guildId,
			createWebSocketMessage('musicPlaylistUpdate', {
				playlistId,
				tracksAdded: newTracks.length,
			})
		);

		logger.info(
			`Added ${tracks.length} tracks to playlist ${playlistId} for guild ${guildId}`
		);

		res.json({
			success: true,
			message: `Added ${tracks.length} tracks to playlist`,
			data: newTracks,
		} as ApiResponse);
	} catch (error) {
		logger.error('Error adding tracks to playlist:', error);
		res.status(500).json({
			success: false,
			error: 'Failed to add tracks to playlist',
		} as ApiResponse);
	}
};

// Get music statistics
export const getMusicStatistics = async (req: AuthRequest, res: Response) => {
	try {
		const { guildId } = req.params;
		const { period = '7d' } = req.query;

		const playlists = Array.from(musicPlaylists.values()).filter(
			(p) => p.guildId === guildId
		);

		const history = trackHistory.get(guildId) || [];
		const queue = musicQueues.get(guildId);

		// Calculate statistics
		const totalPlaylists = playlists.length;
		const totalPlaylistTracks = playlists.reduce(
			(sum, p) => sum + p.tracks.length,
			0
		);
		const recentHistory = history.length;

		// Get most played tracks (from history)
		const trackCounts = new Map<string, { count: number; track: any }>();
		history.forEach((track) => {
			const key = `${track.title}-${track.artist}`;
			const existing = trackCounts.get(key);
			if (existing) {
				existing.count++;
			} else {
				trackCounts.set(key, { count: 1, track });
			}
		});

		const topTracks = Array.from(trackCounts.values())
			.sort((a, b) => b.count - a.count)
			.slice(0, 10)
			.map(({ count, track }) => ({
				title: track.title,
				artist: track.artist,
				playCount: count,
			}));

		// Get most active users
		const userCounts = new Map<string, number>();
		history.forEach((track) => {
			const existing = userCounts.get(track.requestedBy);
			userCounts.set(track.requestedBy, (existing || 0) + 1);
		});

		const topUsers = Array.from(userCounts.entries())
			.sort((a, b) => b[1] - a[1])
			.slice(0, 10)
			.map(([userId, count]) => ({
				userId,
				requestCount: count,
			}));

		const statistics = {
			period: period as string,
			overview: {
				totalPlaylists,
				totalPlaylistTracks,
				tracksPlayedRecently: recentHistory,
				averageTracksPerDay: Math.round(recentHistory / 7), // Simplified
				currentQueueSize: queue?.tracks.length || 0,
			},
			topTracks,
			topUsers,
			currentQueue: queue
				? {
						playing: queue.playing,
						paused: queue.paused,
						trackCount: queue.tracks.length,
						currentTrack: queue.currentTrack?.title || null,
				  }
				: null,
		};

		res.json({
			success: true,
			data: statistics,
		} as ApiResponse);
	} catch (error) {
		logger.error('Error fetching music statistics:', error);
		res.status(500).json({
			success: false,
			error: 'Failed to fetch music statistics',
		} as ApiResponse);
	}
};
