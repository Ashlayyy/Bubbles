import { ref } from 'vue';
import { useToastStore } from '@/stores/toast';
import type { BannedUser } from '@/types/moderation';
import { moderationEndpoints } from '@/lib/endpoints/moderation';
import { useGuildsStore } from '@/stores/guilds';

export function useBannedUsers() {
	const toastStore = useToastStore();
	const guildStore = useGuildsStore();

	const bannedUsers = ref<BannedUser[]>([]);

	const fetchBans = async () => {
		if (!guildStore.currentGuild) return;
		try {
			const { data } = await moderationEndpoints.getBans(
				guildStore.currentGuild.id
			);
			const payload =
				(data as { data?: Record<string, unknown> }).data ??
				(data as Record<string, unknown>);
			bannedUsers.value = Array.isArray(payload)
				? (payload as BannedUser[])
				: Array.isArray(payload.bans)
				? (payload.bans as BannedUser[])
				: [];
		} catch (e) {
			console.error('Failed to fetch bans', e);
		}
	};

	const unbanUser = async (userId: string) => {
		if (!guildStore.currentGuild) return;
		try {
			await moderationEndpoints.unbanUser(guildStore.currentGuild.id, userId);
			bannedUsers.value = bannedUsers.value.filter((b) => b.user.id !== userId);
			toastStore.addToast('User unbanned', 'success');
		} catch (e) {
			toastStore.addToast('Failed to unban user', 'error');
		}
	};

	return { bannedUsers, fetchBans, unbanUser };
}
