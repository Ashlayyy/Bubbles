import { apiClient } from '@/lib/apiClient';
import type { Guild } from '@shared/types/api';

export const getUserGuilds = async () => {
	const { data } = await apiClient().get('/users/@me/guilds');
	return data as Guild[];
};

export const getGuild = async (guildId: string) => {
	const { data } = await apiClient().get(`/guilds/${guildId}`);
	return data as Guild;
};

export const getGuildChannels = (guildId: string) =>
	apiClient().get(`/guilds/${guildId}/channels`);
export const getGuildRoles = (guildId: string) =>
	apiClient().get(`/guilds/${guildId}/roles`);
export const getGuildMembers = (
	guildId: string,
	params?: { limit?: number; offset?: number }
) => apiClient().get(`/guilds/${guildId}/members`, { params });
