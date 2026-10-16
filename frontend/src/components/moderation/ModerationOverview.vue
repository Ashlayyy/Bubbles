<template>
	<div class="space-y-8">
		<!-- Enhanced Stat Cards with Real-time Updates -->
		<div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
			<div
				class="bg-card border border-border rounded-xl p-6 flex items-center justify-between"
			>
				<div>
					<p class="text-sm text-muted-foreground">Total Cases</p>
					<p class="text-3xl font-bold text-card-foreground">
						{{ stats.totalCases }}
					</p>
					<p class="text-xs text-green-400 mt-1">
						+{{ stats.todayCases }} today
					</p>
				</div>
				<div
					class="w-12 h-12 bg-blue-500/20 rounded-lg flex items-center justify-center text-blue-400 text-2xl"
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
						class="lucide lucide-shield-check"
					>
						<path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10" />
						<path d="m9 12 2 2 4-4" />
					</svg>
				</div>
			</div>
			<div
				class="bg-card border border-border rounded-xl p-6 flex items-center justify-between"
			>
				<div>
					<p class="text-sm text-muted-foreground">Currently Muted</p>
					<p class="text-3xl font-bold text-card-foreground">
						{{ stats.mutedUsers }}
					</p>
					<p class="text-xs text-muted-foreground mt-1">
						{{ stats.expiringSoon }} expiring soon
					</p>
				</div>
				<div
					class="w-12 h-12 bg-yellow-500/20 rounded-lg flex items-center justify-center text-yellow-400 text-2xl"
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
						class="lucide lucide-mic-off"
					>
						<path d="M12 8V5a3 3 0 0 0-6 0v3" />
						<path d="M8.8 8.8A4.95 4.95 0 0 0 8 10v3a4 4 0 0 0 8 0v-1.2" />
						<line x1="1" y1="1" x2="23" y2="23" />
						<path d="M16 10a4 4 0 0 0-4-4V4a4 4 0 0 0-4 4" />
					</svg>
				</div>
			</div>
			<div
				class="bg-card border border-border rounded-xl p-6 flex items-center justify-between"
			>
				<div>
					<p class="text-sm text-muted-foreground">Currently Banned</p>
					<p class="text-3xl font-bold text-card-foreground">
						{{ stats.bannedUsers }}
					</p>
					<p class="text-xs text-muted-foreground mt-1">
						{{ stats.tempBans }} temporary
					</p>
				</div>
				<div
					class="w-12 h-12 bg-red-500/20 rounded-lg flex items-center justify-center text-red-400 text-2xl"
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
						class="lucide lucide-gavel"
					>
						<path d="M14 12l-4-4" />
						<path d="M10 8l4 4" />
						<path
							d="M16 5H8a2 2 0 0 0-2 2v10a2 2 0 0 0 2 2h8a2 2 0 0 0-2-2V7a2 2 0 0 0-2-2Z"
						/>
						<path d="M12 5V3" />
						<path d="M6 5H4" />
						<path d="M20 5h-2" />
					</svg>
				</div>
			</div>
			<div
				class="bg-card border border-border rounded-xl p-6 flex items-center justify-between"
			>
				<div>
					<p class="text-sm text-muted-foreground">AutoMod Actions</p>
					<p class="text-3xl font-bold text-card-foreground">
						{{ stats.autoModActions }}
					</p>
					<p class="text-xs text-blue-400 mt-1">
						{{ stats.autoModToday }} today
					</p>
				</div>
				<div
					class="w-12 h-12 bg-purple-500/20 rounded-lg flex items-center justify-center text-purple-400 text-2xl"
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
						class="lucide lucide-zap"
					>
						<polygon points="13,2 3,14 12,14 11,22 21,10 12,10 13,2" />
					</svg>
				</div>
			</div>
		</div>

		<!-- Real-time Activity Feed and Quick Actions -->
		<div class="grid grid-cols-1 lg:grid-cols-3 gap-6">
			<!-- Activity Feed -->
			<div class="lg:col-span-2 bg-card border border-border rounded-xl p-6">
				<div class="flex items-center justify-between mb-4">
					<h2 class="text-xl font-semibold text-card-foreground">
						Recent Activity
					</h2>
					<div class="flex items-center gap-2">
						<div class="w-2 h-2 bg-green-400 rounded-full animate-pulse"></div>
						<span class="text-sm text-muted-foreground">Live</span>
					</div>
				</div>
				<div class="space-y-3 max-h-96 overflow-y-auto">
					<div
						v-for="activity in recentActivity"
						:key="activity.id"
						class="flex items-start gap-3 p-3 bg-muted/20 rounded-lg"
					>
						<div
							:class="getActivityIcon(activity.type)"
							class="w-8 h-8 rounded-full flex items-center justify-center text-sm"
						>
							{{ getActivityEmoji(activity.type) }}
						</div>
						<div class="flex-1 min-w-0">
							<p class="text-sm text-card-foreground">
								<span class="font-medium">{{ activity.moderator }}</span>
								{{ getActivityText(activity.type) }}
								<span class="font-medium">{{ activity.target }}</span>
							</p>
							<p class="text-xs text-muted-foreground mt-1">
								{{ activity.reason }} • {{ formatTimeAgo(activity.timestamp) }}
							</p>
						</div>
						<button
							@click="viewCase(activity.caseId)"
							class="text-xs text-blue-400 hover:text-blue-300"
						>
							Case #{{ activity.caseId }}
						</button>
					</div>
				</div>
			</div>

			<!-- Quick Actions -->
			<div class="bg-card border border-border rounded-xl p-6">
				<h2 class="text-xl font-semibold text-card-foreground mb-4">
					Quick Actions
				</h2>
				<div class="space-y-3">
					<button
						@click="openBulkActionModal('ban')"
						class="w-full p-3 bg-red-500/10 hover:bg-red-500/20 border border-red-500/20 rounded-lg text-left transition-colors"
					>
						<div class="flex items-center gap-3">
							<div
								class="w-8 h-8 bg-red-500/20 rounded-lg flex items-center justify-center"
							>
								🔨
							</div>
							<div>
								<p class="text-sm font-medium text-card-foreground">Bulk Ban</p>
								<p class="text-xs text-muted-foreground">
									Ban multiple users at once
								</p>
							</div>
						</div>
					</button>
					<button
						@click="openBulkActionModal('kick')"
						class="w-full p-3 bg-orange-500/10 hover:bg-orange-500/20 border border-orange-500/20 rounded-lg text-left transition-colors"
					>
						<div class="flex items-center gap-3">
							<div
								class="w-8 h-8 bg-orange-500/20 rounded-lg flex items-center justify-center"
							>
								👢
							</div>
							<div>
								<p class="text-sm font-medium text-card-foreground">
									Bulk Kick
								</p>
								<p class="text-xs text-muted-foreground">
									Kick multiple users at once
								</p>
							</div>
						</div>
					</button>
					<button
						@click="openBulkActionModal('timeout')"
						class="w-full p-3 bg-yellow-500/10 hover:bg-yellow-500/20 border border-yellow-500/20 rounded-lg text-left transition-colors"
					>
						<div class="flex items-center gap-3">
							<div
								class="w-8 h-8 bg-yellow-500/20 rounded-lg flex items-center justify-center"
							>
								⏰
							</div>
							<div>
								<p class="text-sm font-medium text-card-foreground">
									Bulk Timeout
								</p>
								<p class="text-xs text-muted-foreground">
									Timeout multiple users at once
								</p>
							</div>
						</div>
					</button>
					<button
						@click="$emit('openAuditLog')"
						class="w-full p-3 bg-blue-500/10 hover:bg-blue-500/20 border border-blue-500/20 rounded-lg text-left transition-colors"
					>
						<div class="flex items-center gap-3">
							<div
								class="w-8 h-8 bg-blue-500/20 rounded-lg flex items-center justify-center"
							>
								📋
							</div>
							<div>
								<p class="text-sm font-medium text-card-foreground">
									View Audit Log
								</p>
								<p class="text-xs text-muted-foreground">
									Full moderation history
								</p>
							</div>
						</div>
					</button>
				</div>
			</div>
		</div>

		<!-- Mod Actions Chart -->
		<div class="bg-card border border-border rounded-xl p-6">
			<h2 class="text-xl font-semibold text-card-foreground mb-4">
				Moderation Actions (Last 7 Days)
			</h2>
			<div class="h-80">
				<ModActionChart
					:chart-data="modActionsChartData"
					:chart-options="modActionsChartOptions"
				/>
			</div>
		</div>

		<!-- Action Type Breakdown -->
		<div class="grid grid-cols-1 md:grid-cols-2 gap-6">
			<div class="bg-card border border-border rounded-xl p-6">
				<h2 class="text-xl font-semibold text-card-foreground mb-4">
					Action Type Distribution
				</h2>
				<div class="space-y-3">
					<div
						v-for="actionType in actionDistribution"
						:key="actionType.type"
						class="flex items-center justify-between"
					>
						<div class="flex items-center gap-3">
							<div :class="actionType.color" class="w-3 h-3 rounded-full"></div>
							<span class="text-sm text-card-foreground">{{
								actionType.type
							}}</span>
						</div>
						<div class="flex items-center gap-2">
							<span class="text-sm font-medium text-card-foreground">{{
								actionType.count
							}}</span>
							<span class="text-xs text-muted-foreground"
								>({{ actionType.percentage }}%)</span
							>
						</div>
					</div>
				</div>
			</div>

			<div class="bg-card border border-border rounded-xl p-6">
				<h2 class="text-xl font-semibold text-card-foreground mb-4">
					Top Moderators
				</h2>
				<div class="space-y-3">
					<div
						v-for="(mod, index) in topModerators"
						:key="mod.id"
						class="flex items-center gap-3"
					>
						<div
							class="w-8 h-8 bg-primary/10 rounded-full flex items-center justify-center text-xs font-medium"
						>
							{{ index + 1 }}
						</div>
						<div class="flex-1">
							<p class="text-sm font-medium text-card-foreground">
								{{ mod.name }}
							</p>
							<p class="text-xs text-muted-foreground">
								{{ mod.actions }} actions this week
							</p>
						</div>
						<div class="w-16 bg-muted rounded-full h-2">
							<div
								:class="'bg-primary rounded-full h-2'"
								:style="{ width: `${mod.percentage}%` }"
							></div>
						</div>
					</div>
				</div>
			</div>
		</div>
	</div>
