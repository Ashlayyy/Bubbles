import { defineStore } from 'pinia';
import { ref } from 'vue';
import { guildsApi } from '@/lib/endpoints';
import type { Guild as ApiGuild } from '@shared/types/api';

export interface Guild extends ApiGuild {
	hasBubbles?: boolean;
}

export interface GuildStats {
	memberCount: number;
	onlineMembers: number;
	channelCount: number;
	roleCount: number;
	activeModules: string[];
}

export const useGuildsStore = defineStore('guilds', () => {
	const guilds = ref<Guild[]>([]);
	const currentGuild = ref<Guild | null>(null);
	const currentGuildStats = ref<GuildStats | null>(null);
	const loading = ref(false);

	const fetchGuilds = async () => {
		loading.value = true;
		try {
			const fetched: ApiGuild[] = await guildsApi.getUserGuilds();
			guilds.value = fetched.map((g) => ({
				...g,
				icon: g.icon ?? null,
				hasBubbles: g.hasBubbles ?? false,
			}));
		} catch (error) {
			console.error('Failed to fetch guilds:', error);
		} finally {
			loading.value = false;
		}
	};

	const fetchGuildStats = async (guildId: string) => {
		try {
			const data: ApiGuild = await guildsApi.getGuild(guildId);
			currentGuild.value = {
				...data,
				icon: data.icon ?? null,
				hasBubbles: true,
			};
			currentGuildStats.value = {
				memberCount: data.memberCount ?? 0,
				onlineMembers: data.onlineCount ?? 0,
				channelCount: 0,
				roleCount: 0,
				activeModules: [],
			};
		} catch (error) {
			console.error('Failed to fetch guild stats:', error);
			currentGuildStats.value = null;
		}
	};

	const setCurrentGuild = (guild: Guild) => {
		currentGuild.value = guild;
	};

	const getGuildIconUrl = (guild: Guild) => {
		if (!guild.icon) return null;
		return `https://cdn.discordapp.com/icons/${guild.id}/${guild.icon}.png?size=128`;
	};

	return {
		guilds,
		currentGuild,
		currentGuildStats,
		loading,
		fetchGuilds,
		fetchGuildStats,
		setCurrentGuild,
		getGuildIconUrl,
	};
});
