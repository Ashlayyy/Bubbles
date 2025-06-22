import { apiClient } from '@/lib/apiClient';

export const levelingEndpoints = {
	getSettings: (guildId: string) =>
		apiClient().get(`/guilds/${guildId}/leveling/settings`),

	updateSettings: (guildId: string, payload: Record<string, unknown>) =>
		apiClient().put(`/guilds/${guildId}/leveling/settings`, payload),

	getLeaderboard: (guildId: string) =>
		apiClient().get(`/guilds/${guildId}/leveling/leaderboard`),

	getLevelRewards: (guildId: string) =>
		apiClient().get(`/guilds/${guildId}/leveling/rewards`),

	addLevelReward: (guildId: string, payload: Record<string, unknown>) =>
		apiClient().post(`/guilds/${guildId}/leveling/rewards`, payload),

	removeLevelReward: (guildId: string, rewardId: string) =>
		apiClient().delete(`/guilds/${guildId}/leveling/rewards/${rewardId}`),
};
