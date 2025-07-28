<template>
	<div class="space-y-6">
		<!-- Overview Cards -->
		<div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
			<div class="bg-card border border-border rounded-xl p-6">
				<div class="flex items-center justify-between">
					<div>
						<p class="text-sm text-muted-foreground">Total Members</p>
						<p class="text-2xl font-bold text-card-foreground">
							{{ formatNumber(stats.memberCount) }}
						</p>
						<div class="flex items-center mt-1">
							<span
								:class="getGrowthColor(growth.memberGrowth)"
								class="text-xs font-medium"
							>
								{{ growth.memberGrowth > 0 ? '+' : ''
								}}{{ growth.memberGrowth }}%
							</span>
							<span class="text-xs text-muted-foreground ml-1"
								>vs last period</span
							>
						</div>
					</div>
					<div
						class="w-12 h-12 bg-blue-500/20 rounded-lg flex items-center justify-center"
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
							class="text-blue-400"
						>
							<path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
							<circle cx="9" cy="7" r="4" />
							<path d="m22 21-3-3m0 0-3-3m3 3 3-3m-3 3-3 3" />
						</svg>
					</div>
				</div>
			</div>

			<div class="bg-card border border-border rounded-xl p-6">
				<div class="flex items-center justify-between">
					<div>
						<p class="text-sm text-muted-foreground">Online Members</p>
						<p class="text-2xl font-bold text-card-foreground">
							{{ formatNumber(stats.onlineCount) }}
						</p>
						<div class="flex items-center mt-1">
							<span class="text-xs font-medium text-green-400">
								{{ Math.round((stats.onlineCount / stats.memberCount) * 100) }}%
							</span>
							<span class="text-xs text-muted-foreground ml-1"
								>online rate</span
							>
						</div>
					</div>
					<div
						class="w-12 h-12 bg-green-500/20 rounded-lg flex items-center justify-center"
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
							class="text-green-400"
						>
							<circle cx="12" cy="12" r="3" />
							<path d="M12 1v6m0 6v6" />
							<path d="m21 12-6 0-6 0-6 0" />
						</svg>
					</div>
				</div>
			</div>

			<div class="bg-card border border-border rounded-xl p-6">
				<div class="flex items-center justify-between">
					<div>
						<p class="text-sm text-muted-foreground">Messages (24h)</p>
						<p class="text-2xl font-bold text-card-foreground">
							{{ formatNumber(stats.messageCount24h) }}
						</p>
						<div class="flex items-center mt-1">
							<span
								:class="getGrowthColor(growth.messageGrowth)"
								class="text-xs font-medium"
							>
								{{ growth.messageGrowth > 0 ? '+' : ''
								}}{{ growth.messageGrowth }}%
							</span>
							<span class="text-xs text-muted-foreground ml-1"
								>vs yesterday</span
							>
						</div>
					</div>
					<div
						class="w-12 h-12 bg-purple-500/20 rounded-lg flex items-center justify-center"
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
							class="text-purple-400"
						>
							<path d="m3 21 1.9-5.7a8.5 8.5 0 1 1 3.8 3.8z" />
						</svg>
					</div>
				</div>
			</div>

			<div class="bg-card border border-border rounded-xl p-6">
				<div class="flex items-center justify-between">
					<div>
						<p class="text-sm text-muted-foreground">Activity Score</p>
						<p class="text-2xl font-bold text-card-foreground">
							{{ growth.engagementRate }}%
						</p>
						<div class="flex items-center mt-1">
							<span
								:class="getGrowthColor(growth.activityGrowth)"
								class="text-xs font-medium"
							>
								{{ growth.activityGrowth > 0 ? '+' : ''
								}}{{ growth.activityGrowth }}%
							</span>
							<span class="text-xs text-muted-foreground ml-1">engagement</span>
						</div>
					</div>
					<div
						class="w-12 h-12 bg-orange-500/20 rounded-lg flex items-center justify-center"
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
							class="text-orange-400"
						>
							<polyline points="22,12 18,12 15,21 9,3 6,12 2,12" />
						</svg>
					</div>
				</div>
			</div>
		</div>

		<!-- Charts Section -->
		<div class="grid grid-cols-1 lg:grid-cols-2 gap-6">
			<!-- Member Growth Chart -->
			<div class="bg-card border border-border rounded-xl p-6">
				<div class="flex items-center justify-between mb-4">
					<h3 class="text-lg font-semibold text-card-foreground">
						Member Growth
					</h3>
					<select
						v-model="memberChartPeriod"
						@change="fetchHistoricalData"
						class="bg-muted border border-border rounded-lg px-3 py-1 text-sm text-card-foreground"
					>
						<option value="7d">7 Days</option>
						<option value="30d">30 Days</option>
						<option value="90d">90 Days</option>
					</select>
				</div>
				<div class="h-64 flex items-center justify-center">
					<div v-if="loadingCharts" class="text-muted-foreground">
						Loading chart...
					</div>
					<canvas v-else ref="memberChart" class="w-full h-full"></canvas>
				</div>
			</div>

			<!-- Activity Chart -->
			<div class="bg-card border border-border rounded-xl p-6">
				<div class="flex items-center justify-between mb-4">
					<h3 class="text-lg font-semibold text-card-foreground">
						Daily Activity
					</h3>
					<select
						v-model="activityChartPeriod"
						@change="fetchActivityData"
						class="bg-muted border border-border rounded-lg px-3 py-1 text-sm text-card-foreground"
					>
						<option value="7d">7 Days</option>
						<option value="30d">30 Days</option>
					</select>
				</div>
				<div class="h-64 flex items-center justify-center">
					<div v-if="loadingCharts" class="text-muted-foreground">
						Loading chart...
					</div>
					<canvas v-else ref="activityChart" class="w-full h-full"></canvas>
				</div>
			</div>
		</div>

		<!-- Activity Breakdown -->
		<div class="grid grid-cols-1 lg:grid-cols-3 gap-6">
			<!-- Recent Activity -->
			<div class="lg:col-span-2 bg-card border border-border rounded-xl p-6">
				<div class="flex items-center justify-between mb-4">
					<h3 class="text-lg font-semibold text-card-foreground">
						Activity Breakdown (24h)
					</h3>
					<button
						@click="refreshData"
						class="text-sm text-primary hover:text-primary/80"
					>
						Refresh
					</button>
				</div>
				<div class="grid grid-cols-2 md:grid-cols-4 gap-4">
					<div class="text-center">
						<div class="text-2xl font-bold text-card-foreground">
							{{ stats.commandsExecuted24h }}
						</div>
						<div class="text-sm text-muted-foreground">Commands</div>
					</div>
					<div class="text-center">
						<div class="text-2xl font-bold text-card-foreground">
							{{ stats.moderationCases24h }}
						</div>
						<div class="text-sm text-muted-foreground">Mod Actions</div>
					</div>
					<div class="text-center">
						<div class="text-2xl font-bold text-card-foreground">
							{{ stats.ticketsCreated24h }}
						</div>
						<div class="text-sm text-muted-foreground">Tickets</div>
					</div>
					<div class="text-center">
						<div class="text-2xl font-bold text-card-foreground">
							{{ formatTime(stats.voiceMinutes24h) }}
						</div>
						<div class="text-sm text-muted-foreground">Voice Time</div>
					</div>
				</div>
			</div>

			<!-- Top Contributors -->
			<div class="bg-card border border-border rounded-xl p-6">
				<div class="flex items-center justify-between mb-4">
					<h3 class="text-lg font-semibold text-card-foreground">
						Top Contributors
					</h3>
					<select
						v-model="leaderboardType"
						@change="fetchLeaderboards"
						class="bg-muted border border-border rounded-lg px-2 py-1 text-xs text-card-foreground"
					>
						<option value="messages">Messages</option>
						<option value="commands">Commands</option>
						<option value="moderation">Moderation</option>
					</select>
				</div>
				<div class="space-y-3">
					<div v-if="leaderboards.length === 0" class="text-center py-4">
						<p class="text-muted-foreground text-sm">No data available</p>
					</div>
					<div
						v-else
						v-for="(user, index) in leaderboards.slice(0, 5)"
						:key="user.userId"
						class="flex items-center justify-between"
					>
						<div class="flex items-center gap-3">
							<div
								class="w-6 h-6 rounded-full bg-primary/10 flex items-center justify-center text-xs font-semibold text-primary"
							>
								{{ index + 1 }}
							</div>
							<div>
								<p class="text-sm font-medium text-card-foreground">
									{{ getUserName(user.userId) }}
								</p>
								<p class="text-xs text-muted-foreground">
									{{ user.count }} {{ leaderboardType }}
								</p>
							</div>
						</div>
					</div>
				</div>
			</div>
		</div>

		<!-- Detailed Analytics -->
		<div class="bg-card border border-border rounded-xl p-6">
			<div class="flex items-center justify-between mb-6">
				<h3 class="text-lg font-semibold text-card-foreground">
					Server Health & Analytics
				</h3>
				<div class="flex gap-2">
					<button
						@click="activeAnalyticsTab = 'channels'"
						:class="[
							'px-3 py-1 rounded-lg text-sm font-medium transition-colors',
							activeAnalyticsTab === 'channels'
								? 'bg-primary text-primary-foreground'
								: 'bg-muted text-muted-foreground hover:text-foreground',
						]"
					>
						Channels
					</button>
					<button
						@click="activeAnalyticsTab = 'retention'"
						:class="[
							'px-3 py-1 rounded-lg text-sm font-medium transition-colors',
							activeAnalyticsTab === 'retention'
								? 'bg-primary text-primary-foreground'
								: 'bg-muted text-muted-foreground hover:text-foreground',
						]"
					>
						Retention
					</button>
					<button
						@click="activeAnalyticsTab = 'growth'"
						:class="[
							'px-3 py-1 rounded-lg text-sm font-medium transition-colors',
							activeAnalyticsTab === 'growth'
								? 'bg-primary text-primary-foreground'
								: 'bg-muted text-muted-foreground hover:text-foreground',
						]"
					>
						Growth
					</button>
				</div>
			</div>

			<!-- Channel Analytics -->
			<div v-if="activeAnalyticsTab === 'channels'" class="space-y-4">
				<div class="grid grid-cols-1 md:grid-cols-3 gap-4">
					<div class="text-center p-4 bg-muted/50 rounded-lg">
						<div class="text-xl font-bold text-card-foreground">
							{{ stats.channelCount }}
						</div>
						<div class="text-sm text-muted-foreground">Total Channels</div>
					</div>
					<div class="text-center p-4 bg-muted/50 rounded-lg">
						<div class="text-xl font-bold text-card-foreground">
							{{
								Math.round(
									stats.messageCount24h / Math.max(stats.channelCount, 1)
								)
							}}
						</div>
						<div class="text-sm text-muted-foreground">
							Avg Messages/Channel
						</div>
					</div>
					<div class="text-center p-4 bg-muted/50 rounded-lg">
						<div class="text-xl font-bold text-card-foreground">
							{{ stats.roleCount }}
						</div>
						<div class="text-sm text-muted-foreground">Total Roles</div>
					</div>
				</div>
			</div>

			<!-- Retention Analytics -->
			<div v-if="activeAnalyticsTab === 'retention'" class="space-y-4">
				<div class="grid grid-cols-1 md:grid-cols-2 gap-4">
					<div class="text-center p-4 bg-muted/50 rounded-lg">
						<div class="text-xl font-bold text-green-400">
							{{ growth.retentionRate }}%
						</div>
						<div class="text-sm text-muted-foreground">Member Retention</div>
					</div>
					<div class="text-center p-4 bg-muted/50 rounded-lg">
						<div class="text-xl font-bold text-blue-400">
							{{ growth.engagementRate }}%
						</div>
						<div class="text-sm text-muted-foreground">Daily Engagement</div>
					</div>
				</div>
			</div>

			<!-- Growth Analytics -->
			<div v-if="activeAnalyticsTab === 'growth'" class="space-y-4">
				<div class="grid grid-cols-1 md:grid-cols-3 gap-4">
					<div class="text-center p-4 bg-muted/50 rounded-lg">
						<div
							:class="[
								'text-xl font-bold',
								getGrowthColor(growth.memberGrowth),
							]"
						>
							{{ growth.memberGrowth > 0 ? '+' : '' }}{{ growth.memberGrowth }}%
						</div>
						<div class="text-sm text-muted-foreground">Member Growth</div>
					</div>
					<div class="text-center p-4 bg-muted/50 rounded-lg">
						<div
							:class="[
								'text-xl font-bold',
								getGrowthColor(growth.messageGrowth),
							]"
						>
							{{ growth.messageGrowth > 0 ? '+' : ''
							}}{{ growth.messageGrowth }}%
						</div>
						<div class="text-sm text-muted-foreground">Message Growth</div>
					</div>
					<div class="text-center p-4 bg-muted/50 rounded-lg">
						<div
							:class="[
								'text-xl font-bold',
								getGrowthColor(growth.activityGrowth),
							]"
						>
							{{ growth.activityGrowth > 0 ? '+' : ''
							}}{{ growth.activityGrowth }}%
						</div>
						<div class="text-sm text-muted-foreground">Activity Growth</div>
					</div>
				</div>
			</div>
		</div>
	</div>
