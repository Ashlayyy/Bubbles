import { apiClient } from '@/lib/apiClient';

export const entertainmentEndpoints = {
	getGameConfigs: (guildId: string) =>
		apiClient().get(`/guilds/${guildId}/entertainment/game-configs`),

	updateGameSettings: (guildId: string, payload: Record<string, unknown>) =>
		apiClient().put(`/guilds/${guildId}/entertainment/game-configs`, payload),

	getEconomySettings: (guildId: string) =>
		apiClient().get(`/guilds/${guildId}/entertainment/economy`),

	updateEconomySettings: (guildId: string, payload: Record<string, unknown>) =>
		apiClient().put(`/guilds/${guildId}/entertainment/economy`, payload),

	getTrivia: (guildId: string, params?: { page?: number; limit?: number }) =>
		apiClient().get(`/guilds/${guildId}/entertainment/trivia`, { params }),

	addTrivia: (guildId: string, payload: Record<string, unknown>) =>
		apiClient().post(`/guilds/${guildId}/entertainment/trivia`, payload),
};
