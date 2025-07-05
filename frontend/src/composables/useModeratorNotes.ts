import { ref } from 'vue';
import { useToastStore } from '@/stores/toast';
import { useGuildsStore } from '@/stores/guilds';
import type { ModeratorNote } from '@/types/moderation';
import { moderationEndpoints } from '@/lib/endpoints/moderation';

export function useModeratorNotes() {
	const toastStore = useToastStore();
	const guildStore = useGuildsStore();

	// Map keyed by userId -> array of notes
	const moderatorNotes = ref<Map<string, ModeratorNote[]>>(new Map());

	/**
	 * Fetch notes for a specific user (or all if no userId provided)
	 */
	const fetchNotes = async (userId?: string) => {
		if (!guildStore.currentGuild) return;
		try {
			const { data } = await moderationEndpoints.getModeratorNotes(
				guildStore.currentGuild.id,
				userId ? { userId } : undefined
			);
			// Expected payload: { notes: ModeratorNote[] } | ModeratorNote[]
			const payload = (data as { data?: unknown }).data ?? data;
			const notesArr: ModeratorNote[] = parseNotesPayload(payload);

			if (userId) {
				moderatorNotes.value.set(userId, notesArr);
			} else {
				// If no userId filter, rebuild entire map by grouping
				const grouped = new Map<string, ModeratorNote[]>();
				for (const n of notesArr) {
					if (!grouped.has(n.moderator.id)) grouped.set(n.moderator.id, []);
					grouped.get(n.moderator.id)!.push(n);
				}
				moderatorNotes.value = grouped;
			}
		} catch (e) {
			console.error('Failed to fetch moderator notes', e);
		}
	};

	const addNote = async (userId: string, content: string) => {
		if (!guildStore.currentGuild) return;
		try {
			await moderationEndpoints.addModeratorNote(guildStore.currentGuild.id, {
				userId,
				content,
			});

			// Refresh notes for this user
			await fetchNotes(userId);

			toastStore.addToast('Note added', 'success');
		} catch (e) {
			console.error('Failed to add note', e);
			toastStore.addToast('Failed to add note', 'error');
		}
	};

	return { moderatorNotes, fetchNotes, addNote };
}

// ----------- helpers -------------
function isModeratorNoteArray(obj: unknown): obj is ModeratorNote[] {
	return (
		Array.isArray(obj) &&
		obj.every(
			(n) =>
				n &&
				typeof n === 'object' &&
				'id' in n &&
				'moderator' in n &&
				'content' in n &&
				'timestamp' in n
		)
	);
}

function parseNotesPayload(payload: unknown): ModeratorNote[] {
	if (isModeratorNoteArray(payload)) return payload;
	if (
		payload &&
		typeof payload === 'object' &&
		'notes' in payload &&
		isModeratorNoteArray((payload as { notes: unknown }).notes)
	) {
		return (payload as { notes: ModeratorNote[] }).notes;
	}
	return [];
}
