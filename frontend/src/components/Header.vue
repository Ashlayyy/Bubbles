<template>
	<header class="bg-card border-b border-border px-6 py-4">
		<div class="flex items-center justify-between">
			<!-- Global Search -->
			<div class="flex-1 max-w-2xl">
				<div class="relative">
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
						class="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground"
					>
						<circle cx="11" cy="11" r="8" />
						<path d="m21 21-4.35-4.35" />
					</svg>
					<input
						v-model="searchQuery"
						@input="handleSearch"
						@keydown.enter="performSearch"
						@focus="showResults = true"
						type="text"
						placeholder="Search commands, users, settings, logs... (Ctrl+K)"
						class="w-full pl-10 pr-4 py-2 bg-input border border-border rounded-lg text-foreground placeholder-muted-foreground focus:ring-2 focus:ring-primary outline-none"
					/>

					<!-- Search Results Dropdown -->
					<div
						v-if="showResults && (searchResults.length > 0 || searchQuery)"
						class="absolute top-full left-0 right-0 mt-1 bg-card border border-border rounded-lg shadow-lg z-50 max-h-96 overflow-y-auto"
					>
						<div
							v-if="searchResults.length === 0 && searchQuery"
							class="p-4 text-muted-foreground text-center"
						>
							No results found for "{{ searchQuery }}"
						</div>
						<div
							v-for="(group, category) in groupedResults"
							:key="category"
							class="border-b border-border last:border-b-0"
						>
							<div
								class="px-3 py-2 text-xs font-semibold text-muted-foreground uppercase tracking-wider bg-muted/50"
							>
								{{ category }}
							</div>
							<div
								v-for="result in group"
								:key="result.id"
								@click="navigateToResult(result)"
								class="px-4 py-3 hover:bg-muted cursor-pointer flex items-center gap-3"
							>
								<div
									class="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center"
								>
									<component :is="result.icon" class="w-4 h-4 text-primary" />
								</div>
								<div class="flex-1">
									<div class="font-medium text-foreground">
										{{ result.title }}
									</div>
									<div class="text-sm text-muted-foreground">
										{{ result.description }}
									</div>
								</div>
								<kbd class="px-2 py-1 text-xs bg-muted rounded">{{
									result.shortcut
								}}</kbd>
							</div>
						</div>
					</div>
				</div>
			</div>

			<!-- Header Actions -->
			<div class="flex items-center gap-4">
				<!-- Notifications -->
				<button
					@click="showNotifications = !showNotifications"
					class="relative p-2 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
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
					>
						<path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9" />
						<path d="M10.3 21a1.94 1.94 0 0 0 3.4 0" />
					</svg>
					<span
						v-if="unreadNotifications > 0"
						class="absolute -top-1 -right-1 w-5 h-5 bg-destructive text-destructive-foreground text-xs rounded-full flex items-center justify-center"
					>
						{{ unreadNotifications }}
					</span>
				</button>

				<!-- Quick Actions -->
				<div class="relative">
					<button
						@click="showQuickActions = !showQuickActions"
						class="p-2 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
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
						>
							<path
								d="M12 2v20M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"
							/>
						</svg>
					</button>

					<div
						v-if="showQuickActions"
						class="fixed right-4 top-[4.5rem] w-60 bg-card border border-border rounded-lg shadow-lg z-50"
					>
						<div class="p-2">
							<div
								class="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2 px-2"
							>
								Quick Actions
							</div>
							<button
								v-for="action in quickActions"
								:key="action.id"
								@click="executeQuickAction(action)"
								class="w-full flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-muted transition-colors text-left"
							>
								<component :is="action.icon" class="w-4 h-4 text-primary" />
								<span class="text-foreground">{{ action.label }}</span>
							</button>
						</div>
					</div>
				</div>

				<!-- User Menu -->
				<div v-if="authStore.user" class="flex items-center gap-2">
					<img
						v-if="authStore.avatarUrl"
						:src="authStore.avatarUrl"
						class="w-8 h-8 rounded-full"
					/>
					<div
						v-else
						class="w-8 h-8 bg-gradient-to-br from-blue-500 to-purple-600 rounded-full flex items-center justify-center"
					>
						<span class="text-white text-sm font-bold">{{
							authStore.user.username.charAt(0)
						}}</span>
					</div>
				</div>
			</div>
		</div>

		<!-- Notifications Panel -->
		<div
			v-if="showNotifications"
			class="fixed right-4 top-[4.5rem] w-80 bg-card border border-border rounded-lg shadow-lg z-50"
		>
			<div class="p-4 border-b border-border">
				<div class="flex items-center justify-between">
					<h3 class="font-semibold text-foreground">Notifications</h3>
					<button
						@click="markAllAsRead"
						class="text-sm text-primary hover:text-primary/80"
					>
						Mark all as read
					</button>
				</div>
			</div>
			<div class="max-h-96 overflow-y-auto">
				<div
					v-if="notifications.length === 0"
					class="p-8 text-center text-muted-foreground"
				>
					No new notifications
				</div>
				<div
					v-for="notification in notifications"
					:key="notification.id"
					class="p-4 border-b border-border last:border-b-0 hover:bg-muted/50"
				>
					<div class="flex items-start gap-3">
						<div
							class="w-2 h-2 bg-primary rounded-full mt-2 flex-shrink-0"
							v-if="!notification.read"
						></div>
						<div class="flex-1">
							<div class="font-medium text-foreground">
								{{ notification.title }}
							</div>
							<div class="text-sm text-muted-foreground">
								{{ notification.message }}
							</div>
							<div class="text-xs text-muted-foreground mt-1">
								{{ formatTime(notification.timestamp) }}
							</div>
						</div>
					</div>
				</div>
			</div>
		</div>
	</header>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from 'vue';
