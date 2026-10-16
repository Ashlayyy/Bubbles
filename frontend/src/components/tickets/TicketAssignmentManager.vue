<template>
	<div class="space-y-6">
		<!-- Header with quick actions -->
		<div class="flex items-center justify-between">
			<h2 class="text-xl font-semibold text-card-foreground">
				Ticket Assignment Manager
			</h2>
			<div class="flex gap-2">
				<button
					@click="showAutoAssignModal = true"
					class="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors"
				>
					Auto-Assign
				</button>
				<button
					@click="showBulkAssignModal = true"
					class="px-4 py-2 bg-green-500 text-white rounded-lg hover:bg-green-600 transition-colors"
				>
					Bulk Assign
				</button>
			</div>
		</div>

		<!-- Assignment Overview -->
		<div class="grid grid-cols-1 md:grid-cols-4 gap-4">
			<div class="bg-card border border-border rounded-xl p-4">
				<div class="flex items-center justify-between">
					<div>
						<p class="text-sm text-muted-foreground">Unassigned</p>
						<p class="text-2xl font-bold text-card-foreground">
							{{ stats.unassigned }}
						</p>
					</div>
					<div
						class="w-10 h-10 bg-red-500/20 rounded-lg flex items-center justify-center"
					>
						<svg
							xmlns="http://www.w3.org/2000/svg"
							width="20"
							height="20"
							viewBox="0 0 24 24"
							fill="none"
							stroke="currentColor"
							stroke-width="2"
							stroke-linecap="round"
							stroke-linejoin="round"
							class="text-red-400"
						>
							<circle cx="12" cy="12" r="10" />
							<path d="M12 8v4" />
							<path d="M12 16h.01" />
						</svg>
					</div>
				</div>
			</div>
			<div class="bg-card border border-border rounded-xl p-4">
				<div class="flex items-center justify-between">
					<div>
						<p class="text-sm text-muted-foreground">Assigned</p>
						<p class="text-2xl font-bold text-card-foreground">
							{{ stats.assigned }}
						</p>
					</div>
					<div
						class="w-10 h-10 bg-green-500/20 rounded-lg flex items-center justify-center"
					>
						<svg
							xmlns="http://www.w3.org/2000/svg"
							width="20"
							height="20"
							viewBox="0 0 24 24"
							fill="none"
							stroke="currentColor"
							stroke-width="2"
							stroke-linecap="round"
							stroke-linejoin="round"
							class="text-green-400"
						>
							<path d="M20 6 9 17l-5-5" />
						</svg>
					</div>
				</div>
			</div>
			<div class="bg-card border border-border rounded-xl p-4">
				<div class="flex items-center justify-between">
					<div>
						<p class="text-sm text-muted-foreground">Active Staff</p>
						<p class="text-2xl font-bold text-card-foreground">
							{{ stats.activeStaff }}
						</p>
					</div>
					<div
						class="w-10 h-10 bg-blue-500/20 rounded-lg flex items-center justify-center"
					>
						<svg
							xmlns="http://www.w3.org/2000/svg"
							width="20"
							height="20"
							viewBox="0 0 24 24"
							fill="none"
							stroke="currentColor"
							stroke-width="2"
							stroke-linecap="round"
							stroke-linejoin="round"
							class="text-blue-400"
						>
							<path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
							<circle cx="9" cy="7" r="4" />
							<path d="m22 21-3-3m0 0-3-3m3 3 3-3m-3 3-3 3" />
						</svg>
					</div>
				</div>
			</div>
			<div class="bg-card border border-border rounded-xl p-4">
				<div class="flex items-center justify-between">
					<div>
						<p class="text-sm text-muted-foreground">Avg Response</p>
						<p class="text-2xl font-bold text-card-foreground">
							{{ formatDuration(stats.avgResponseTime) }}
						</p>
					</div>
					<div
						class="w-10 h-10 bg-purple-500/20 rounded-lg flex items-center justify-center"
					>
						<svg
							xmlns="http://www.w3.org/2000/svg"
							width="20"
							height="20"
							viewBox="0 0 24 24"
							fill="none"
							stroke="currentColor"
							stroke-width="2"
							stroke-linecap="round"
							stroke-linejoin="round"
							class="text-purple-400"
						>
							<circle cx="12" cy="12" r="10" />
							<polyline points="12,6 12,12 16,14" />
						</svg>
					</div>
				</div>
			</div>
		</div>

		<!-- Staff Workload -->
		<div class="bg-card border border-border rounded-xl p-6">
			<div class="flex items-center justify-between mb-4">
				<h3 class="text-lg font-semibold text-card-foreground">
					Staff Workload
				</h3>
				<button
					@click="refreshWorkload"
					class="text-sm text-primary hover:text-primary/80"
				>
					Refresh
				</button>
			</div>
			<div class="space-y-3">
				<div v-if="workloadData.length === 0" class="text-center py-8">
					<p class="text-muted-foreground">No staff assignments found</p>
				</div>
				<div
					v-else
					v-for="staff in workloadData"
					:key="staff.staffId"
					class="flex items-center justify-between p-3 bg-muted/50 rounded-lg"
				>
					<div class="flex items-center gap-3">
						<div
							class="w-10 h-10 bg-primary/10 rounded-full flex items-center justify-center"
						>
							<span class="text-primary font-semibold">{{
								getStaffInitials(staff.staffId)
							}}</span>
						</div>
						<div>
							<p class="font-medium text-card-foreground">
								{{ getStaffName(staff.staffId) }}
							</p>
							<p class="text-sm text-muted-foreground">
								{{ staff.activeTickets }} active tickets
							</p>
						</div>
					</div>
					<div class="flex items-center gap-4">
						<div class="text-right">
							<p class="text-sm font-medium text-card-foreground">
								{{ formatDuration(staff.avgResponseTime) }}
							</p>
							<p class="text-xs text-muted-foreground">avg response</p>
						</div>
						<div class="w-20 bg-muted rounded-full h-2">
							<div
								class="bg-primary h-2 rounded-full transition-all duration-300"
								:style="{
									width: `${Math.min(
										(staff.activeTickets / maxWorkload) * 100,
										100
									)}%`,
								}"
							/>
						</div>
						<span class="text-xs text-muted-foreground w-8"
							>{{
								Math.round((staff.activeTickets / maxWorkload) * 100)
							}}%</span
						>
					</div>
				</div>
			</div>
		</div>

		<!-- Unassigned Tickets -->
		<div class="bg-card border border-border rounded-xl p-6">
			<div class="flex items-center justify-between mb-4">
				<h3 class="text-lg font-semibold text-card-foreground">
					Unassigned Tickets
				</h3>
				<div class="flex items-center gap-2">
					<button
						v-if="selectedTickets.length > 0"
						@click="showBulkAssignModal = true"
						class="px-3 py-1 text-sm bg-green-500 text-white rounded hover:bg-green-600 transition-colors"
					>
						Assign Selected ({{ selectedTickets.length }})
					</button>
					<button
						@click="selectAllUnassigned"
						class="px-3 py-1 text-sm bg-muted text-muted-foreground rounded hover:bg-muted/80 transition-colors"
					>
						Select All
					</button>
				</div>
			</div>
			<div class="space-y-3">
				<div v-if="unassignedTickets.length === 0" class="text-center py-8">
					<p class="text-muted-foreground">No unassigned tickets</p>
				</div>
				<div
					v-else
					v-for="ticket in unassignedTickets"
					:key="ticket.id"
					class="flex items-start gap-3 p-3 bg-muted/50 rounded-lg"
				>
					<input
						type="checkbox"
						:value="ticket.id"
						v-model="selectedTickets"
						class="mt-1 rounded border-border"
					/>
					<div class="flex-1">
						<div class="flex items-center gap-2 mb-1">
							<span class="font-medium text-card-foreground">{{
								ticket.title
							}}</span>
							<span
								:class="getPriorityBadge(ticket.priority)"
								class="px-2 py-1 rounded-full text-xs font-medium"
							>
								{{ ticket.priority }}
							</span>
							<span
								class="px-2 py-1 rounded-full text-xs font-medium bg-blue-500/20 text-blue-400"
							>
								{{ ticket.category }}
							</span>
						</div>
						<p class="text-sm text-muted-foreground mb-2">
							{{ ticket.description }}
						</p>
						<div class="flex items-center gap-4 text-xs text-muted-foreground">
							<span>By: {{ ticket.username }}</span>
							<span>Created: {{ formatTimeAgo(ticket.createdAt) }}</span>
							<span>Messages: {{ ticket.messageCount }}</span>
						</div>
					</div>
					<div class="flex items-center gap-2">
						<button
							@click="showAssignModal(ticket)"
							class="px-3 py-1 text-xs bg-primary text-primary-foreground rounded hover:bg-primary/90 transition-colors"
						>
							Assign
						</button>
						<button
							@click="viewTicket(ticket)"
							class="px-3 py-1 text-xs bg-muted text-muted-foreground rounded hover:bg-muted/80 transition-colors"
						>
							View
						</button>
					</div>
				</div>
			</div>
		</div>

		<!-- Single Assignment Modal -->
		<div
			v-if="showSingleAssignModal && selectedTicketForAssign"
			class="fixed inset-0 bg-black/50 flex items-center justify-center z-50"
		>
			<div
				class="bg-card border border-border rounded-xl shadow-xl max-w-md w-full mx-4"
			>
				<div class="p-6">
					<h3 class="text-lg font-semibold text-card-foreground mb-4">
						Assign Ticket
					</h3>
					<div class="space-y-4">
						<div>
							<label class="block text-sm font-medium text-card-foreground mb-2"
								>Ticket</label
							>
							<p class="text-sm text-muted-foreground">
								{{ selectedTicketForAssign.title }}
							</p>
						</div>
						<div>
							<label class="block text-sm font-medium text-card-foreground mb-2"
								>Assign to</label
							>
							<select
								v-model="assignForm.assignedTo"
								class="w-full p-2 bg-muted border border-border rounded-lg text-card-foreground"
							>
								<option value="">Select staff member</option>
								<option
									v-for="staff in availableStaff"
									:key="staff.id"
									:value="staff.id"
								>
									{{ staff.name }} ({{ staff.activeTickets }} tickets)
								</option>
							</select>
						</div>
						<div>
							<label class="block text-sm font-medium text-card-foreground mb-2"
								>Reason (optional)</label
							>
							<textarea
								v-model="assignForm.reason"
								placeholder="Add assignment reason..."
								class="w-full p-2 bg-muted border border-border rounded-lg text-card-foreground placeholder-muted-foreground resize-none"
								rows="2"
							/>
						</div>
					</div>
					<div class="flex gap-3 mt-6">
						<button
							@click="showSingleAssignModal = false"
							class="flex-1 px-4 py-2 border border-border rounded-lg text-muted-foreground hover:text-foreground transition-colors"
						>
							Cancel
						</button>
						<button
							@click="assignSingleTicket"
							:disabled="!assignForm.assignedTo || isAssigning"
							class="flex-1 px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition-colors disabled:opacity-50"
						>
							{{ isAssigning ? 'Assigning...' : 'Assign' }}
						</button>
					</div>
				</div>
			</div>
		</div>

		<!-- Bulk Assignment Modal -->
		<div
			v-if="showBulkAssignModal"
			class="fixed inset-0 bg-black/50 flex items-center justify-center z-50"
		>
			<div
				class="bg-card border border-border rounded-xl shadow-xl max-w-md w-full mx-4"
			>
				<div class="p-6">
					<h3 class="text-lg font-semibold text-card-foreground mb-4">
						Bulk Assign Tickets
					</h3>
					<div class="space-y-4">
						<div>
							<label class="block text-sm font-medium text-card-foreground mb-2"
								>Selected Tickets</label
							>
							<p class="text-sm text-muted-foreground">
								{{ selectedTickets.length }} tickets selected
							</p>
						</div>
						<div>
							<label class="block text-sm font-medium text-card-foreground mb-2"
								>Assign to</label
							>
							<select
								v-model="bulkAssignForm.assignedTo"
								class="w-full p-2 bg-muted border border-border rounded-lg text-card-foreground"
							>
								<option value="">Select staff member</option>
								<option
									v-for="staff in availableStaff"
									:key="staff.id"
									:value="staff.id"
								>
									{{ staff.name }} ({{ staff.activeTickets }} tickets)
								</option>
							</select>
						</div>
						<div>
							<label class="block text-sm font-medium text-card-foreground mb-2"
								>Reason (optional)</label
							>
							<textarea
								v-model="bulkAssignForm.reason"
								placeholder="Add assignment reason..."
								class="w-full p-2 bg-muted border border-border rounded-lg text-card-foreground placeholder-muted-foreground resize-none"
								rows="2"
							/>
						</div>
					</div>
					<div class="flex gap-3 mt-6">
						<button
							@click="showBulkAssignModal = false"
							class="flex-1 px-4 py-2 border border-border rounded-lg text-muted-foreground hover:text-foreground transition-colors"
						>
							Cancel
						</button>
						<button
							@click="bulkAssignTickets"
							:disabled="
								!bulkAssignForm.assignedTo ||
								selectedTickets.length === 0 ||
								isBulkAssigning
							"
							class="flex-1 px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition-colors disabled:opacity-50"
						>
							{{
								isBulkAssigning
									? 'Assigning...'
									: `Assign ${selectedTickets.length} Tickets`
							}}
						</button>
					</div>
				</div>
			</div>
		</div>

		<!-- Auto Assignment Modal -->
		<div
			v-if="showAutoAssignModal"
			class="fixed inset-0 bg-black/50 flex items-center justify-center z-50"
		>
			<div
				class="bg-card border border-border rounded-xl shadow-xl max-w-md w-full mx-4"
			>
				<div class="p-6">
					<h3 class="text-lg font-semibold text-card-foreground mb-4">
						Auto-Assign Tickets
					</h3>
					<div class="space-y-4">
						<div>
							<label class="block text-sm font-medium text-card-foreground mb-2"
								>Staff Members</label
							>
							<div class="space-y-2 max-h-40 overflow-y-auto">
								<label
									v-for="staff in availableStaff"
									:key="staff.id"
									class="flex items-center gap-2"
								>
									<input
										type="checkbox"
										:value="staff.id"
										v-model="autoAssignForm.staffIds"
										class="rounded border-border"
									/>
									<span class="text-sm text-card-foreground"
										>{{ staff.name }} ({{ staff.activeTickets }} tickets)</span
									>
								</label>
							</div>
						</div>
						<div>
							<label class="block text-sm font-medium text-card-foreground mb-2"
								>Max Assignments per Staff</label
							>
							<input
								v-model.number="autoAssignForm.maxAssignments"
								type="number"
								min="1"
								max="20"
								class="w-full p-2 bg-muted border border-border rounded-lg text-card-foreground"
							/>
							<p class="text-xs text-muted-foreground mt-1">
								Maximum number of tickets to assign to each staff member
							</p>
						</div>
						<div class="p-3 bg-muted/50 rounded-lg">
							<p class="text-sm text-muted-foreground">
								This will automatically distribute unassigned tickets among
								selected staff members based on their current workload.
							</p>
						</div>
					</div>
					<div class="flex gap-3 mt-6">
						<button
							@click="showAutoAssignModal = false"
							class="flex-1 px-4 py-2 border border-border rounded-lg text-muted-foreground hover:text-foreground transition-colors"
						>
							Cancel
						</button>
						<button
							@click="autoAssignTickets"
							:disabled="
								autoAssignForm.staffIds.length === 0 || isAutoAssigning
							"
							class="flex-1 px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition-colors disabled:opacity-50"
						>
							{{ isAutoAssigning ? 'Assigning...' : 'Auto-Assign' }}
						</button>
					</div>
				</div>
			</div>
		</div>
	</div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue';
