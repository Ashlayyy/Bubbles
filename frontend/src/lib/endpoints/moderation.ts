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

	// Moderator Notes
	getModeratorNotes: (
		guildId: string,
		params?: { userId?: string; limit?: number; offset?: number }
	) => apiClient().get(`/guilds/${guildId}/moderation/notes`, { params }),

	addModeratorNote: (guildId: string, payload: Record<string, unknown>) =>
		apiClient().post(`/guilds/${guildId}/moderation/notes`, payload),

	updateModeratorNote: (
		guildId: string,
		noteId: string,
		payload: Record<string, unknown>
	) =>
		apiClient().put(`/guilds/${guildId}/moderation/notes/${noteId}`, payload),

	deleteModeratorNote: (guildId: string, noteId: string) =>
		apiClient().delete(`/guilds/${guildId}/moderation/notes/${noteId}`),

	// Warnings
	getWarnings: (
		guildId: string,
		params?: { userId?: string; limit?: number; offset?: number }
	) => apiClient().get(`/guilds/${guildId}/moderation/warnings`, { params }),

	addWarning: (guildId: string, payload: Record<string, unknown>) =>
		apiClient().post(`/guilds/${guildId}/moderation/warnings`, payload),

	deleteWarning: (guildId: string, warningId: string) =>
		apiClient().delete(`/guilds/${guildId}/moderation/warnings/${warningId}`),

	// Auto-mod rules
	getAutomodRules: (guildId: string) =>
		apiClient().get(`/guilds/${guildId}/moderation/automod`),

	createAutomodRule: (guildId: string, payload: Record<string, unknown>) =>
		apiClient().post(`/guilds/${guildId}/moderation/automod`, payload),

	updateAutomodRule: (
		guildId: string,
		ruleId: string,
		payload: Record<string, unknown>
	) =>
		apiClient().put(`/guilds/${guildId}/moderation/automod/${ruleId}`, payload),

	deleteAutomodRule: (guildId: string, ruleId: string) =>
		apiClient().delete(`/guilds/${guildId}/moderation/automod/${ruleId}`),
};