import { useRouter, useRoute } from 'vue-router';
import { useToastStore } from '@/stores/toast';
import { useAuthStore } from '@/stores/auth';
import { useGuildsStore } from '@/stores/guilds';
import { storeToRefs } from 'pinia';

const router = useRouter();
const route = useRoute();
const toastStore = useToastStore();
const authStore = useAuthStore();
const guildsStore = useGuildsStore();
const { currentGuild } = storeToRefs(guildsStore);
const { getGuildIconUrl } = guildsStore;

const searchQuery = ref('');
const showResults = ref(false);
const showNotifications = ref(false);
const showQuickActions = ref(false);
const searchResults = ref<any[]>([]);

const unreadNotifications = ref(3);
const notifications = ref([
	{
		id: '1',
		title: 'New ticket created',
		message: 'User @john_doe created a support ticket',
		timestamp: new Date(Date.now() - 5 * 60 * 1000),
		read: false,
	},
	{
		id: '2',
		title: 'Moderation action taken',
		message: 'User @spammer was banned by @moderator',
		timestamp: new Date(Date.now() - 15 * 60 * 1000),
		read: false,
	},
	{
		id: '3',
		title: 'Server milestone reached',
		message: 'Your server has reached 1,000 members!',
		timestamp: new Date(Date.now() - 60 * 60 * 1000),
		read: false,
	},
]);

const quickActions = ref([
	{ id: 'create-ticket', label: 'Create Ticket', icon: 'TicketIcon' },
	{ id: 'ban-user', label: 'Ban User', icon: 'BanIcon' },
	{ id: 'clear-messages', label: 'Clear Messages', icon: 'TrashIcon' },
	{ id: 'create-poll', label: 'Create Poll', icon: 'PollIcon' },
	{ id: 'backup-server', label: 'Backup Server', icon: 'BackupIcon' },
]);

// Search functionality
const searchableItems = [
	// Commands
	{
		id: 'cmd-welcome',
		title: 'Welcome Command',
		description: 'Custom welcome command',
		category: 'Commands',
		type: 'command',
		route: '/custom-commands',
		icon: 'CommandIcon',
		shortcut: 'Ctrl+1',
	},
	{
		id: 'cmd-rules',
		title: 'Rules Command',
		description: 'Display server rules',
		category: 'Commands',
		type: 'command',
		route: '/custom-commands',
		icon: 'CommandIcon',
		shortcut: 'Ctrl+2',
	},

	// Settings
	{
		id: 'set-moderation',
		title: 'Moderation Settings',
		description: 'Configure auto-moderation',
		category: 'Settings',
		type: 'setting',
		route: '/moderation',
		icon: 'SettingsIcon',
		shortcut: 'Ctrl+M',
	},
	{
		id: 'set-logging',
		title: 'Logging Settings',
		description: 'Configure server logging',
		category: 'Settings',
		type: 'setting',
		route: '/logging',
		icon: 'SettingsIcon',
		shortcut: 'Ctrl+L',
	},
	{
		id: 'set-leveling',
		title: 'Leveling System',
		description: 'Configure XP and levels',
		category: 'Settings',
		type: 'setting',
		route: '/leveling',
		icon: 'SettingsIcon',
		shortcut: 'Ctrl+X',
	},

	// Users
	{
		id: 'user-admin',
		title: '@AdminUser',
		description: 'Server administrator',
		category: 'Users',
		type: 'user',
		route: '/moderation',
		icon: 'UserIcon',
		shortcut: '',
	},
	{
		id: 'user-mod',
		title: '@ModeratorBot',
		description: 'Moderation bot',
		category: 'Users',
		type: 'user',
		route: '/moderation',
		icon: 'UserIcon',
		shortcut: '',
	},

	// Pages
	{
		id: 'page-dashboard',
		title: 'Dashboard',
		description: 'Server overview and stats',
		category: 'Pages',
		type: 'page',
		route: '/dashboard',
		icon: 'DashboardIcon',
		shortcut: 'Ctrl+D',
	},
	{
		id: 'page-analytics',
		title: 'Analytics',
		description: 'Server analytics and reports',
		category: 'Pages',
		type: 'page',
		route: '/analytics',
		icon: 'AnalyticsIcon',
		shortcut: 'Ctrl+A',
	},
	{
		id: 'page-tickets',
		title: 'Tickets',
		description: 'Support ticket management',
		category: 'Pages',
		type: 'page',
		route: '/tickets',
		icon: 'TicketIcon',
		shortcut: 'Ctrl+T',
	},
];

