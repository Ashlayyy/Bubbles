<template>
	<div>
		<h1 class="text-3xl font-bold text-foreground mb-6">Moderation</h1>

		<!-- Tabs -->
		<div class="mb-6 border-b border-border">
			<nav class="-mb-px flex space-x-6">
				<button
					@click="activeTab = 'overview'"
					:class="[
						'py-3 px-1 border-b-2 font-medium text-sm transition-colors',
						activeTab === 'overview'
							? 'border-primary text-primary'
							: 'border-transparent text-muted-foreground hover:text-foreground hover:border-muted-foreground',
					]"
				>
					Overview
				</button>
				<button
					@click="activeTab = 'users'"
					:class="[
						'py-3 px-1 border-b-2 font-medium text-sm transition-colors',
						activeTab === 'users'
							? 'border-primary text-primary'
							: 'border-transparent text-muted-foreground hover:text-foreground hover:border-muted-foreground',
					]"
				>
					Users
				</button>
				<button
					@click="activeTab = 'cases'"
					:class="[
						'py-3 px-1 border-b-2 font-medium text-sm transition-colors',
						activeTab === 'cases'
							? 'border-primary text-primary'
							: 'border-transparent text-muted-foreground hover:text-foreground hover:border-muted-foreground',
					]"
				>
					Cases
				</button>
				<button
					@click="activeTab = 'leaderboard'"
					:class="[
						'py-3 px-1 border-b-2 font-medium text-sm transition-colors',
						activeTab === 'leaderboard'
							? 'border-primary text-primary'
							: 'border-transparent text-muted-foreground hover:text-foreground hover:border-muted-foreground',
					]"
				>
					Leaderboard
				</button>
				<button
					@click="activeTab = 'muted'"
					:class="[
						'py-3 px-1 border-b-2 font-medium text-sm transition-colors',
						activeTab === 'muted'
							? 'border-primary text-primary'
							: 'border-transparent text-muted-foreground hover:text-foreground hover:border-muted-foreground',
					]"
				>
					Muted
				</button>
				<button
					@click="activeTab = 'banned'"
					:class="[
						'py-3 px-1 border-b-2 font-medium text-sm transition-colors',
						activeTab === 'banned'
							? 'border-primary text-primary'
							: 'border-transparent text-muted-foreground hover:text-foreground hover:border-muted-foreground',
					]"
				>
					Banned
				</button>
				<button
					@click="activeTab = 'automod'"
					:class="[
						'py-3 px-1 border-b-2 font-medium text-sm transition-colors',
						activeTab === 'automod'
							? 'border-primary text-primary'
							: 'border-transparent text-muted-foreground hover:text-foreground hover:border-muted-foreground',
					]"
				>
					Auto-Moderation
				</button>
				<button
					@click="activeTab = 'general'"
					:class="[
						'py-3 px-1 border-b-2 font-medium text-sm transition-colors',
						activeTab === 'general'
							? 'border-primary text-primary'
							: 'border-transparent text-muted-foreground hover:text-foreground hover:border-muted-foreground',
					]"
				>
					General
				</button>
			</nav>
		</div>

		<div class="max-w-4xl space-y-8">
			<ModerationOverview
				v-if="activeTab === 'overview'"
				:stats="enhancedModerationStats"
				:mod-actions-chart-data="modActionsChartData"
				@open-bulk-action="openBulkActionModal"
				@open-audit-log="$router.push('/audit-log')"
				@view-case="viewCase"
			/>
			<Users
				v-if="activeTab === 'users'"
				:users="allUsers"
				@user-selected="openUserHistoryModal"
			/>
			<ModerationCases
				v-if="activeTab === 'cases'"
				:cases="moderationCases"
				@case-selected="openCaseModal"
				@user-selected="openUserHistoryModal"
			/>
			<ModeratorLeaderboard
				v-if="activeTab === 'leaderboard'"
				:leaderboard-data="moderatorLeaderboardData"
				@user-selected="openUserHistoryModal"
			/>
			<MutedMembers
				v-if="activeTab === 'muted'"
				:muted-users="mutedUsers"
				@user-selected="openUserHistoryModal"
				@unmute-user="unmuteUser"
			/>
			<BannedMembers
				v-if="activeTab === 'banned'"
				:banned-users="bannedUsers"
				@user-selected="openUserHistoryModal"
				@unban-user="unbanUser"
			/>
			<AutoModSettings
				v-if="activeTab === 'automod'"
				v-model="automod"
				:roles="roles"
				@save="saveChanges"
			/>
			<GeneralSettings
				v-if="activeTab === 'general'"
				v-model="maxMessagesCleared"
				@save="saveChanges"
			/>
		</div>

		<AuditLogDetailModal
			:is-open="!!selectedCase"
			:log="selectedCase"
			@close="closeCaseModal"
		/>
		<UserModHistoryModal
			:is-open="!!selectedUserForHistory"
			:user="selectedUserForHistory"
			:history="userAuditLog"
			:notes="userNotes"
			@close="closeUserHistoryModal"
			@action="performModerationAction"
			@add-note="addModeratorNote"
		/>
		<ModerationActionModal
			:is-open="isActionModalOpen"
			:action-info="actionInfo"
			@close="closeActionModal"
			@submit="confirmModerationAction"
		/>
		<BulkActionModal
			:is-open="isBulkActionModalOpen"
			:action-type="bulkActionType"
			@close="closeBulkActionModal"
			@submit="handleBulkAction"
		/>
	</div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue';
