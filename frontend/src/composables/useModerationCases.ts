import { ref } from 'vue';
import type { AuditLogEntry } from '@/types/audit-log';
import { moderationEndpoints } from '@/lib/endpoints/moderation';
import { useGuildsStore } from '@/stores/guilds';

export function useModerationCases() {
	const moderationCases = ref<AuditLogEntry[]>([]);
	const selectedCase = ref<AuditLogEntry | null>(null);
	const guildStore = useGuildsStore();

	const fetchCases = async () => {
		if (!guildStore.currentGuild) return;
		try {
			const { data } = await moderationEndpoints.getCases(
				guildStore.currentGuild.id
			);
			// Assume API returns array of AuditLogEntry compatible objects
			moderationCases.value = data as AuditLogEntry[];
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

	return {
		moderationCases,
		selectedCase,
		fetchCases,
		openCaseModal,
		closeCaseModal,
	};
}