import { formatDistanceToNow } from 'date-fns';
import { ticketsEndpoints } from '@/lib/endpoints/tickets';
import { useGuildsStore } from '@/stores/guilds';
import { useToastStore } from '@/stores/toast';

interface Ticket {
	id: string;
	title: string;
	description: string;
	priority: 'low' | 'medium' | 'high' | 'urgent';
	category: string;
	username: string;
	createdAt: string;
	messageCount: number;
	assignedTo?: string;
}

interface StaffMember {
	id: string;
	name: string;
	activeTickets: number;
	avgResponseTime: number;
}

interface WorkloadData {
	staffId: string;
	activeTickets: number;
	avgResponseTime: number;
}

const guildStore = useGuildsStore();
const toastStore = useToastStore();

// State
const unassignedTickets = ref<Ticket[]>([]);
const workloadData = ref<WorkloadData[]>([]);
const availableStaff = ref<StaffMember[]>([]);
const selectedTickets = ref<string[]>([]);
const selectedTicketForAssign = ref<Ticket | null>(null);

// Modals
const showSingleAssignModal = ref(false);
const showBulkAssignModal = ref(false);
const showAutoAssignModal = ref(false);

// Loading states
const isAssigning = ref(false);
const isBulkAssigning = ref(false);
const isAutoAssigning = ref(false);

