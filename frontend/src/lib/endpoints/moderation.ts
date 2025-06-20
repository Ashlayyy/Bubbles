import { apiClient } from '@/lib/apiClient';

export const getCases = (
	guildId: string,
	params?: { limit?: number; offset?: number }
) => apiClient().get(`/guilds/${guildId}/moderation/cases`, { params });

export const createCase = (guildId: string, payload: Record<string, unknown>) =>
	apiClient().post(`/guilds/${guildId}/moderation/cases`, payload);

export const getBans = (
	guildId: string,
	params?: { limit?: number; offset?: number }
) => apiClient().get(`/guilds/${guildId}/moderation/bans`, { params });

export const banUser = (
	guildId: string,
	payload: { userId: string; reason?: string; deleteMessageDays?: number }
) => apiClient().post(`/guilds/${guildId}/moderation/bans`, payload);

export const unbanUser = (guildId: string, userId: string) =>
	apiClient().delete(`/guilds/${guildId}/moderation/bans/${userId}`);

export const getMutes = (
	guildId: string,
	params?: { limit?: number; offset?: number }
) => apiClient().get(`/guilds/${guildId}/moderation/mutes`, { params });

export const muteUser = (
	guildId: string,
	payload: { userId: string; reason?: string; duration?: number }
) => apiClient().post(`/guilds/${guildId}/moderation/mutes`, payload);

export const unmuteUser = (guildId: string, userId: string) =>
	apiClient().delete(`/guilds/${guildId}/moderation/mutes/${userId}`);
