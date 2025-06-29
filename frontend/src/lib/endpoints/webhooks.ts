import { apiClient } from '@/lib/apiClient';

export const webhooksEndpoints = {
	getWebhooks: (guildId: string) =>
		apiClient().get(`/guilds/${guildId}/webhooks`),

	getWebhook: (guildId: string, webhookId: string) =>
		apiClient().get(`/guilds/${guildId}/webhooks/${webhookId}`),

	createWebhook: (guildId: string, payload: Record<string, unknown>) =>
		apiClient().post(`/guilds/${guildId}/webhooks`, payload),

	updateWebhook: (
		guildId: string,
		webhookId: string,
		payload: Record<string, unknown>
	) => apiClient().put(`/guilds/${guildId}/webhooks/${webhookId}`, payload),

	deleteWebhook: (guildId: string, webhookId: string) =>
		apiClient().delete(`/guilds/${guildId}/webhooks/${webhookId}`),

	testWebhook: (guildId: string, webhookId: string) =>
		apiClient().post(`/guilds/${guildId}/webhooks/${webhookId}/test`),

	getLogs: (guildId: string, params?: { page?: number; limit?: number }) =>
		apiClient().get(`/guilds/${guildId}/webhooks/logs`, { params }),

	stats: (guildId: string, params?: { period?: string }) =>
		apiClient().get(`/guilds/${guildId}/webhooks/statistics`, { params }),
};