// Forms
const assignForm = ref({
	assignedTo: '',
	reason: '',
});

const bulkAssignForm = ref({
	assignedTo: '',
	reason: '',
});

const autoAssignForm = ref({
	staffIds: [] as string[],
	maxAssignments: 5,
});

// Computed
const stats = computed(() => {
	const assigned = workloadData.value.reduce(
		(sum, staff) => sum + staff.activeTickets,
		0
	);
	const unassigned = unassignedTickets.value.length;
	const activeStaff = workloadData.value.filter(
		(staff) => staff.activeTickets > 0
	).length;
	const avgResponseTime =
		workloadData.value.length > 0
			? workloadData.value.reduce(
					(sum, staff) => sum + staff.avgResponseTime,
					0
			  ) / workloadData.value.length
			: 0;

	return {
		assigned,
		unassigned,
		activeStaff,
		avgResponseTime,
	};
});

const maxWorkload = computed(() => {
	return Math.max(...workloadData.value.map((staff) => staff.activeTickets), 1);
});

// Methods
const fetchData = async () => {
	if (!guildStore.currentGuild) return;

	try {
		// Fetch unassigned tickets
		const { data: ticketsData } = await ticketsEndpoints.getTickets(
			guildStore.currentGuild.id,
			{ status: 'open' }
		);
		unassignedTickets.value = (ticketsData.tickets || []).filter(
			(ticket: any) => !ticket.assignedTo
		);

		// Fetch assignment statistics
		const { data: statsData } = await ticketsEndpoints.getAssignmentStatistics(
			guildStore.currentGuild.id
		);
		workloadData.value = statsData.workloads || [];

		// Mock available staff (in real app, this would come from Discord API)
		availableStaff.value = [
			{
				id: 'staff1',
				name: 'ModeratorAlice',
				activeTickets: 3,
				avgResponseTime: 1800000,
			},
			{
				id: 'staff2',
				name: 'AdminBob',
				activeTickets: 1,
				avgResponseTime: 900000,
			},
			{
				id: 'staff3',
				name: 'HelperCharlie',
				activeTickets: 5,
				avgResponseTime: 2700000,
			},
		];
	} catch (error) {
		console.error('Failed to fetch assignment data:', error);
		toastStore.addToast('Failed to load assignment data', 'error');
	}
};