</template>

<script setup lang="ts">
import { ref, onMounted, nextTick } from 'vue';
import { Chart, registerables } from 'chart.js';
import { useGuildsStore } from '@/stores/guilds';
import { useToastStore } from '@/stores/toast';

Chart.register(...registerables);

interface ServerStats {
	memberCount: number;
	onlineCount: number;
	channelCount: number;
	roleCount: number;
	messageCount24h: number;
	moderationCases24h: number;
	ticketsCreated24h: number;
	commandsExecuted24h: number;
	voiceMinutes24h: number;
	reactionRoleUsage24h: number;
	lastUpdated: string;
}

interface GrowthMetrics {
	memberGrowth: number;
	messageGrowth: number;
	activityGrowth: number;
	retentionRate: number;
	engagementRate: number;
}

interface LeaderboardEntry {
	rank: number;
	userId: string;
	count: number;
}

const guildStore = useGuildsStore();
const toastStore = useToastStore();

// State
const stats = ref<ServerStats>({
	memberCount: 0,
	onlineCount: 0,
	channelCount: 0,
	roleCount: 0,
	messageCount24h: 0,
	moderationCases24h: 0,
	ticketsCreated24h: 0,
	commandsExecuted24h: 0,
	voiceMinutes24h: 0,
	reactionRoleUsage24h: 0,
	lastUpdated: new Date().toISOString(),
});

