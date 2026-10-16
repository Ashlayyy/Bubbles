import { apiClient } from '@/lib/apiClient';

export const starboardEndpoints = {
	getSettings: (guildId: string) =>
		apiClient().get(`/guilds/${guildId}/starboard/settings`),

	updateSettings: (guildId: string, payload: Record<string, unknown>) =>
		apiClient().put(`/guilds/${guildId}/starboard/settings`, payload),

	getMessages: (
		guildId: string,
		params?: { page?: number; limit?: number; sort?: string }
	) => apiClient().get(`/guilds/${guildId}/starboard/messages`, { params }),

	toggleStar: (guildId: string, messageId: string) =>
		apiClient().post(
			`/guilds/${guildId}/starboard/messages/${messageId}/toggle`
		),

	stats: (guildId: string, params?: { period?: string }) =>
		apiClient().get(`/guilds/${guildId}/starboard/stats`, { params }),
};
