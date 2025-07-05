import { apiClient } from '@/lib/apiClient';

export const automationEndpoints = {
	getRules: (guildId: string) =>
		apiClient().get(`/guilds/${guildId}/automation/rules`),

	getRule: (guildId: string, ruleId: string) =>
		apiClient().get(`/guilds/${guildId}/automation/rules/${ruleId}`),

	createRule: (guildId: string, payload: Record<string, unknown>) =>
		apiClient().post(`/guilds/${guildId}/automation/rules`, payload),

	updateRule: (
		guildId: string,
		ruleId: string,
		payload: Record<string, unknown>
	) =>
		apiClient().put(`/guilds/${guildId}/automation/rules/${ruleId}`, payload),

	deleteRule: (guildId: string, ruleId: string) =>
		apiClient().delete(`/guilds/${guildId}/automation/rules/${ruleId}`),

	executeRule: (guildId: string, ruleId: string) =>
		apiClient().post(`/guilds/${guildId}/automation/rules/${ruleId}/execute`),

	getExecutions: (
		guildId: string,
		params?: { page?: number; limit?: number }
	) => apiClient().get(`/guilds/${guildId}/automation/executions`, { params }),

	stats: (guildId: string, params?: { period?: string }) =>
		apiClient().get(`/guilds/${guildId}/automation/statistics`, { params }),

	getAvailableTriggers: (guildId: string) =>
		apiClient().get(`/guilds/${guildId}/automation/triggers`),

	getAvailableActions: (guildId: string) =>
		apiClient().get(`/guilds/${guildId}/automation/actions`),
};
