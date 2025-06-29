import { ref } from 'vue';
import { useToastStore } from '@/stores/toast';
import { useGuildsStore } from '@/stores/guilds';
import { moderationEndpoints } from '@/lib/endpoints/moderation';

export interface Warning {
	id: string;
	userId: string;
	moderatorId: string;
	reason: string;
	timestamp: Date;
}

export function useWarnings() {
	const warnings = ref<Warning[]>([]);
	const toastStore = useToastStore();
	const guildStore = useGuildsStore();

	const fetchWarnings = async (userId?: string) => {
		if (!guildStore.currentGuild) return;
		try {
			const { data } = await moderationEndpoints.getWarnings(
				guildStore.currentGuild.id,
				userId ? { userId } : undefined
			);
			const payload = (data as { data?: unknown }).data ?? data;
			warnings.value = parseWarningsPayload(payload);
		} catch (e) {
			console.error('Failed to fetch warnings', e);
		}
	};

	const addWarning = async (userId: string, reason: string) => {
		if (!guildStore.currentGuild) return;
		try {
			await moderationEndpoints.addWarning(guildStore.currentGuild.id, {
				userId,
				reason,
			});
			await fetchWarnings(userId);
			toastStore.addToast('Warning issued', 'success');
		} catch (e) {
			console.error('Failed to add warning', e);
			toastStore.addToast('Failed to add warning', 'error');
		}
	};

	const deleteWarning = async (warningId: string) => {
		if (!guildStore.currentGuild) return;
		try {
			await moderationEndpoints.deleteWarning(
				guildStore.currentGuild.id,
				warningId
			);
			warnings.value = warnings.value.filter((w) => w.id !== warningId);
			toastStore.addToast('Warning removed', 'success');
		} catch (e) {
			console.error('Failed to delete warning', e);
			toastStore.addToast('Failed to delete warning', 'error');
		}
	};

	return { warnings, fetchWarnings, addWarning, deleteWarning };
}

// ---------- helpers ----------
function isWarningArray(obj: unknown): obj is Warning[] {
	return (
		Array.isArray(obj) &&
		obj.every(
			(w) =>
				w &&
				typeof w === 'object' &&
				'id' in w &&
				'userId' in w &&
				'reason' in w &&
				'timestamp' in w
		)
	);
}

function parseWarningsPayload(payload: unknown): Warning[] {
	if (isWarningArray(payload)) return payload;
	if (
		payload &&
		typeof payload === 'object' &&
		'warnings' in payload &&
		isWarningArray((payload as { warnings: unknown }).warnings)
	) {
		return (payload as { warnings: Warning[] }).warnings;
	}
	return [];
}
