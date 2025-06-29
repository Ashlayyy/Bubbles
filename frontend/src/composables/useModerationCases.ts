import { ref } from 'vue';
import type { AuditLogEntry } from '@/types/audit-log';
import { moderationEndpoints } from '@/lib/endpoints/moderation';
import { useGuildsStore } from '@/stores/guilds';
import { useWsEventsStore } from '@/stores/wsEvents';

export function useModerationCases() {
	const moderationCases = ref<AuditLogEntry[]>([]);
	const selectedCase = ref<AuditLogEntry | null>(null);
	const guildStore = useGuildsStore();
	const wsBus = useWsEventsStore();

	const fetchCases = async () => {
		if (!guildStore.currentGuild) return;
		try {
			const { data } = await moderationEndpoints.getCases(
				guildStore.currentGuild.id
			);
			const payload =
				(data as { data?: Record<string, unknown> }).data ??
				(data as Record<string, unknown>);
			moderationCases.value = Array.isArray(payload)
				? (payload as AuditLogEntry[])
				: Array.isArray(payload.cases)
				? (payload.cases as AuditLogEntry[])
				: [];
		} catch (e) {
			console.error('Failed to fetch moderation cases', e);
		}
	};

	const openCaseModal = (caseEntry: AuditLogEntry) => {
		selectedCase.value = caseEntry;
	};

	const closeCaseModal = () => {
		selectedCase.value = null;
	};

	// --------------------------------------------------------------
	// Real-time refresh when new moderation events occur
	// --------------------------------------------------------------
	const refreshEvents = [
		'discord_MODERATION_MANUAL_MOD_ACTION',
		'discord_MODERATION_AUTO_MOD_ACTION',
		'discord_GUILD_BAN_ADD',
		'discord_GUILD_BAN_REMOVE',
	];

	refreshEvents.forEach((evt) => wsBus.register(evt, fetchCases));

	return {
		moderationCases,
		selectedCase,
		fetchCases,
		openCaseModal,
		closeCaseModal,
	};
}