</template>

<script setup lang="ts">
import ModActionChart from './charts/ModActionChart.vue';
import type { ChartData, ChartOptions } from 'chart.js';
import { computed, onMounted, onUnmounted, ref } from 'vue';
import { useUIStore } from '@/stores/ui';
import { formatDistanceToNow } from 'date-fns';

interface ModerationStats {
	totalCases: number;
	mutedUsers: number;
	bannedUsers: number;
	todayCases: number;
	expiringSoon: number;
	tempBans: number;
	autoModActions: number;
	autoModToday: number;
}

interface RecentActivity {
	id: string;
	type: 'ban' | 'kick' | 'timeout' | 'warn' | 'unban';
	moderator: string;
	target: string;
	reason: string;
	timestamp: Date;
	caseId: number;
}

interface ActionDistribution {
	type: string;
	count: number;
	percentage: number;
	color: string;
}

interface TopModerator {
	id: string;
	name: string;
	actions: number;
	percentage: number;
}

const props = defineProps<{
	stats: ModerationStats;
	modActionsChartData: ChartData<'bar'>;
	recentActivity?: RecentActivity[];
	actionDistribution?: ActionDistribution[];
	topModerators?: TopModerator[];
}>();

const emit = defineEmits<{
	(e: 'openBulkAction', type: 'ban' | 'kick' | 'timeout'): void;
	(e: 'openAuditLog'): void;
	(e: 'viewCase', caseId: number): void;
}>();

