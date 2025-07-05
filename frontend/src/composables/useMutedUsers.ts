import { ref } from 'vue';
import { useToastStore } from '@/stores/toast';
import type { MutedUser } from '@/types/moderation';
import { moderationEndpoints } from '@/lib/endpoints/moderation';
import { useGuildsStore } from '@/stores/guilds';
import { useWsEventsStore } from '@/stores/wsEvents';
import type { AuditLogUser } from '@/types/audit-log';

interface MemberUpdatePayload {
	guild_id: string;
	user: AuditLogUser;
	communication_disabled_until?: string | null;
}

export function useMutedUsers() {
	const toastStore = useToastStore();
	const guildStore = useGuildsStore();
	const wsBus = useWsEventsStore();

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

	// --------------------------------------------------------------------
	// Real-time updates via WebSocket (member timeouts/unmutes)
	// --------------------------------------------------------------------

	function onMemberUpdate(payloadRaw: Record<string, unknown>) {
		const payload = payloadRaw as unknown as MemberUpdatePayload;
		if (!guildStore.currentGuild) return;
		if (payload.guild_id !== guildStore.currentGuild.id) return;

		const isMuted = Boolean(payload.communication_disabled_until);

		const existingIndex = mutedUsers.value.findIndex(
			(m) => m.user.id === payload.user.id
		);

		if (isMuted) {
			// Add or update
			const until = new Date(payload.communication_disabled_until as string);
			const entry = {
				user: payload.user,
				mutedUntil: until,
				reason: 'Timeout',
				moderator: { id: '0', name: 'System' },
			} as MutedUser;

			if (existingIndex === -1) mutedUsers.value.push(entry);
			else mutedUsers.value[existingIndex] = entry;
		} else {
			// Remove if present
			if (existingIndex !== -1) mutedUsers.value.splice(existingIndex, 1);
		}
	}

	wsBus.register('discord_GUILD_MEMBER_UPDATE', onMemberUpdate);

	return { mutedUsers, fetchMutes, unmuteUser };
}
