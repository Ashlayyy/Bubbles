import { apiClient } from '@/lib/apiClient';

export const voiceEndpoints = {
	activity: (guildId: string, params?: { period?: string }) =>
		apiClient().get(`/guilds/${guildId}/voice/activity`, { params }),
};