const refreshWorkload = () => {
	fetchData();
};

const selectAllUnassigned = () => {
	selectedTickets.value = unassignedTickets.value.map((ticket) => ticket.id);
};

const showAssignModal = (ticket: Ticket) => {
	selectedTicketForAssign.value = ticket;
	assignForm.value.assignedTo = '';
	assignForm.value.reason = '';
	showSingleAssignModal.value = true;
};

const assignSingleTicket = async () => {
	if (!selectedTicketForAssign.value || !guildStore.currentGuild) return;

	isAssigning.value = true;
	try {
		await ticketsEndpoints.assignTicket(
			guildStore.currentGuild.id,
			selectedTicketForAssign.value.id,
			{
				assignedTo: assignForm.value.assignedTo,
				reason: assignForm.value.reason || undefined,
			}
		);

		toastStore.addToast('Ticket assigned successfully', 'success');
		showSingleAssignModal.value = false;
		selectedTicketForAssign.value = null;
		fetchData();
	} catch (error) {
		console.error('Failed to assign ticket:', error);
		toastStore.addToast('Failed to assign ticket', 'error');
	} finally {
		isAssigning.value = false;
	}
};

const bulkAssignTickets = async () => {
	if (!guildStore.currentGuild || selectedTickets.value.length === 0) return;

	isBulkAssigning.value = true;
	try {
		await ticketsEndpoints.bulkAssignTickets(guildStore.currentGuild.id, {
			ticketIds: selectedTickets.value,
			assignedTo: bulkAssignForm.value.assignedTo,
			reason: bulkAssignForm.value.reason || undefined,
		});

		toastStore.addToast(
			`Successfully assigned ${selectedTickets.value.length} tickets`,
			'success'
		);
		showBulkAssignModal.value = false;
		selectedTickets.value = [];
		fetchData();
	} catch (error) {
		console.error('Failed to bulk assign tickets:', error);
		toastStore.addToast('Failed to bulk assign tickets', 'error');
	} finally {
		isBulkAssigning.value = false;
	}
};

