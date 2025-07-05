import { apiClient } from '@/lib/apiClient';

export const reactionRolesEndpoints = {
	getReactionRoles: (guildId: string) =>
		apiClient().get(`/guilds/${guildId}/reaction-roles`),

	createReactionRole: (guildId: string, payload: Record<string, unknown>) =>
		apiClient().post(`/guilds/${guildId}/reaction-roles`, payload),

	updateReactionRole: (
		guildId: string,
		reactionRoleId: string,
		payload: Record<string, unknown>
	) =>
		apiClient().put(
			`/guilds/${guildId}/reaction-roles/${reactionRoleId}`,
			payload
		),

	deleteReactionRole: (guildId: string, reactionRoleId: string) =>
		apiClient().delete(`/guilds/${guildId}/reaction-roles/${reactionRoleId}`),
};
