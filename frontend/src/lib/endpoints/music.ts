import { apiClient } from '@/lib/apiClient';

export const musicEndpoints = {
	status: (guildId: string) =>
		apiClient().get(`/guilds/${guildId}/music/status`),

	play: (guildId: string, payload: { query: string }) =>
		apiClient().post(`/guilds/${guildId}/music/play`, payload),

	pause: (guildId: string) =>
		apiClient().post(`/guilds/${guildId}/music/pause`),
	resume: (guildId: string) =>
		apiClient().post(`/guilds/${guildId}/music/resume`),
	skip: (guildId: string) => apiClient().post(`/guilds/${guildId}/music/skip`),
	stop: (guildId: string) => apiClient().post(`/guilds/${guildId}/music/stop`),

	queue: (guildId: string) => apiClient().get(`/guilds/${guildId}/music/queue`),
	clearQueue: (guildId: string) =>
		apiClient().delete(`/guilds/${guildId}/music/queue`),

	setVolume: (guildId: string, volume: number) =>
		apiClient().post(`/guilds/${guildId}/music/volume`, { volume }),
};
