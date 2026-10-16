import { ref, computed, onMounted } from 'vue';
import { useGuildsStore } from '@/stores/guilds';
import { useToastStore } from '@/stores/toast';
import { ticketsEndpoints } from '@/lib/endpoints/tickets';
import type {
	Ticket,
	TicketCategory,
	TicketPanel,
	TicketSettings,
} from '@/types/tickets';

export function useTickets() {
	const guildStore = useGuildsStore();
	const toastStore = useToastStore();

	const activeTab = ref('overview');
	const allTickets = ref<Ticket[]>([]);
	const categories = ref<TicketCategory[]>([]);
	const panels = ref<TicketPanel[]>([]);
	const settings = ref<TicketSettings | null>(null);

	// Modal states
	const showCategoryModal = ref(false);
	const selectedCategory = ref<TicketCategory | null>(null);
	const showPanelModal = ref(false);
	const selectedPanel = ref<TicketPanel | null>(null);

	// Fetching data
	const fetchData = async () => {
		if (!guildStore.currentGuild) return;
		try {
			const [ticketsRes, settingsRes] = await Promise.all([
				ticketsEndpoints.getTickets(guildStore.currentGuild.id),
				ticketsEndpoints.getSettings(guildStore.currentGuild.id),
			]);
			const ticketsPayload = ticketsRes.data?.data ?? ticketsRes.data;
			allTickets.value = Array.isArray(ticketsPayload)
				? ticketsPayload
				: ticketsPayload?.tickets ?? [];
			const settingsPayload = settingsRes.data?.data ?? settingsRes.data;
			settings.value = settingsPayload;
			categories.value = settingsPayload?.categories || [];
			panels.value = settingsPayload?.panels || [];
		} catch (error) {
			console.error('Failed to fetch ticket data:', error);
			toastStore.addToast('Failed to load ticket data.', 'error');
		}
	};

	onMounted(fetchData);

	// Computed properties for ticket lists
	const openTickets = computed(() =>
		allTickets.value.filter((t) => {
			const status = String(t.status || '').toUpperCase();
			return status === 'OPEN' || status === 'PENDING' || status === 'IN_PROGRESS';
		})
	);
	const closedTickets = computed(() =>
		allTickets.value.filter((t) => String(t.status || '').toUpperCase() === 'CLOSED')
	);

	// Filtering
	const ticketSearchQuery = ref('');
	const selectedPriorityFilter = ref('');
	const selectedCategoryFilter = ref('');

	const filteredTickets = computed(() => {
		const source =
			activeTab.value === 'open' ? openTickets.value : closedTickets.value;
		return source.filter((ticket) => {
			if (!ticket) return false;
			const searchMatch =
				(ticket.subject?.toLowerCase() ?? '').includes(
					ticketSearchQuery.value.toLowerCase()
				) ||
				(ticket.username?.toLowerCase() ?? '').includes(
					ticketSearchQuery.value.toLowerCase()
				);
			const priorityMatch =
				!selectedPriorityFilter.value ||
				ticket.priority === selectedPriorityFilter.value;
			const categoryMatch =
				!selectedCategoryFilter.value ||
				ticket.categoryId === selectedCategoryFilter.value;
			return searchMatch && priorityMatch && categoryMatch;
		});
	});

	const saveAllSettings = async () => {
		if (!guildStore.currentGuild || !settings.value) return;
		try {
			const payload = {
				...settings.value,
				categories: categories.value,
				panels: panels.value,
			};
			await ticketsEndpoints.updateSettings(
				guildStore.currentGuild.id,
				payload
			);
			toastStore.addToast('Ticket settings saved!', 'success');
		} catch (error) {
			console.error('Failed to save ticket settings:', error);
			toastStore.addToast('Failed to save settings.', 'error');
		}
	};

	// Category Actions
	const editCategory = (category: TicketCategory) => {
		selectedCategory.value = JSON.parse(JSON.stringify(category));
		showCategoryModal.value = true;
	};

	const deleteCategory = (categoryId: string) => {
		categories.value = categories.value.filter((c) => c.id !== categoryId);
		// Note: saveAllSettings must be called to persist this
		toastStore.addToast('Category removed. Save settings to confirm.', 'info');
	};

	// Panel Actions
	const editPanel = (panel: TicketPanel) => {
		selectedPanel.value = JSON.parse(JSON.stringify(panel));
		showPanelModal.value = true;
	};

	const deletePanel = (panelId: string) => {
		panels.value = panels.value.filter((p) => p.id !== panelId);
		// Note: saveAllSettings must be called to persist this
		toastStore.addToast('Panel removed. Save settings to confirm.', 'info');
	};

	return {
		activeTab,
		openTickets,
		closedTickets,
		categories,
		panels,
		settings,
		ticketSearchQuery,
		selectedPriorityFilter,
		selectedCategoryFilter,
		filteredTickets,
		showCategoryModal,
		selectedCategory,
		editCategory,
		deleteCategory,
		showPanelModal,
		selectedPanel,
		editPanel,
		deletePanel,
		saveAllSettings,
	};
}
