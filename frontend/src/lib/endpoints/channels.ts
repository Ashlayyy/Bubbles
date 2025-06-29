import { apiClient } from '@/lib/apiClient';

export const channelsEndpoints = {
	getChannels: (guildId: string) =>
		apiClient().get(`/guilds/${guildId}/channels`),

	getChannel: (guildId: string, channelId: string) =>
		apiClient().get(`/guilds/${guildId}/channels/${channelId}`),

	createChannel: (guildId: string, payload: Record<string, unknown>) =>
		apiClient().post(`/guilds/${guildId}/channels`, payload),

	modifyChannel: (
		guildId: string,
		channelId: string,
		payload: Record<string, unknown>
	) => apiClient().put(`/guilds/${guildId}/channels/${channelId}`, payload),

	deleteChannel: (guildId: string, channelId: string) =>
		apiClient().delete(`/guilds/${guildId}/channels/${channelId}`),

	// Invites
	getInvites: (guildId: string, channelId: string) =>
		apiClient().get(`/guilds/${guildId}/channels/${channelId}/invites`),

	createInvite: (
		guildId: string,
		channelId: string,
		payload: Record<string, unknown>
	) =>
		apiClient().post(
			`/guilds/${guildId}/channels/${channelId}/invites`,
			payload
		),
};
