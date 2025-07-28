<template>
	<div class="space-y-6">
		<!-- Header with stats -->
		<div class="grid grid-cols-1 md:grid-cols-4 gap-4">
			<div class="bg-card border border-border rounded-xl p-4">
				<div class="flex items-center justify-between">
					<div>
						<p class="text-sm text-muted-foreground">Pending Appeals</p>
						<p class="text-2xl font-bold text-card-foreground">
							{{ stats.pending }}
						</p>
					</div>
					<div
						class="w-10 h-10 bg-yellow-500/20 rounded-lg flex items-center justify-center"
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
							class="text-yellow-400"
						>
							<circle cx="12" cy="12" r="10" />
							<path d="M12 6v6l4 2" />
						</svg>
					</div>
				</div>
			</div>
			<div class="bg-card border border-border rounded-xl p-4">
				<div class="flex items-center justify-between">
					<div>
						<p class="text-sm text-muted-foreground">Approved</p>
						<p class="text-2xl font-bold text-card-foreground">
							{{ stats.approved }}
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
							<path
								d="M12 22c5.523 0 10-4.477 10-10S17.523 2 12 2 2 6.477 2 12s4.477 10 10 10z"
							/>
							<path d="m9 12 2 2 4-4" />
						</svg>
					</div>
				</div>
			</div>
			<div class="bg-card border border-border rounded-xl p-4">
				<div class="flex items-center justify-between">
					<div>
						<p class="text-sm text-muted-foreground">Denied</p>
						<p class="text-2xl font-bold text-card-foreground">
							{{ stats.denied }}
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
							<path d="m15 9-6 6" />
							<path d="m9 9 6 6" />
						</svg>
					</div>
				</div>
			</div>
			<div class="bg-card border border-border rounded-xl p-4">
				<div class="flex items-center justify-between">
					<div>
						<p class="text-sm text-muted-foreground">This Week</p>
						<p class="text-2xl font-bold text-card-foreground">
							{{ stats.thisWeek }}
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
							<path d="M8 2v4" />
							<path d="M16 2v4" />
							<rect width="18" height="18" x="3" y="4" rx="2" />
							<path d="M3 10h18" />
						</svg>
					</div>
				</div>
			</div>
		</div>

		<!-- Filters -->
		<div class="bg-card border border-border rounded-xl p-4">
			<div class="flex flex-wrap gap-4 items-center">
				<div>
					<label class="block text-sm font-medium text-card-foreground mb-1"
						>Status</label
					>
					<select
						v-model="filters.status"
						class="px-3 py-2 bg-muted border border-border rounded-lg text-card-foreground"
					>
						<option value="">All Statuses</option>
						<option value="PENDING">Pending</option>
						<option value="APPROVED">Approved</option>
						<option value="DENIED">Denied</option>
						<option value="EXPIRED">Expired</option>
					</select>
				</div>
				<div>
					<label class="block text-sm font-medium text-card-foreground mb-1"
						>Type</label
					>
					<select
						v-model="filters.type"
						class="px-3 py-2 bg-muted border border-border rounded-lg text-card-foreground"
					>
						<option value="">All Types</option>
						<option value="BAN">Ban</option>
						<option value="TIMEOUT">Timeout</option>
						<option value="KICK">Kick</option>
						<option value="WARN">Warning</option>
					</select>
				</div>
				<div>
					<label class="block text-sm font-medium text-card-foreground mb-1"
						>User ID</label
					>
					<input
						v-model="filters.userId"
						type="text"
						placeholder="Enter user ID"
						class="px-3 py-2 bg-muted border border-border rounded-lg text-card-foreground placeholder-muted-foreground"
					/>
				</div>
				<div class="flex items-end">
					<button
						@click="applyFilters"
						class="px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition-colors"
					>
						Apply Filters
					</button>
				</div>
			</div>
		</div>

		<!-- Appeals List -->
		<div class="bg-card border border-border rounded-xl">
			<div class="p-4 border-b border-border">
				<h2 class="text-lg font-semibold text-card-foreground">Appeals</h2>
			</div>
			<div class="divide-y divide-border">
				<div v-if="loading" class="p-8 text-center">
					<div
						class="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto"
					></div>
					<p class="text-muted-foreground mt-2">Loading appeals...</p>
				</div>
				<div v-else-if="appeals.length === 0" class="p-8 text-center">
					<p class="text-muted-foreground">
						No appeals found matching your criteria.
					</p>
				</div>
				<div
					v-else
					v-for="appeal in appeals"
					:key="appeal.id"
					class="p-4 hover:bg-muted/50 transition-colors"
				>
					<div class="flex items-start justify-between">
						<div class="flex-1">
							<div class="flex items-center gap-3 mb-2">
								<div
									:class="getStatusBadgeClass(appeal.status)"
									class="px-2 py-1 rounded-full text-xs font-medium"
								>
									{{ appeal.status }}
								</div>
								<div
									:class="getTypeBadgeClass(appeal.type)"
									class="px-2 py-1 rounded-full text-xs font-medium"
								>
									{{ appeal.type }}
								</div>
								<span class="text-sm text-muted-foreground">
									{{ formatTimeAgo(appeal.createdAt) }}
								</span>
							</div>
							<div class="mb-2">
								<p class="text-sm font-medium text-card-foreground">
									User ID: {{ appeal.userId }}
								</p>
								<p class="text-sm text-muted-foreground mt-1">
									{{ appeal.reason }}
								</p>
							</div>
							<div
								v-if="appeal.reviewNotes && appeal.status !== 'PENDING'"
								class="mt-2 p-2 bg-muted/50 rounded"
							>
								<p class="text-xs text-muted-foreground">Review Notes:</p>
								<p class="text-sm text-card-foreground">
									{{ appeal.reviewNotes }}
								</p>
							</div>
						</div>
						<div class="flex gap-2 ml-4">
							<button
								@click="viewAppeal(appeal)"
								class="px-3 py-1 text-xs bg-blue-500/10 text-blue-400 rounded hover:bg-blue-500/20 transition-colors"
							>
								View Details
							</button>
							<button
								v-if="appeal.status === 'PENDING'"
								@click="reviewAppeal(appeal, 'APPROVED')"
								class="px-3 py-1 text-xs bg-green-500/10 text-green-400 rounded hover:bg-green-500/20 transition-colors"
							>
								Approve
							</button>
							<button
								v-if="appeal.status === 'PENDING'"
								@click="reviewAppeal(appeal, 'DENIED')"
								class="px-3 py-1 text-xs bg-red-500/10 text-red-400 rounded hover:bg-red-500/20 transition-colors"
							>
								Deny
							</button>
						</div>
					</div>
				</div>
			</div>

			<!-- Pagination -->
			<div v-if="pagination.pages > 1" class="p-4 border-t border-border">
				<div class="flex items-center justify-between">
					<p class="text-sm text-muted-foreground">
						Showing {{ (pagination.page - 1) * pagination.limit + 1 }} to
						{{
							Math.min(pagination.page * pagination.limit, pagination.total)
						}}
						of {{ pagination.total }} appeals
					</p>
					<div class="flex gap-2">
						<button
							@click="changePage(pagination.page - 1)"
							:disabled="pagination.page <= 1"
							class="px-3 py-1 text-sm border border-border rounded hover:bg-muted transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
						>
							Previous
						</button>
						<button
							@click="changePage(pagination.page + 1)"
							:disabled="pagination.page >= pagination.pages"
							class="px-3 py-1 text-sm border border-border rounded hover:bg-muted transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
						>
							Next
						</button>
					</div>
				</div>
			</div>
		</div>

		<!-- Appeal Detail Modal -->
		<div
			v-if="selectedAppeal"
			class="fixed inset-0 bg-black/50 flex items-center justify-center z-50"
		>
			<div
				class="bg-card border border-border rounded-xl shadow-xl max-w-2xl w-full mx-4 max-h-[90vh] overflow-y-auto"
			>
				<div class="p-6">
					<div class="flex items-center justify-between mb-4">
						<h2 class="text-xl font-semibold text-card-foreground">
							Appeal Details
						</h2>
						<button
							@click="selectedAppeal = null"
							class="text-muted-foreground hover:text-foreground"
						>
							<svg
								xmlns="http://www.w3.org/2000/svg"
								width="24"
								height="24"
								viewBox="0 0 24 24"
								fill="none"
								stroke="currentColor"
								stroke-width="2"
								stroke-linecap="round"
								stroke-linejoin="round"
							>
								<path d="m18 6-12 12" />
								<path d="m6 6 12 12" />
							</svg>
						</button>
					</div>

					<div class="space-y-4">
						<div class="grid grid-cols-2 gap-4">
							<div>
								<label
									class="block text-sm font-medium text-card-foreground mb-1"
									>Status</label
								>
								<div
									:class="getStatusBadgeClass(selectedAppeal.status)"
									class="inline-block px-2 py-1 rounded-full text-xs font-medium"
								>
									{{ selectedAppeal.status }}
								</div>
							</div>
							<div>
								<label
									class="block text-sm font-medium text-card-foreground mb-1"
									>Type</label
								>
								<div
									:class="getTypeBadgeClass(selectedAppeal.type)"
									class="inline-block px-2 py-1 rounded-full text-xs font-medium"
								>
									{{ selectedAppeal.type }}
								</div>
							</div>
						</div>

						<div>
							<label class="block text-sm font-medium text-card-foreground mb-1"
								>User ID</label
							>
							<p class="text-sm text-muted-foreground">
								{{ selectedAppeal.userId }}
							</p>
						</div>

						<div>
							<label class="block text-sm font-medium text-card-foreground mb-1"
								>Reason for Appeal</label
							>
							<p class="text-sm text-muted-foreground bg-muted/50 p-3 rounded">
								{{ selectedAppeal.reason }}
							</p>
						</div>

						<div
							v-if="
								selectedAppeal.evidence && selectedAppeal.evidence.length > 0
							"
						>
							<label class="block text-sm font-medium text-card-foreground mb-1"
								>Evidence</label
							>
							<div class="space-y-2">
								<div
									v-for="(evidence, index) in selectedAppeal.evidence"
									:key="index"
									class="text-sm text-muted-foreground bg-muted/50 p-2 rounded"
								>
									{{ evidence }}
								</div>
							</div>
						</div>

						<div class="grid grid-cols-2 gap-4">
							<div>
								<label
									class="block text-sm font-medium text-card-foreground mb-1"
									>Created</label
								>
								<p class="text-sm text-muted-foreground">
									{{ formatDate(selectedAppeal.createdAt) }}
								</p>
							</div>
							<div v-if="selectedAppeal.reviewedAt">
								<label
									class="block text-sm font-medium text-card-foreground mb-1"
									>Reviewed</label
								>
								<p class="text-sm text-muted-foreground">
									{{ formatDate(selectedAppeal.reviewedAt) }}
								</p>
							</div>
						</div>

						<div v-if="selectedAppeal.reviewNotes">
							<label class="block text-sm font-medium text-card-foreground mb-1"
								>Review Notes</label
							>
							<p class="text-sm text-muted-foreground bg-muted/50 p-3 rounded">
								{{ selectedAppeal.reviewNotes }}
							</p>
						</div>

						<!-- Review Form for Pending Appeals -->
						<div
							v-if="selectedAppeal.status === 'PENDING'"
							class="border-t border-border pt-4"
						>
							<h3 class="text-lg font-medium text-card-foreground mb-4">
								Review Appeal
							</h3>
							<div class="space-y-4">
								<div>
									<label
										class="block text-sm font-medium text-card-foreground mb-2"
										>Review Notes</label
									>
									<textarea
										v-model="reviewForm.notes"
										placeholder="Add notes about your decision..."
										class="w-full p-3 bg-muted border border-border rounded-lg text-card-foreground placeholder-muted-foreground resize-none"
										rows="3"
									/>
								</div>
								<div class="flex gap-3">
									<button
										@click="submitReview('APPROVED')"
										:disabled="isSubmitting"
										class="flex-1 px-4 py-2 bg-green-500 text-white rounded-lg hover:bg-green-600 transition-colors disabled:opacity-50"
									>
										{{ isSubmitting ? 'Processing...' : 'Approve Appeal' }}
									</button>
									<button
										@click="submitReview('DENIED')"
										:disabled="isSubmitting"
										class="flex-1 px-4 py-2 bg-red-500 text-white rounded-lg hover:bg-red-600 transition-colors disabled:opacity-50"
									>
										{{ isSubmitting ? 'Processing...' : 'Deny Appeal' }}
									</button>
								</div>
							</div>
						</div>
					</div>
				</div>
			</div>
		</div>
	</div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue';
