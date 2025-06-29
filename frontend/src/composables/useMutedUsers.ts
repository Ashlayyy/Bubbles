import { ref } from 'vue';
import { useToastStore } from '@/stores/toast';
import type { MutedUser } from '@/types/moderation';
import { moderationEndpoints } from '@/lib/endpoints/moderation';
import { useGuildsStore } from '@/stores/guilds';

export function useMutedUsers() {
	const toastStore = useToastStore();
	const guildStore = useGuildsStore();

	const mutedUsers = ref<MutedUser[]>([]);

	const fetchMutes = async () => {
		if (!guildStore.currentGuild) return;
		try {
			const { data } = await moderationEndpoints.getMutes(
				guildStore.currentGuild.id
			);
			const payload =
				(data as { data?: Record<string, unknown> }).data ??
				(data as Record<string, unknown>);
			mutedUsers.value = Array.isArray(payload)
				? (payload as MutedUser[])
				: Array.isArray(payload.mutes)
				? (payload.mutes as MutedUser[])
				: [];
		} catch (e) {
			console.error('Failed to fetch mutes', e);
		}
	};

	const unmuteUser = async (userId: string) => {
		if (!guildStore.currentGuild) return;
		try {
			await moderationEndpoints.unmuteUser(guildStore.currentGuild.id, userId);
			mutedUsers.value = mutedUsers.value.filter((m) => m.user.id !== userId);
			toastStore.addToast('User unmuted', 'success');
		} catch (e) {
			toastStore.addToast('Failed to unmute user', 'error');
		}
	};

	return { mutedUsers, fetchMutes, unmuteUser };
}