const growth = ref<GrowthMetrics>({
	memberGrowth: 0,
	messageGrowth: 0,
	activityGrowth: 0,
	retentionRate: 0,
	engagementRate: 0,
});

const leaderboards = ref<LeaderboardEntry[]>([]);
const loadingCharts = ref(true);

// Chart settings
const memberChartPeriod = ref('30d');
const activityChartPeriod = ref('7d');
const leaderboardType = ref('messages');
const activeAnalyticsTab = ref('channels');

// Chart refs
const memberChart = ref<HTMLCanvasElement>();
const activityChart = ref<HTMLCanvasElement>();

let memberChartInstance: Chart | null = null;
let activityChartInstance: Chart | null = null;

// Methods
const fetchCurrentStats = async () => {
	if (!guildStore.currentGuild) return;

	try {
		// Mock data for now - would call actual API
		stats.value = {
			memberCount: 12346,
			onlineCount: 3421,
			channelCount: 42,
			roleCount: 28,
			messageCount24h: 1847,
			moderationCases24h: 12,
			ticketsCreated24h: 8,
			commandsExecuted24h: 234,
			voiceMinutes24h: 14520,
			reactionRoleUsage24h: 67,
			lastUpdated: new Date().toISOString(),
		};
	} catch (error) {
		console.error('Failed to fetch server stats:', error);
		toastStore.addToast('Failed to load server statistics', 'error');
	}
};

