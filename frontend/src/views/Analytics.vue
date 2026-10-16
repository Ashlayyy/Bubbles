<template>
	<div>
		<div class="flex justify-between items-center mb-6">
			<div>
				<h1 class="text-3xl font-bold text-foreground mb-2">
					Analytics & Reports
				</h1>
				<p class="text-muted-foreground">
					Detailed insights into your server's activity and engagement
				</p>
			</div>
			<div class="flex gap-3">
				<select
					v-model="selectedTimeRange"
					class="bg-input border border-border rounded-lg px-3 py-2 text-foreground"
				>
					<option value="7d">Last 7 days</option>
					<option value="30d">Last 30 days</option>
					<option value="90d">Last 90 days</option>
				</select>
				<button
					@click="exportReport"
					class="bg-primary hover:bg-primary/90 text-primary-foreground px-4 py-2 rounded-lg transition-colors"
				>
					Export Report
				</button>
			</div>
		</div>

		<!-- Key Metrics -->
		<div class="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
			<div class="bg-card border border-border rounded-lg p-6">
				<div class="flex items-center justify-between">
					<div>
						<p class="text-sm text-muted-foreground">Total Messages</p>
						<p class="text-2xl font-bold text-foreground">
							{{ formatNumber(analytics.totalMessages) }}
						</p>
						<p class="text-xs text-green-500">+12% from last period</p>
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
							class="text-blue-500"
						>
							<path
								d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"
							/>
						</svg>
					</div>
				</div>
			</div>

			<div class="bg-card border border-border rounded-lg p-6">
				<div class="flex items-center justify-between">
					<div>
						<p class="text-sm text-muted-foreground">Active Users</p>
						<p class="text-2xl font-bold text-foreground">
							{{ formatNumber(analytics.activeUsers) }}
						</p>
						<p class="text-xs text-green-500">+8% from last period</p>
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
							class="text-green-500"
						>
							<path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
							<circle cx="9" cy="7" r="4" />
							<path
								d="m22 21-3-3m0 0a5.5 5.5 0 1 0-7.78-7.78 5.5 5.5 0 0 0 7.78 7.78Z"
							/>
						</svg>
					</div>
				</div>
			</div>

			<div class="bg-card border border-border rounded-lg p-6">
				<div class="flex items-center justify-between">
					<div>
						<p class="text-sm text-muted-foreground">Peak Hour</p>
						<p class="text-2xl font-bold text-foreground">
							{{ analytics.peakHour }}
						</p>
						<p class="text-xs text-muted-foreground">Most active time</p>
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
							class="text-purple-500"
						>
							<circle cx="12" cy="12" r="10" />
							<polyline points="12,6 12,12 16,14" />
						</svg>
					</div>
				</div>
			</div>

			<div class="bg-card border border-border rounded-lg p-6">
				<div class="flex items-center justify-between">
					<div>
						<p class="text-sm text-muted-foreground">Engagement Rate</p>
						<p class="text-2xl font-bold text-foreground">
							{{ analytics.engagementRate }}%
						</p>
						<p class="text-xs text-red-500">-2% from last period</p>
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
							class="text-orange-500"
						>
							<path d="M22 12h-4l-3 9L9 3l-3 9H2" />
						</svg>
					</div>
				</div>
			</div>
		</div>

		<!-- Charts -->
		<div class="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
			<!-- Message Activity Chart -->
			<div class="bg-card border border-border rounded-lg p-6">
				<h3 class="text-lg font-semibold text-foreground mb-4">
					Message Activity
				</h3>
				<div class="h-64">
					<MessageActivityChart :data="messageActivityData" />
				</div>
			</div>

			<!-- User Engagement Chart -->
			<div class="bg-card border border-border rounded-lg p-6">
				<h3 class="text-lg font-semibold text-foreground mb-4">
					User Engagement
				</h3>
				<div class="h-64">
					<UserEngagementChart :data="userEngagementData" />
				</div>
			</div>
		</div>

		<!-- Channel Activity Heatmap -->
		<div class="bg-card border border-border rounded-lg p-6 mb-8">
			<h3 class="text-lg font-semibold text-foreground mb-4">
				Channel Activity Heatmap
			</h3>
			<ChannelHeatmap :data="channelHeatmapData" />
		</div>

		<!-- Top Channels & Users -->
		<div class="grid grid-cols-1 lg:grid-cols-2 gap-6">
			<!-- Top Channels -->
			<div class="bg-card border border-border rounded-lg p-6">
				<h3 class="text-lg font-semibold text-foreground mb-4">
					Most Active Channels
				</h3>
				<div class="space-y-3">
					<div
						v-for="channel in topChannels"
						:key="channel.id"
						class="flex items-center justify-between"
					>
						<div class="flex items-center gap-3">
							<span class="text-muted-foreground">#</span>
							<span class="font-medium text-foreground">{{
								channel.name
							}}</span>
						</div>
						<div class="text-right">
							<p class="font-semibold text-foreground">
								{{ formatNumber(channel.messages) }}
							</p>
							<p class="text-xs text-muted-foreground">messages</p>
						</div>
					</div>
				</div>
			</div>

			<!-- Top Users -->
			<div class="bg-card border border-border rounded-lg p-6">
				<h3 class="text-lg font-semibold text-foreground mb-4">
					Most Active Users
				</h3>
				<div class="space-y-3">
					<div
						v-for="user in topUsers"
						:key="user.id"
						class="flex items-center justify-between"
					>
						<div class="flex items-center gap-3">
							<div
								class="w-8 h-8 bg-gradient-to-br from-blue-500 to-purple-600 rounded-full flex items-center justify-center"
							>
								<span class="text-white text-sm font-bold">{{
									user.name.charAt(0)
								}}</span>
							</div>
							<span class="font-medium text-foreground">{{ user.name }}</span>
						</div>
						<div class="text-right">
							<p class="font-semibold text-foreground">
								{{ formatNumber(user.messages) }}
							</p>
							<p class="text-xs text-muted-foreground">messages</p>
						</div>
					</div>
				</div>
			</div>
		</div>
	</div>
