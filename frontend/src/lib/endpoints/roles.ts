import { apiClient } from '@/lib/apiClient';

export const rolesEndpoints = {
	getRoles: (guildId: string) => apiClient().get(`/guilds/${guildId}/roles`),

	getRole: (guildId: string, roleId: string) =>
		apiClient().get(`/guilds/${guildId}/roles/${roleId}`),

	createRole: (guildId: string, payload: Record<string, unknown>) =>
		apiClient().post(`/guilds/${guildId}/roles`, payload),

	updateRole: (
		guildId: string,
		roleId: string,
		payload: Record<string, unknown>
	) => apiClient().put(`/guilds/${guildId}/roles/${roleId}`, payload),

	deleteRole: (guildId: string, roleId: string) =>
		apiClient().delete(`/guilds/${guildId}/roles/${roleId}`),

	assignRole: (guildId: string, roleId: string, userId: string) =>
		apiClient().post(`/guilds/${guildId}/roles/${roleId}/assign`, { userId }),

	removeRole: (guildId: string, roleId: string, userId: string) =>
		apiClient().post(`/guilds/${guildId}/roles/${roleId}/remove`, { userId }),
};
