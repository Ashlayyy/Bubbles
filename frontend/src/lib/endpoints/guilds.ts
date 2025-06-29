import { apiClient } from '@/lib/apiClient';
import type { Guild } from '@shared/types/api';
import type { DiscordItem } from '@/types/discord';

export const getUserGuilds = async () => {
	const { data } = await apiClient().get('/guilds');
	const payload = (data as { data?: { guilds: Guild[] } }).data ?? data;
	return (payload.guilds ?? payload) as Guild[];
};

export const getGuild = async (guildId: string) => {
	const { data } = await apiClient().get(`/guilds/${guildId}`);
	const payload = (data as { data?: Guild }).data ?? data;
	return payload as Guild;
};

export const getGuildChannels = async (guildId: string) => {
	const { data } = await apiClient().get(`/guilds/${guildId}/channels`);
	return data as DiscordItem[];
};

export const getGuildRoles = async (guildId: string) => {
	const { data } = await apiClient().get(`/guilds/${guildId}/roles`);
	return data as DiscordItem[];
};

export const getGuildMembers = (
	guildId: string,
	params?: { limit?: number; offset?: number }
) => apiClient().get(`/guilds/${guildId}/members`, { params });
