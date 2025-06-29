import { apiClient } from '@/lib/apiClient';

export const messagesEndpoints = {
	getChannels: (guildId: string) =>
		apiClient().get(`/guilds/${guildId}/messages/channels`),

	getMessages: (
		guildId: string,
		channelId: string,
		params?: { before?: string; after?: string; limit?: number }
	) => apiClient().get(`/guilds/${guildId}/messages/${channelId}`, { params }),

	sendMessage: (
		guildId: string,
		channelId: string,
		payload: Record<string, unknown>
	) => apiClient().post(`/guilds/${guildId}/messages/${channelId}`, payload),

	deleteMessage: (guildId: string, channelId: string, messageId: string) =>
		apiClient().delete(`/guilds/${guildId}/messages/${channelId}/${messageId}`),
};