</template>

<script setup lang="ts">
import { ref, computed, watch, onMounted } from 'vue';
import { useGuildsStore } from '@/stores/guilds';
import { analyticsApi } from '@/lib/endpoints';
import { useToast } from '@/hooks/useToast';
import MessageActivityChart from '@/components/analytics/MessageActivityChart.vue';
import UserEngagementChart from '@/components/analytics/UserEngagementChart.vue';
import ChannelHeatmap from '@/components/analytics/ChannelHeatmap.vue';

const selectedTimeRange = ref<'7d' | '30d' | '90d'>('7d');

const analytics = ref({
	totalMessages: 0,
	activeUsers: 0,
	peakHour: '',
	engagementRate: 0,
});

const messageActivityRaw = ref<Array<{ date: string; count: number }>>([]);
const userActivityRaw = ref<any[]>([]);

const toast = useToast();

const guildStore = useGuildsStore();

async function fetchAnalytics() {
	if (!guildStore.currentGuild) return;
	try {
		const gid = guildStore.currentGuild.id;

		const api = (analyticsApi as any).analyticsEndpoints;
		const [overviewRes, messageRes, memberRes] = await Promise.all([
			api.getOverview(gid, { period: selectedTimeRange.value }),
			api.getMessages(gid, { period: selectedTimeRange.value }),
			api.getMembers(gid, { period: selectedTimeRange.value }),
		]);

		const overview = overviewRes.data.data;
		analytics.value.totalMessages = overview?.messageCount ?? 0;
		analytics.value.activeUsers = overview?.memberCount ?? 0;
		analytics.value.peakHour = overview?.peakHour ?? '';
		analytics.value.engagementRate = overview?.engagementRate ?? 0;

		messageActivityRaw.value = messageRes.data.data?.dailyActivity ?? [];
		userActivityRaw.value = memberRes.data.data?.users ?? [];
	} catch (err) {
		toast.error('Failed to load analytics data');
		console.error(err);
	}
}

onMounted(fetchAnalytics);

watch(selectedTimeRange, () => fetchAnalytics());

const messageActivityData = computed(() => {
	const labels = messageActivityRaw.value.map((d) => d.date);
	const counts = messageActivityRaw.value.map((d) => d.count);
	return {
		labels,
		datasets: [
			{
				label: 'Messages',
				data: counts,
				borderColor: 'rgb(59, 130, 246)',
				backgroundColor: 'rgba(59, 130, 246, 0.1)',
				tension: 0.4,
				fill: true,
			},
		],
	};
});

const userEngagementData = computed(() => {
	if (userActivityRaw.value.length === 0) return { labels: [], datasets: [] };
	const labels = userActivityRaw.value.map((u) => u.userId);
	const totals = userActivityRaw.value.map((u) => u.totalActions);
	return {
		labels,
		datasets: [
			{
				data: totals,
				backgroundColor: 'rgba(34, 197, 94, 0.8)',
			},
		],
	};
});

const channelHeatmapData = computed(() => {
	return messageActivityRaw.value.map((d) => ({
		channel: 'all',
		hour: 0,
		messages: d.count,
	}));
});

const topChannels = computed(() => {
	return messageActivityRaw.value
		.slice()
		.sort((a, b) => b.count - a.count)
		.slice(0, 5)
		.map((d, idx) => ({ id: String(idx), name: d.date, messages: d.count }));
});

const topUsers = computed(() => {
	return userActivityRaw.value
		.slice()
		.sort((a, b) => b.totalActions - a.totalActions)
		.slice(0, 5)
		.map((u, idx) => ({
			id: String(idx),
			name: u.userId,
			messages: u.totalActions,
		}));
});

const formatNumber = (num: number) => {
	return new Intl.NumberFormat().format(num);
};

const exportReport = () => {
	// Implementation for exporting reports
	console.log('Exporting report for', selectedTimeRange.value);
};
</script>
