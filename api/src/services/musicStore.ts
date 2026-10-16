import { getPrismaClient } from './databaseService.js';

export interface MusicTrack {
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

export interface MusicQueue {
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

export interface PlaylistTrack {
	title: string;
	artist: string;
	url: string;
	thumbnail?: string;
	duration: number;
	addedBy: string;
	position: number;
}

export interface MusicPlaylist {
	id: string;
	guildId: string;
	name: string;
	description?: string;
	isPublic: boolean;
	tracks: PlaylistTrack[];
	createdBy: string;
	createdAt: Date;
	updatedAt: Date;
}

export interface HistoryTrack {
	title: string;
	artist: string;
	url: string;
	thumbnail?: string;
	duration: number;
	requestedBy: string;
	playedAt: Date;
}

function asTracks(value: unknown): MusicTrack[] {
	if (!Array.isArray(value)) return [];
	return value.map((track, index) => ({
		id: String(track.id ?? `${index}`),
		title: String(track.title ?? 'Unknown'),
		artist: String(track.artist ?? 'Unknown Artist'),
		url: String(track.url ?? ''),
		thumbnail: track.thumbnail,
		duration: Number(track.duration ?? 0),
		position: Number(track.position ?? index),
		requestedBy: String(track.requestedBy ?? 'Unknown'),
		addedAt: track.addedAt ? new Date(track.addedAt) : new Date(),
	}));
}

function asPlaylistTracks(value: unknown): PlaylistTrack[] {
	if (!Array.isArray(value)) return [];
	return value.map((track, index) => ({
		title: String(track.title ?? 'Unknown'),
		artist: String(track.artist ?? 'Unknown Artist'),
		url: String(track.url ?? ''),
		thumbnail: track.thumbnail,
		duration: Number(track.duration ?? 0),
		addedBy: String(track.addedBy ?? 'unknown'),
		position: Number(track.position ?? index),
	}));
}

function mapQueue(row: {
	id: string;
	guildId: string;
	channelId: string | null;
	playing: boolean;
	paused: boolean;
	volume: number;
	repeat: string;
	shuffle: boolean;
	currentTrack: unknown;
	tracks: unknown;
	createdAt: Date;
	updatedAt: Date;
}): MusicQueue {
	return {
		id: row.id,
		guildId: row.guildId,
		channelId: row.channelId ?? undefined,
		playing: row.playing,
		paused: row.paused,
		volume: row.volume,
		repeat: (['OFF', 'TRACK', 'QUEUE'].includes(row.repeat)
			? row.repeat
			: 'OFF') as MusicQueue['repeat'],
		shuffle: row.shuffle,
		currentTrack: (row.currentTrack as MusicQueue['currentTrack']) ?? undefined,
		tracks: asTracks(row.tracks),
		createdAt: row.createdAt,
		updatedAt: row.updatedAt,
	};
}

function mapPlaylist(row: {
	id: string;
	guildId: string;
	name: string;
	description: string | null;
	isPublic: boolean;
	tracks: unknown;
	createdBy: string;
	createdAt: Date;
	updatedAt: Date;
}): MusicPlaylist {
	return {
		id: row.id,
		guildId: row.guildId,
		name: row.name,
		description: row.description ?? undefined,
		isPublic: row.isPublic,
		tracks: asPlaylistTracks(row.tracks),
		createdBy: row.createdBy,
		createdAt: row.createdAt,
		updatedAt: row.updatedAt,
	};
}

export async function getQueue(guildId: string): Promise<MusicQueue | null> {
	const prisma = getPrismaClient();
	const row = await prisma.musicQueue.findUnique({ where: { guildId } });
	return row ? mapQueue(row) : null;
}

export async function saveQueue(queue: MusicQueue): Promise<MusicQueue> {
	const prisma = getPrismaClient();
	const data = {
		channelId: queue.channelId ?? null,
		playing: queue.playing,
		paused: queue.paused,
		volume: queue.volume,
		repeat: queue.repeat,
		shuffle: queue.shuffle,
		currentTrack: queue.currentTrack ?? null,
		tracks: queue.tracks,
	};
	const row = await prisma.musicQueue.upsert({
		where: { guildId: queue.guildId },
		create: {
			guildId: queue.guildId,
			...data,
		},
		update: data,
	});
	return mapQueue(row);
}

export async function getOrCreateQueue(
	guildId: string,
	channelId?: string
): Promise<MusicQueue> {
	const existing = await getQueue(guildId);
	if (existing) return existing;
	return saveQueue({
		id: guildId,
		guildId,
		channelId,
		playing: false,
		paused: false,
		volume: 50,
		repeat: 'OFF',
		shuffle: false,
		tracks: [],
		createdAt: new Date(),
		updatedAt: new Date(),
	});
}

export async function getHistory(guildId: string): Promise<HistoryTrack[]> {
	const prisma = getPrismaClient();
	const rows = await prisma.musicHistory.findMany({
		where: { guildId },
		orderBy: { playedAt: 'desc' },
		take: 50,
	});
	return rows
		.map((row: {
			title: string;
			artist: string;
			url: string;
			thumbnail: string | null;
			duration: number;
			requestedBy: string;
			playedAt: Date;
		}) => ({
			title: row.title,
			artist: row.artist,
			url: row.url,
			thumbnail: row.thumbnail ?? undefined,
			duration: row.duration,
			requestedBy: row.requestedBy,
			playedAt: row.playedAt,
		}))
		.reverse();
}

export async function appendHistory(
	guildId: string,
	track: Omit<HistoryTrack, 'playedAt'> & { playedAt?: Date }
): Promise<void> {
	const prisma = getPrismaClient();
	await prisma.musicHistory.create({
		data: {
			guildId,
			title: track.title,
			artist: track.artist,
			url: track.url,
			thumbnail: track.thumbnail,
			duration: track.duration,
			requestedBy: track.requestedBy,
			playedAt: track.playedAt ?? new Date(),
		},
	});
	const extra = await prisma.musicHistory.findMany({
		where: { guildId },
		orderBy: { playedAt: 'desc' },
		skip: 50,
		select: { id: true },
	});
	if (extra.length > 0) {
		await prisma.musicHistory.deleteMany({
			where: { id: { in: extra.map((row: { id: string }) => row.id) } },
		});
	}
}

export async function listPlaylists(
	guildId: string,
	opts: { includePublic?: boolean; createdBy?: string } = {}
): Promise<MusicPlaylist[]> {
	const prisma = getPrismaClient();
	const rows = await prisma.musicPlaylist.findMany({
		where: { guildId },
		orderBy: { createdAt: 'desc' },
	});
	return rows
		.map(mapPlaylist)
		.filter((playlist: MusicPlaylist) => {
			if (opts.createdBy && playlist.createdBy !== opts.createdBy) return false;
			if (opts.includePublic === false && playlist.isPublic) return false;
			return true;
		});
}

export async function getPlaylist(
	guildId: string,
	playlistId: string
): Promise<MusicPlaylist | null> {
	const prisma = getPrismaClient();
	const row = await prisma.musicPlaylist.findUnique({ where: { id: playlistId } });
	if (!row || row.guildId !== guildId) return null;
	return mapPlaylist(row);
}

export async function createPlaylist(playlist: {
	guildId: string;
	name: string;
	description?: string;
	isPublic: boolean;
	createdBy: string;
}): Promise<MusicPlaylist> {
	const prisma = getPrismaClient();
	const row = await prisma.musicPlaylist.create({
		data: {
			guildId: playlist.guildId,
			name: playlist.name,
			description: playlist.description,
			isPublic: playlist.isPublic,
			tracks: [],
			createdBy: playlist.createdBy,
		},
	});
	return mapPlaylist(row);
}

export async function savePlaylist(playlist: MusicPlaylist): Promise<MusicPlaylist> {
	const prisma = getPrismaClient();
	const row = await prisma.musicPlaylist.update({
		where: { id: playlist.id },
		data: {
			name: playlist.name,
			description: playlist.description,
			isPublic: playlist.isPublic,
			tracks: playlist.tracks,
		},
	});
	return mapPlaylist(row);
}