const autoAssignTickets = async () => {
	if (!guildStore.currentGuild || autoAssignForm.value.staffIds.length === 0)
		return;

	isAutoAssigning.value = true;
	try {
		const { data } = await ticketsEndpoints.autoAssignTickets(
			guildStore.currentGuild.id,
			{
				staffIds: autoAssignForm.value.staffIds,
				maxAssignments: autoAssignForm.value.maxAssignments,
			}
		);

		toastStore.addToast(
			`Auto-assigned ${data.assignedCount} tickets`,
			'success'
		);
		showAutoAssignModal.value = false;
		fetchData();
	} catch (error) {
		console.error('Failed to auto-assign tickets:', error);
		toastStore.addToast('Failed to auto-assign tickets', 'error');
	} finally {
		isAutoAssigning.value = false;
	}
};

const viewTicket = (ticket: Ticket) => {
	// Navigate to ticket details view
	console.log('View ticket:', ticket.id);
};

const getStaffName = (staffId: string) => {
	const staff = availableStaff.value.find((s) => s.id === staffId);
	return staff?.name || `Staff ${staffId}`;
};

const getStaffInitials = (staffId: string) => {
	const name = getStaffName(staffId);
	return name
		.split(' ')
		.map((word) => word.charAt(0))
		.join('')
		.toUpperCase();
};

const getPriorityBadge = (priority: string) => {
	const classes = {
		urgent: 'bg-red-500/20 text-red-400',
		high: 'bg-orange-500/20 text-orange-400',
		medium: 'bg-yellow-500/20 text-yellow-400',
		low: 'bg-green-500/20 text-green-400',
	};
	return (
		classes[priority as keyof typeof classes] || 'bg-gray-500/20 text-gray-400'
	);
};

const formatTimeAgo = (date: string) => {
	return formatDistanceToNow(new Date(date), { addSuffix: true });
};

const formatDuration = (ms: number) => {
	if (ms === 0) return '0m';
	const minutes = Math.floor(ms / 60000);
	const hours = Math.floor(minutes / 60);
	const days = Math.floor(hours / 24);

	if (days > 0) return `${days}d ${hours % 24}h`;
	if (hours > 0) return `${hours}h ${minutes % 60}m`;
	return `${minutes}m`;
};

onMounted(() => {
	fetchData();
});
</script>
