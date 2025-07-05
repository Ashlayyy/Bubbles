import { apiClient } from '@/lib/apiClient';

export const remindersEndpoints = {
	getReminders: (
		guildId: string,
		params?: { page?: number; limit?: number; status?: string }
	) => apiClient().get(`/guilds/${guildId}/reminders`, { params }),

	getReminder: (guildId: string, reminderId: string) =>
		apiClient().get(`/guilds/${guildId}/reminders/${reminderId}`),

	create: (guildId: string, payload: Record<string, unknown>) =>
		apiClient().post(`/guilds/${guildId}/reminders`, payload),

	update: (
		guildId: string,
		reminderId: string,
		payload: Record<string, unknown>
	) => apiClient().put(`/guilds/${guildId}/reminders/${reminderId}`, payload),

	delete: (guildId: string, reminderId: string) =>
		apiClient().delete(`/guilds/${guildId}/reminders/${reminderId}`),

	cancel: (guildId: string, reminderId: string) =>
		apiClient().post(`/guilds/${guildId}/reminders/${reminderId}/cancel`),

	test: (guildId: string) =>
		apiClient().post(`/guilds/${guildId}/reminders/test`),

	stats: (guildId: string, params?: { period?: string }) =>
		apiClient().get(`/guilds/${guildId}/reminders/statistics`, { params }),
};
