import { apiClient } from '@/lib/apiClient';

export const welcomeEndpoints = {
	getSettings: (guildId: string) =>
		apiClient().get(`/guilds/${guildId}/welcome/settings`),

	updateSettings: (guildId: string, payload: Record<string, unknown>) =>
		apiClient().put(`/guilds/${guildId}/welcome/settings`, payload),
};
