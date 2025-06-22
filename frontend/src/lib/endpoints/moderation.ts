import { apiClient } from '@/lib/apiClient';

export const moderationEndpoints = {
	getCases: (guildId: string, params?: { limit?: number; offset?: number }) =>
		apiClient().get(`/guilds/${guildId}/moderation/cases`, { params }),

	createModerationCase: (guildId: string, payload: Record<string, unknown>) =>
		apiClient().post(`/guilds/${guildId}/moderation/cases`, payload),

	getBans: (guildId: string, params?: { limit?: number; offset?: number }) =>
		apiClient().get(`/guilds/${guildId}/moderation/bans`, { params }),

	unbanUser: (guildId: string, userId: string) =>
		apiClient().delete(`/guilds/${guildId}/moderation/bans/${userId}`),

	getMutes: (guildId: string, params?: { limit?: number; offset?: number }) =>
		apiClient().get(`/guilds/${guildId}/moderation/mutes`, { params }),

	unmuteUser: (guildId: string, userId: string) =>
		apiClient().delete(`/guilds/${guildId}/moderation/mutes/${userId}`),

	getSettings: (guildId: string) =>
		apiClient().get(`/guilds/${guildId}/moderation/settings`),

	updateSettings: (guildId: string, payload: Record<string, unknown>) =>
		apiClient().put(`/guilds/${guildId}/moderation/settings`, payload),
};
