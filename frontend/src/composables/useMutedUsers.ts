import { ref } from 'vue';
import { useToastStore } from '@/stores/toast';
import type { MutedUser } from '@/types/moderation';
import { moderationApi } from '@/lib/endpoints';
import { useGuildsStore } from '@/stores/guilds';

export function useMutedUsers() {
	const toastStore = useToastStore();
	const guildStore = useGuildsStore();

	const mutedUsers = ref<MutedUser[]>([]);

	const fetchMutes = async () => {
		if (!guildStore.currentGuild) return;
		try {
			const { data } = await moderationApi.getMutes(guildStore.currentGuild.id);
			mutedUsers.value = data as MutedUser[];
		} catch (e) {
			console.error('Failed to fetch mutes', e);
		}
	};

	const unmuteUser = async (userId: string) => {
		if (!guildStore.currentGuild) return;
		try {
			await moderationApi.unmuteUser(guildStore.currentGuild.id, userId);
			mutedUsers.value = mutedUsers.value.filter((m) => m.user.id !== userId);
			toastStore.addToast('User unmuted', 'success');
		} catch (e) {
			toastStore.addToast('Failed to unmute user', 'error');
		}
	};

	return { mutedUsers, fetchMutes, unmuteUser };
}