const groupedResults = computed(() => {
	const groups: Record<string, any[]> = {};
	searchResults.value.forEach((result) => {
		if (!groups[result.category]) {
			groups[result.category] = [];
		}
		groups[result.category].push(result);
	});
	return groups;
});

let searchTimeout: NodeJS.Timeout;

const handleSearch = () => {
	clearTimeout(searchTimeout);
	searchTimeout = setTimeout(() => {
		if (searchQuery.value.trim()) {
			searchResults.value = searchableItems
				.filter(
					(item) =>
						item.title
							.toLowerCase()
							.includes(searchQuery.value.toLowerCase()) ||
						item.description
							.toLowerCase()
							.includes(searchQuery.value.toLowerCase())
				)
				.slice(0, 10);
		} else {
			searchResults.value = [];
		}
	}, 300);
};

const performSearch = () => {
	if (searchResults.value.length > 0) {
		navigateToResult(searchResults.value[0]);
	}
};

const navigateToResult = (result: any) => {
	const guildId = route.params.guildId;
	router.push(`/server/${guildId}${result.route}`);
	showResults.value = false;
	searchQuery.value = '';
	searchResults.value = [];
};

const executeQuickAction = (action: any) => {
	showQuickActions.value = false;
	toastStore.addToast(`Executing ${action.label}...`, 'info');

	// Handle specific quick actions
	switch (action.id) {
		case 'create-ticket':
			// Navigate to tickets page or open modal
			break;
		case 'ban-user':
			// Open ban user modal
			break;
		// Add more cases as needed
	}
};

const markAllAsRead = () => {
	notifications.value.forEach((n) => (n.read = true));
	unreadNotifications.value = 0;
};

const formatTime = (timestamp: Date) => {
	const now = new Date();
	const diff = now.getTime() - timestamp.getTime();
	const minutes = Math.floor(diff / 60000);

	if (minutes < 1) return 'Just now';
	if (minutes < 60) return `${minutes}m ago`;
	if (minutes < 1440) return `${Math.floor(minutes / 60)}h ago`;
	return `${Math.floor(minutes / 1440)}d ago`;
};

// Keyboard shortcuts
const handleKeydown = (e: KeyboardEvent) => {
	if (e.ctrlKey || e.metaKey) {
		switch (e.key) {
			case 'k':
				e.preventDefault();
				document.querySelector('input[placeholder*="Search"]')?.focus();
				break;
			case 'd':
				e.preventDefault();
				router.push(`/server/${route.params.guildId}/dashboard`);
				break;
			case 'm':
				e.preventDefault();
				router.push(`/server/${route.params.guildId}/moderation`);
				break;
			case 'l':
				e.preventDefault();
				router.push(`/server/${route.params.guildId}/logging`);
				break;
			case 't':
				e.preventDefault();
				router.push(`/server/${route.params.guildId}/tickets`);
				break;
			case 'a':
				e.preventDefault();
				router.push(`/server/${route.params.guildId}/analytics`);
				break;
		}
	}
};

// Click outside to close dropdowns
const handleClickOutside = (e: Event) => {
	const target = e.target as HTMLElement;
	if (!target.closest('.relative')) {
		showResults.value = false;
		showNotifications.value = false;
		showQuickActions.value = false;
	}
};

onMounted(() => {
	document.addEventListener('keydown', handleKeydown);
	document.addEventListener('click', handleClickOutside);
});

onUnmounted(() => {
	document.removeEventListener('keydown', handleKeydown);
	document.removeEventListener('click', handleClickOutside);
});
</script>