const uiStore = useUIStore();

// Mock data for demonstration - in real app, this would come from props
const recentActivity = ref<RecentActivity[]>(
	props.recentActivity || [
		{
			id: '1',
			type: 'ban',
			moderator: 'Admin',
			target: 'BadUser123',
			reason: 'Spam and harassment',
			timestamp: new Date(Date.now() - 2 * 60 * 1000),
			caseId: 1234,
		},
		{
			id: '2',
			type: 'timeout',
			moderator: 'Moderator',
			target: 'TroubleMaker',
			reason: 'Inappropriate language',
			timestamp: new Date(Date.now() - 5 * 60 * 1000),
			caseId: 1233,
		},
		{
			id: '3',
			type: 'warn',
			moderator: 'Helper',
			target: 'NewUser',
			reason: 'Off-topic discussion',
			timestamp: new Date(Date.now() - 10 * 60 * 1000),
			caseId: 1232,
		},
	]
);

const actionDistribution = ref<ActionDistribution[]>(
	props.actionDistribution || [
		{ type: 'Warnings', count: 45, percentage: 45, color: 'bg-yellow-400' },
		{ type: 'Timeouts', count: 25, percentage: 25, color: 'bg-orange-400' },
		{ type: 'Kicks', count: 20, percentage: 20, color: 'bg-red-400' },
		{ type: 'Bans', count: 10, percentage: 10, color: 'bg-red-600' },
	]
);