import { formatDistanceToNow, format } from 'date-fns';
import { appealsEndpoints } from '@/lib/endpoints/appeals';
import { useGuildsStore } from '@/stores/guilds';
import { useToastStore } from '@/stores/toast';

interface Appeal {
	id: string;
	userId: string;
	type: 'BAN' | 'TIMEOUT' | 'KICK' | 'WARN';
	reason: string;
	status: 'PENDING' | 'APPROVED' | 'DENIED' | 'EXPIRED';
	reviewedBy?: string;
	reviewNotes?: string;
	evidence?: string[];
	createdAt: string;
	updatedAt: string;
	reviewedAt?: string;
}

const guildStore = useGuildsStore();
const toastStore = useToastStore();

// State
const appeals = ref<Appeal[]>([]);
const loading = ref(true);
const selectedAppeal = ref<Appeal | null>(null);
const isSubmitting = ref(false);

// Filters
const filters = ref({
	status: '',
	type: '',
	userId: '',
});

// Pagination
const pagination = ref({
	page: 1,
	limit: 20,
	total: 0,
	pages: 1,
});

// Review form
const reviewForm = ref({
	notes: '',
});

// Stats
const stats = computed(() => {
	const pending = appeals.value.filter((a) => a.status === 'PENDING').length;
	const approved = appeals.value.filter((a) => a.status === 'APPROVED').length;
	const denied = appeals.value.filter((a) => a.status === 'DENIED').length;

	const weekAgo = new Date();
	weekAgo.setDate(weekAgo.getDate() - 7);
	const thisWeek = appeals.value.filter(
		(a) => new Date(a.createdAt) >= weekAgo
	).length;

	return { pending, approved, denied, thisWeek };
});