import { useRouter } from 'vue-router';
import GeneralSettings from '@/components/moderation/GeneralSettings.vue';
import AutoModSettings from '@/components/moderation/AutoModSettings.vue';
import ModerationCases from '@/components/moderation/ModerationCases.vue';
import MutedMembers from '@/components/moderation/MutedMembers.vue';
import BannedMembers from '@/components/moderation/BannedMembers.vue';
import ModerationOverview from '@/components/moderation/ModerationOverview.vue';
import Users from '@/components/moderation/Users.vue';
import ModeratorLeaderboard from '@/components/moderation/ModeratorLeaderboard.vue';
import AuditLogDetailModal from '@/components/audit-log/AuditLogDetailModal.vue';
import UserModHistoryModal from '@/components/audit-log/UserModHistoryModal.vue';
import ModerationActionModal from '@/components/moderation/ModerationActionModal.vue';
import BulkActionModal from '@/components/moderation/BulkActionModal.vue';
import { useModeration } from '@/composables/useModeration';
import { useToastStore } from '@/stores/toast';
import { moderationEndpoints } from '@/lib/endpoints/moderation';
import { useGuildsStore } from '@/stores/guilds';

const activeTab = ref('overview');
const router = useRouter();
const toastStore = useToastStore();
const guildStore = useGuildsStore();

const {
	maxMessagesCleared,
	automod,
	roles,
	mutedUsers,
	bannedUsers,
	moderationCases,
	allUsers,
	selectedCase,
	openCaseModal,
	closeCaseModal,
	selectedUserForHistory,
	userAuditLog,
	userNotes,
	openUserHistoryModal,
	closeUserHistoryModal,
	saveChanges,
	unmuteUser,
	unbanUser,
	performModerationAction,
	moderationStats,
	modActionsChartData,
	moderatorLeaderboardData,
	isActionModalOpen,
	actionInfo,
	closeActionModal,
	confirmModerationAction,
	addModeratorNote,
} = useModeration();

// Bulk action modal state
const isBulkActionModalOpen = ref(false);
const bulkActionType = ref<'ban' | 'kick' | 'timeout' | null>(null);

// Enhanced stats with additional metrics
const enhancedModerationStats = computed(() => {
	const today = new Date();
	today.setHours(0, 0, 0, 0);

	const todayCases = moderationCases.value.filter(
		(c) => new Date(c.timestamp) >= today
	).length;

	const expiringSoon = mutedUsers.value.filter((m) => {
		if (!m.mutedUntil) return false;
		const expiryTime = new Date(m.mutedUntil).getTime();
		const now = Date.now();
		const twentyFourHours = 24 * 60 * 60 * 1000;
		return expiryTime > now && expiryTime <= now + twentyFourHours;
	}).length;

	const tempBans = bannedUsers.value.filter((b) => b.bannedUntil).length;

	const autoModActions = moderationCases.value.filter(
		(c) =>
			c.executor.name.toLowerCase().includes('automod') ||
			c.executor.name.toLowerCase().includes('bot')
	).length;

	const autoModToday = moderationCases.value.filter((c) => {
		const isAutoMod =
			c.executor.name.toLowerCase().includes('automod') ||
			c.executor.name.toLowerCase().includes('bot');
		const isToday = new Date(c.timestamp) >= today;
		return isAutoMod && isToday;
	}).length;

	return {
		...moderationStats.value,
		todayCases,
		expiringSoon,
		tempBans,
		autoModActions,
		autoModToday,
	};
});

// Bulk action handlers
const openBulkActionModal = (type: 'ban' | 'kick' | 'timeout') => {
	bulkActionType.value = type;
	isBulkActionModalOpen.value = true;
};

const closeBulkActionModal = () => {
	isBulkActionModalOpen.value = false;
	bulkActionType.value = null;
};

const handleBulkAction = async (data: {
	type: 'ban' | 'kick' | 'timeout';
	userIds: string[];
	reason: string;
	duration?: number;
	deleteMessages?: boolean;
}) => {
	if (!guildStore.currentGuild) return;

	try {
		let endpoint;
		let payload: any = {
			users: data.userIds.join(','),
			reason: data.reason,
		};

		switch (data.type) {
			case 'ban':
				endpoint = moderationEndpoints.bulkBan;
				if (data.deleteMessages) {
					payload.deleteMessages = true;
				}
				break;
			case 'kick':
				endpoint = moderationEndpoints.bulkKick;
				break;
			case 'timeout':
				endpoint = moderationEndpoints.bulkTimeout;
				payload.duration = data.duration;
				break;
			default:
				throw new Error('Unknown bulk action type');
		}

		await endpoint(guildStore.currentGuild.id, payload);

		toastStore.addToast(
			`Bulk ${data.type} operation queued for ${data.userIds.length} users`,
			'success'
		);

		// Refresh data after a short delay to allow processing
		setTimeout(() => {
			// The useModeration composable should handle real-time updates via WebSocket
		}, 1000);
	} catch (error) {
		console.error('Bulk action failed:', error);
		toastStore.addToast(
			`Failed to execute bulk ${data.type} operation`,
			'error'
		);
	}
};

const viewCase = (caseId: number) => {
	// Find the case and open it
	const case_ = moderationCases.value.find((c) => c.id === caseId.toString());
	if (case_) {
		openCaseModal(case_);
	}
};
</script>