const fetchGrowthMetrics = async () => {
	if (!guildStore.currentGuild) return;

	try {
		// Mock data for now - would call actual API
		growth.value = {
			memberGrowth: 5.2,
			messageGrowth: 12.8,
			activityGrowth: 8.4,
			retentionRate: 87.3,
			engagementRate: 34.6,
		};
	} catch (error) {
		console.error('Failed to fetch growth metrics:', error);
	}
};

const fetchHistoricalData = async () => {
	if (!guildStore.currentGuild) return;

	loadingCharts.value = true;
	try {
		// Mock historical data
		const days = parseInt(memberChartPeriod.value);
		const data = Array.from({ length: days }, (_, i) => ({
			date: new Date(Date.now() - (days - i) * 24 * 60 * 60 * 1000)
				.toISOString()
				.split('T')[0],
			members: 12000 + Math.floor(Math.random() * 500) + i * 5,
			online: 3000 + Math.floor(Math.random() * 500),
		}));

		await nextTick();
		createMemberChart(data);
	} catch (error) {
		console.error('Failed to fetch historical data:', error);
	} finally {
		loadingCharts.value = false;
	}
};

const fetchActivityData = async () => {
	if (!guildStore.currentGuild) return;

	try {
		// Mock activity data
		const days = parseInt(activityChartPeriod.value);
		const data = Array.from({ length: days }, (_, i) => ({
			date: new Date(Date.now() - (days - i) * 24 * 60 * 60 * 1000)
				.toISOString()
				.split('T')[0],
			messages: 1500 + Math.floor(Math.random() * 500),
			commands: 200 + Math.floor(Math.random() * 100),
			voice: 10000 + Math.floor(Math.random() * 5000),
		}));

		await nextTick();
		createActivityChart(data);
	} catch (error) {
		console.error('Failed to fetch activity data:', error);
	}
};

