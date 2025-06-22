import { apiClient } from '@/lib/apiClient';

export const customCommandsEndpoints = {
	getCommands: (guildId: string) =>
		apiClient().get(`/guilds/${guildId}/custom-commands`),

	createCommand: (guildId: string, payload: Record<string, unknown>) =>
		apiClient().post(`/guilds/${guildId}/custom-commands`, payload),

	updateCommand: (
		guildId: string,
		commandId: string,
		payload: Record<string, unknown>
	) =>
		apiClient().put(`/guilds/${guildId}/custom-commands/${commandId}`, payload),

	deleteCommand: (guildId: string, commandId: string) =>
		apiClient().delete(`/guilds/${guildId}/custom-commands/${commandId}`),
};