const topModerators = ref<TopModerator[]>(
	props.topModerators || [
		{ id: '1', name: 'Admin', actions: 45, percentage: 100 },
		{ id: '2', name: 'Moderator', actions: 32, percentage: 71 },
		{ id: '3', name: 'Helper', actions: 18, percentage: 40 },
	]
);

const modActionsChartOptions = computed((): ChartOptions<'bar'> => {
	const isDark = uiStore.theme === 'dark';
	return {
		responsive: true,
		maintainAspectRatio: false,
		plugins: {
			legend: {
				display: false,
			},
			tooltip: {
				backgroundColor: isDark ? 'hsl(var(--card))' : 'hsl(var(--card))',
				titleColor: isDark
					? 'hsl(var(--card-foreground))'
					: 'hsl(var(--card-foreground))',
				bodyColor: isDark
					? 'hsl(var(--card-foreground))'
					: 'hsl(var(--card-foreground))',
				borderColor: isDark ? 'hsl(var(--border))' : 'hsl(var(--border))',
				borderWidth: 1,
			},
		},
		scales: {
			y: {
				beginAtZero: true,
				grid: {
					color: isDark ? 'hsl(var(--border))' : 'hsl(var(--border))',
				},
				ticks: {
					color: isDark
						? 'hsl(var(--muted-foreground))'
						: 'hsl(var(--muted-foreground))',
				},
			},
			x: {
				grid: {
					display: false,
				},
				ticks: {
					color: isDark
						? 'hsl(var(--muted-foreground))'
						: 'hsl(var(--muted-foreground))',
				},
			},
		},
	};
});

// Real-time activity simulation
let activityInterval: NodeJS.Timeout | null = null;

onMounted(() => {
	// Simulate real-time updates every 30 seconds
	activityInterval = setInterval(() => {
		// In a real app, this would listen to WebSocket events
		// For demo, we'll just add a mock activity occasionally
		if (Math.random() > 0.7) {
			const mockActivity: RecentActivity = {
				id: Date.now().toString(),
				type: ['ban', 'kick', 'timeout', 'warn'][
					Math.floor(Math.random() * 4)
				] as any,
				moderator: 'AutoMod',
				target: 'User' + Math.floor(Math.random() * 1000),
				reason: 'Automated action',
				timestamp: new Date(),
				caseId: Math.floor(Math.random() * 10000),
			};
			recentActivity.value.unshift(mockActivity);
			if (recentActivity.value.length > 10) {
				recentActivity.value.pop();
			}
		}
	}, 30000);
});

onUnmounted(() => {
	if (activityInterval) {
		clearInterval(activityInterval);
	}
});

const getActivityIcon = (type: string) => {
	const icons = {
		ban: 'bg-red-500/20 text-red-400',
		kick: 'bg-orange-500/20 text-orange-400',
		timeout: 'bg-yellow-500/20 text-yellow-400',
		warn: 'bg-blue-500/20 text-blue-400',
		unban: 'bg-green-500/20 text-green-400',
	};
	return icons[type as keyof typeof icons] || 'bg-gray-500/20 text-gray-400';
};

const getActivityEmoji = (type: string) => {
	const emojis = {
		ban: '🔨',
		kick: '👢',
		timeout: '⏰',
		warn: '⚠️',
		unban: '🔓',
	};
	return emojis[type as keyof typeof emojis] || '📋';
};

const getActivityText = (type: string) => {
	const texts = {
		ban: 'banned',
		kick: 'kicked',
		timeout: 'timed out',
		warn: 'warned',
		unban: 'unbanned',
	};
	return texts[type as keyof typeof texts] || 'acted on';
};

const formatTimeAgo = (date: Date) => {
	return formatDistanceToNow(date, { addSuffix: true });
};

const openBulkActionModal = (type: 'ban' | 'kick' | 'timeout') => {
	emit('openBulkAction', type);
};

const viewCase = (caseId: number) => {
	emit('viewCase', caseId);
};
</script>
