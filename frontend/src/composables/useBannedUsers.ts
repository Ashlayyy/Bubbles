import { ref } from 'vue';
import { useToastStore } from '@/stores/toast';
import type { BannedUser } from '@/types/moderation';
import { moderationEndpoints } from '@/lib/endpoints/moderation';
import { useGuildsStore } from '@/stores/guilds';
import { useWsEventsStore } from '@/stores/wsEvents';
import type { AuditLogUser } from '@/types/audit-log';

interface BanPayload {
	guild_id: string;
	user: AuditLogUser;
	reason?: string;
	moderator?: AuditLogUser;
	banned_until?: string | number | Date | null;
}

export function useBannedUsers() {
	const toastStore = useToastStore();
	const guildStore = useGuildsStore();
	const wsBus = useWsEventsStore();

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

	function onBanAdd(payloadRaw: Record<string, unknown>) {
		const payload = payloadRaw as unknown as BanPayload;
		if (!guildStore.currentGuild) return;
		if (payload.guild_id !== guildStore.currentGuild.id) return;

		const entry: BannedUser = {
			user: payload.user,
			moderator: payload.moderator ?? { id: '0', name: 'Unknown' },
			reason: payload.reason ?? 'N/A',
			bannedUntil: payload.banned_until
				? new Date(payload.banned_until as string | number | Date)
				: null,
		} as BannedUser;

		if (!bannedUsers.value.find((b) => b.user.id === entry.user.id)) {
			bannedUsers.value.push(entry);
		}
	}

	function onBanRemove(payloadRaw: Record<string, unknown>) {
		const payload = payloadRaw as unknown as BanPayload;
		if (!guildStore.currentGuild) return;
		if (payload.guild_id !== guildStore.currentGuild.id) return;
		bannedUsers.value = bannedUsers.value.filter(
			(b) => b.user.id !== payload.user.id
		);
	}

	wsBus.register('discord_GUILD_BAN_ADD', onBanAdd);
	wsBus.register('discord_GUILD_BAN_REMOVE', onBanRemove);

	return { bannedUsers, fetchBans, unbanUser };
}
