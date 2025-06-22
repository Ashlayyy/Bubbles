import { apiClient } from '@/lib/apiClient';

export const loggingEndpoints = {
	getSettings: (guildId: string) =>
		apiClient().get(`/guilds/${guildId}/logging/settings`),

	updateSettings: (guildId: string, payload: Record<string, unknown>) =>
		apiClient().put(`/guilds/${guildId}/logging/settings`, payload),

	getAuditLogs: (
		guildId: string,
		params?: { limit?: number; offset?: number }
	) => apiClient().get(`/guilds/${guildId}/logging/audit`, { params }),

	exportAuditLogs: (guildId: string) =>
		apiClient().post(`/guilds/${guildId}/logging/audit/export`),
};
