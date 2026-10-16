import { ref, onMounted } from 'vue';
import { useGuildsStore } from '@/stores/guilds';
import { useToastStore } from '@/stores/toast';
import { reactionRolesEndpoints } from '@/lib/endpoints/reactionRoles';
import type { ReactionRoleMessage } from '@/types/reaction-roles';

export function useReactionRoles() {
	const guildStore = useGuildsStore();
	const toastStore = useToastStore();
	const reactionRoleMessages = ref<ReactionRoleMessage[]>([]);
	const isModalOpen = ref(false);
	const selectedMessage = ref<ReactionRoleMessage | null>(null);

	const fetchReactionRoles = async () => {
		if (!guildStore.currentGuild) return;
		try {
			const { data } = await reactionRolesEndpoints.getReactionRoles(
				guildStore.currentGuild.id
			);
			reactionRoleMessages.value = data;
		} catch (error) {
			console.error('Failed to fetch reaction roles:', error);
			toastStore.addToast('Failed to load reaction roles.', 'error');
		}
	};

	onMounted(fetchReactionRoles);

	const openCreateModal = () => {
		selectedMessage.value = null;
		isModalOpen.value = true;
	};

	const openEditModal = (message: ReactionRoleMessage) => {
		selectedMessage.value = JSON.parse(JSON.stringify(message));
		isModalOpen.value = true;
	};

	const closeModal = () => {
		isModalOpen.value = false;
		selectedMessage.value = null;
	};

	const deleteMessage = async (messageId: string) => {
		if (!guildStore.currentGuild) return;
		if (
			confirm('Are you sure you want to delete this reaction role message?')
		) {
			try {
				await reactionRolesEndpoints.deleteReactionRole(
					guildStore.currentGuild.id,
					messageId
				);
				await fetchReactionRoles();
				toastStore.addToast(
					'Reaction role message deleted successfully!',
					'success'
				);
			} catch (error) {
				console.error('Failed to delete reaction role:', error);
				toastStore.addToast('Failed to delete reaction role.', 'error');
			}
		}
	};

	const saveMessage = async (messageData: ReactionRoleMessage) => {
		if (!guildStore.currentGuild) return;
		try {
			if (messageData.id) {
				// Update
				await reactionRolesEndpoints.updateReactionRole(
					guildStore.currentGuild.id,
					messageData.id,
					messageData
				);
			} else {
				// Create
				await reactionRolesEndpoints.createReactionRole(
					guildStore.currentGuild.id,
					messageData
				);
			}
			await fetchReactionRoles();
			toastStore.addToast('Reaction role saved successfully!', 'success');
			closeModal();
		} catch (error) {
			console.error('Failed to save reaction role:', error);
			toastStore.addToast('Failed to save reaction role.', 'error');
		}
	};

	return {
		reactionRoleMessages,
		isModalOpen,
		selectedMessage,
		openCreateModal,
		openEditModal,
		closeModal,
		deleteMessage,
		saveMessage,
	};
}
