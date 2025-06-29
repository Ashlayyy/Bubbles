import { apiClient } from '@/lib/apiClient';

export const analyticsEndpoints = {
	getOverview: (guildId: string, params?: { period?: string }) =>
		apiClient().get(`/guilds/${guildId}/analytics/overview`, { params }),

	getMembers: (guildId: string, params?: { period?: string }) =>
		apiClient().get(`/guilds/${guildId}/analytics/members`, { params }),

	getMessages: (guildId: string, params?: { period?: string }) =>
		apiClient().get(`/guilds/${guildId}/analytics/messages`, { params }),

	getModeration: (guildId: string, params?: { period?: string }) =>
		apiClient().get(`/guilds/${guildId}/analytics/moderation`, { params }),

	getActivity: (guildId: string, params?: { period?: string }) =>
		apiClient().get(`/guilds/${guildId}/analytics/activity`, { params }),
};
