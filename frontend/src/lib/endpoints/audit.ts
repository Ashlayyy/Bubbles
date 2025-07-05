import { apiClient } from '@/lib/apiClient';

export const auditEndpoints = {
	getLogs: (
		guildId: string,
		params?: {
			user_id?: string;
			action_type?: number;
			before?: string;
			after?: string;
			limit?: number;
		}
	) => apiClient().get(`/guilds/${guildId}/audit/logs`, { params }),

	analytics: (guildId: string, params?: { days?: string }) =>
		apiClient().get(`/guilds/${guildId}/audit/analytics`, { params }),

	logsByUser: (
		guildId: string,
		userId: string,
		params?: { limit?: number; action_type?: number }
	) => apiClient().get(`/guilds/${guildId}/audit/users/${userId}`, { params }),

	logsByAction: (
		guildId: string,
		actionType: number,
		params?: { limit?: number; user_id?: string }
	) =>
		apiClient().get(`/guilds/${guildId}/audit/actions/${actionType}`, {
			params,
		}),

	securityAlerts: (guildId: string, params?: { hours?: string }) =>
		apiClient().get(`/guilds/${guildId}/audit/security`, { params }),

	moderationHistory: (
		guildId: string,
		params?: { target_user_id?: string; moderator_id?: string; limit?: number }
	) => apiClient().get(`/guilds/${guildId}/audit/moderation`, { params }),
};