// Methods
const fetchAppeals = async () => {
	if (!guildStore.currentGuild) return;

	loading.value = true;
	try {
		const params: any = {
			page: pagination.value.page,
			limit: pagination.value.limit,
		};

		if (filters.value.status) params.status = filters.value.status;
		if (filters.value.type) params.type = filters.value.type;
		if (filters.value.userId) params.userId = filters.value.userId;

		const { data } = await appealsEndpoints.getAppeals(
			guildStore.currentGuild.id,
			params
		);

		appeals.value = data.appeals || [];
		pagination.value = {
			...pagination.value,
			...data.pagination,
		};
	} catch (error) {
		console.error('Failed to fetch appeals:', error);
		toastStore.addToast('Failed to fetch appeals', 'error');
	} finally {
		loading.value = false;
	}
};

const applyFilters = () => {
	pagination.value.page = 1;
	fetchAppeals();
};

const changePage = (page: number) => {
	pagination.value.page = page;
	fetchAppeals();
};

const viewAppeal = (appeal: Appeal) => {
	selectedAppeal.value = appeal;
	reviewForm.value.notes = '';
};

const reviewAppeal = async (appeal: Appeal, status: 'APPROVED' | 'DENIED') => {
	selectedAppeal.value = appeal;
	reviewForm.value.notes = '';
	await submitReview(status);
};