const fetchLeaderboards = async () => {
	if (!guildStore.currentGuild) return;

	try {
		// Mock leaderboard data
		leaderboards.value = Array.from({ length: 10 }, (_, i) => ({
			rank: i + 1,
			userId: `user${i + 1}`,
			count: Math.floor(Math.random() * 1000) + 100,
		})).sort((a, b) => b.count - a.count);
	} catch (error) {
		console.error('Failed to fetch leaderboards:', error);
	}
};

const createMemberChart = (data: any[]) => {
	if (!memberChart.value) return;

	if (memberChartInstance) {
		memberChartInstance.destroy();
	}

	const ctx = memberChart.value.getContext('2d');
	if (!ctx) return;

	memberChartInstance = new Chart(ctx, {
		type: 'line',
		data: {
			labels: data.map((d) => d.date),
			datasets: [
				{
					label: 'Total Members',
					data: data.map((d) => d.members),
					borderColor: 'rgb(59, 130, 246)',
					backgroundColor: 'rgba(59, 130, 246, 0.1)',
					tension: 0.1,
				},
				{
					label: 'Online Members',
					data: data.map((d) => d.online),
					borderColor: 'rgb(34, 197, 94)',
					backgroundColor: 'rgba(34, 197, 94, 0.1)',
					tension: 0.1,
				},
			],
		},
		options: {
			responsive: true,
			maintainAspectRatio: false,
			plugins: {
				legend: {
					display: true,
				},
			},
			scales: {
				y: {
					beginAtZero: false,
				},
			},
		},
	});
};

const createActivityChart = (data: any[]) => {
	if (!activityChart.value) return;

	if (activityChartInstance) {
		activityChartInstance.destroy();
	}

	const ctx = activityChart.value.getContext('2d');
	if (!ctx) return;

	activityChartInstance = new Chart(ctx, {
		type: 'bar',
		data: {
			labels: data.map((d) => d.date),
			datasets: [
				{
					label: 'Messages',
					data: data.map((d) => d.messages),
					backgroundColor: 'rgba(147, 51, 234, 0.5)',
				},
				{
					label: 'Commands',
					data: data.map((d) => d.commands),
					backgroundColor: 'rgba(249, 115, 22, 0.5)',
				},
			],
		},
		options: {
			responsive: true,
			maintainAspectRatio: false,
			plugins: {
				legend: {
					display: true,
				},
			},
			scales: {
				y: {
					beginAtZero: true,
				},
			},
		},
	});
};

const refreshData = async () => {
	await Promise.all([
		fetchCurrentStats(),
		fetchGrowthMetrics(),
		fetchHistoricalData(),
		fetchActivityData(),
		fetchLeaderboards(),
	]);
};

// Utility functions
const formatNumber = (num: number): string => {
	return new Intl.NumberFormat().format(num);
};

const formatTime = (minutes: number): string => {
	const hours = Math.floor(minutes / 60);
	const mins = minutes % 60;
	return `${hours}h ${mins}m`;
};

const getGrowthColor = (growth: number): string => {
	if (growth > 0) return 'text-green-400';
	if (growth < 0) return 'text-red-400';
	return 'text-muted-foreground';
};

const getUserName = (userId: string): string => {
	// In a real app, this would fetch user data
	return `User ${userId.slice(-4)}`;
};

onMounted(() => {
	refreshData();
});
</script>
