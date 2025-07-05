import { defineStore } from 'pinia';
import { ref } from 'vue';
import { guildsApi } from '@/lib/endpoints';
import type { Guild as ApiGuild } from '@shared/types/api';

export type GuildItem = ApiGuild & { hasBubbles?: boolean };

export interface GuildStats {
	memberCount: number;
	onlineMembers: number;
	channelCount: number;
	roleCount: number;
	activeModules: string[];
}

export const useGuildsStore = defineStore('guilds', () => {
	const guilds = ref<GuildItem[]>([]);
	const currentGuild = ref<GuildItem | null>(null);
	const currentGuildStats = ref<GuildStats | null>(null);
	const loading = ref(false);
	const loaded = ref(false);

	// Simple in-memory cache for guild stats
	const STAT_TTL_MS = 60 * 1000; // 60 seconds
	const statsCache: Map<string, { data: GuildStats; fetchedAt: number }> =
		new Map();

	const fetchGuilds = async () => {
		if (loading.value || loaded.value) return;
		loading.value = true;
		try {
			const fetched: ApiGuild[] = await guildsApi.getUserGuilds();
			guilds.value = fetched.map((g): GuildItem => {
				const hasBubbles =
					(g as unknown as { hasBubbles?: boolean }).hasBubbles ?? false;
				return {
					...g,
					icon: g.icon ?? null,
					hasBubbles,
				};
			});
		} catch (error) {
			console.error('Failed to fetch guilds:', error);
		} finally {
			loading.value = false;
			loaded.value = guilds.value.length > 0;
		}
	};

	const fetchGuildStats = async (guildId: string) => {
		const now = Date.now();
		const cached = statsCache.get(guildId);

		// Use cache if it exists and is fresh
		if (cached && now - cached.fetchedAt < STAT_TTL_MS) {
			currentGuildStats.value = cached.data;
			return;
		}

		try {
			const data: ApiGuild = await guildsApi.getGuild(guildId);

			// Update currentGuild (keep icon / bubbles info consistent)
			currentGuild.value = {
				...data,
				icon: data.icon ?? null,
				hasBubbles: true,
			};

			const extended = data as ApiGuild & {
				channels?: unknown[];
				roles?: unknown[];
				onlineCount?: number;
			};

			const stats: GuildStats = {
				memberCount: extended.memberCount ?? 0,
				onlineMembers: extended.onlineCount ?? 0,
				channelCount: extended.channels?.length ?? 0,
				roleCount: extended.roles?.length ?? 0,
				activeModules: [],
			};

			currentGuildStats.value = stats;
			statsCache.set(guildId, { data: stats, fetchedAt: now });
		} catch (error) {
			console.error('Failed to fetch guild stats:', error);
			currentGuildStats.value = null;
		}
	};

	const setCurrentGuild = (guild: GuildItem) => {
		currentGuild.value = guild;
	};

	const getGuildIconUrl = (guild: GuildItem) => {
		if (!guild.icon) return null;
		return `https://cdn.discordapp.com/icons/${guild.id}/${guild.icon}.png?size=128`;
	};

	return {
		guilds,
		currentGuild,
		currentGuildStats,
		loading,
		loaded,
		fetchGuilds,
		fetchGuildStats,
		setCurrentGuild,
		getGuildIconUrl,
	};
});
