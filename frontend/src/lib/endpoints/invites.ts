import { apiClient } from '@/lib/apiClient';

export const invitesEndpoints = {
	getGuildInvites: (guildId: string) =>
		apiClient().get(`/guilds/${guildId}/invites`),

	createInvite: (guildId: string, payload: Record<string, unknown>) =>
		apiClient().post(`/guilds/${guildId}/invites`, payload),

	deleteInvite: (guildId: string, inviteCode: string) =>
		apiClient().delete(`/guilds/${guildId}/invites/${inviteCode}`),

	analytics: (guildId: string, params?: { period?: string }) =>
		apiClient().get(`/guilds/${guildId}/invites/analytics`, { params }),

	bulkDelete: (guildId: string, payload: { inviteCodes: string[] }) =>
		apiClient().post(`/guilds/${guildId}/invites/bulk-delete`, payload),

	purgeExpired: (guildId: string) =>
		apiClient().post(`/guilds/${guildId}/invites/purge-expired`),
};