const submitReview = async (status: 'APPROVED' | 'DENIED') => {
	if (!selectedAppeal.value || !guildStore.currentGuild) return;

	isSubmitting.value = true;
	try {
		await appealsEndpoints.updateStatus(
			guildStore.currentGuild.id,
			selectedAppeal.value.id,
			{
				status,
				reviewNotes: reviewForm.value.notes || undefined,
			}
		);

		toastStore.addToast(
			`Appeal ${status.toLowerCase()} successfully`,
			'success'
		);

		selectedAppeal.value = null;
		fetchAppeals();
	} catch (error) {
		console.error('Failed to review appeal:', error);
		toastStore.addToast('Failed to review appeal', 'error');
	} finally {
		isSubmitting.value = false;
	}
};

const getStatusBadgeClass = (status: string) => {
	const classes = {
		PENDING: 'bg-yellow-500/20 text-yellow-400',
		APPROVED: 'bg-green-500/20 text-green-400',
		DENIED: 'bg-red-500/20 text-red-400',
		EXPIRED: 'bg-gray-500/20 text-gray-400',
	};
	return (
		classes[status as keyof typeof classes] || 'bg-gray-500/20 text-gray-400'
	);
};

const getTypeBadgeClass = (type: string) => {
	const classes = {
		BAN: 'bg-red-500/20 text-red-400',
		TIMEOUT: 'bg-orange-500/20 text-orange-400',
		KICK: 'bg-yellow-500/20 text-yellow-400',
		WARN: 'bg-blue-500/20 text-blue-400',
	};
	return (
		classes[type as keyof typeof classes] || 'bg-gray-500/20 text-gray-400'
	);
};

const formatTimeAgo = (date: string) => {
	return formatDistanceToNow(new Date(date), { addSuffix: true });
};

const formatDate = (date: string) => {
	return format(new Date(date), 'MMM d, yyyy h:mm a');
};

onMounted(() => {
	fetchAppeals();
});
</script>
