import { apiClient } from '@/lib/apiClient';

export const appealsEndpoints = {
	getSettings: (guildId: string) =>
		apiClient().get(`/guilds/${guildId}/appeals/settings`),

	updateSettings: (guildId: string, payload: Record<string, unknown>) =>
		apiClient().put(`/guilds/${guildId}/appeals/settings`, payload),

	getAppeals: (
		guildId: string,
		params?: { page?: number; limit?: number; status?: string; userId?: string }
	) => apiClient().get(`/guilds/${guildId}/appeals`, { params }),

	getAppeal: (guildId: string, appealId: string) =>
		apiClient().get(`/guilds/${guildId}/appeals/${appealId}`),

	create: (guildId: string, payload: Record<string, unknown>) =>
		apiClient().post(`/guilds/${guildId}/appeals`, payload),

	updateStatus: (
		guildId: string,
		appealId: string,
		payload: { status: string; reviewNotes?: string }
	) =>
		apiClient().patch(`/guilds/${guildId}/appeals/${appealId}/status`, payload),

	remove: (guildId: string, appealId: string) =>
		apiClient().delete(`/guilds/${guildId}/appeals/${appealId}`),
};
