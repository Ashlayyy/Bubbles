<template>
	<div
		class="fixed left-0 top-0 h-full w-64 bg-card border-r border-border flex flex-col"
	>
		<!-- Header (clickable) -->
		<router-link
			to="/"
			class="p-6 border-b border-border block hover:bg-muted/50 transition-colors"
		>
			<div class="flex items-center space-x-3">
				<!-- back arrow -->
				<svg
					xmlns="http://www.w3.org/2000/svg"
					width="18"
					height="18"
					viewBox="0 0 24 24"
					fill="none"
					stroke="currentColor"
					stroke-width="2"
					stroke-linecap="round"
					stroke-linejoin="round"
					class="text-muted-foreground"
				>
					<path d="M15 18l-6-6 6-6" />
				</svg>
				<div
					class="w-10 h-10 bg-gradient-to-br from-blue-500 to-purple-600 rounded-xl flex items-center justify-center"
				>
					<span class="text-primary-foreground font-bold text-lg">B</span>
				</div>
				<div>
					<h1 class="text-lg font-bold text-foreground">Bubbles</h1>
					<p class="text-xs text-muted-foreground">Dashboard</p>
				</div>
			</div>
		</router-link>

		<!-- Navigation -->
		<nav class="flex-1 p-4 space-y-2 overflow-y-auto">
			<!-- Dashboard -->
			<router-link
				:to="`/server/${guildId}/dashboard`"
				class="flex items-center space-x-3 px-3 py-2 rounded-lg text-muted-foreground hover:bg-secondary hover:text-foreground transition-colors"
				:class="{ 'bg-secondary text-foreground': $route.name === 'Dashboard' }"
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
					<rect width="7" height="9" x="3" y="3" rx="1" />
					<rect width="7" height="5" x="14" y="3" rx="1" />
					<rect width="7" height="9" x="14" y="12" rx="1" />
					<rect width="7" height="5" x="3" y="16" rx="1" />
				</svg>
				<span>Dashboard</span>
			</router-link>

			<!-- Analytics -->
			<router-link
				:to="`/server/${guildId}/analytics`"
				class="flex items-center space-x-3 px-3 py-2 rounded-lg text-muted-foreground hover:bg-secondary hover:text-foreground transition-colors"
				:class="{ 'bg-secondary text-foreground': $route.name === 'Analytics' }"
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
					<path d="M3 3v18h18" />
					<path d="m19 9-5 5-4-4-3 3" />
				</svg>
				<span>Analytics</span>
			</router-link>

			<!-- Moderation -->
			<router-link
				:to="`/server/${guildId}/moderation`"
				class="flex items-center space-x-3 px-3 py-2 rounded-lg text-muted-foreground hover:bg-secondary hover:text-foreground transition-colors"
				:class="{
					'bg-secondary text-foreground': $route.name === 'Moderation',
				}"
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
					<path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10" />
					<path d="m9 12 2 2 4-4" />
				</svg>
				<span>Moderation</span>
			</router-link>

			<!-- Appeals -->
			<router-link
				:to="`/server/${guildId}/appeals`"
				class="flex items-center space-x-3 px-3 py-2 rounded-lg text-muted-foreground hover:bg-secondary hover:text-foreground transition-colors"
				:class="{ 'bg-secondary text-foreground': $route.name === 'Appeals' }"
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
						d="M14 9V5a3 3 0 0 0-3-3l-4 9v11h11.28a2 2 0 0 0 2-1.7l1.38-9a2 2 0 0 0-2-2.3zM7 22H4a2 2 0 0 1-2-2v-7a2 2 0 0 1 2-2h3"
					/>
				</svg>
				<span>Appeals</span>
			</router-link>

			<!-- Tickets -->
			<router-link
				:to="`/server/${guildId}/tickets`"
				class="flex items-center space-x-3 px-3 py-2 rounded-lg text-muted-foreground hover:bg-secondary hover:text-foreground transition-colors"
				:class="{ 'bg-secondary text-foreground': $route.name === 'Tickets' }"
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
						d="M2 9a3 3 0 0 1 0 6v2a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-2a3 3 0 0 1 0-6V7a2 2 0 0 0-2-2H4a2 2 0 0 0-2 2Z"
					/>
					<path d="M13 5v2" />
					<path d="M13 17v2" />
					<path d="M13 11v2" />
				</svg>
				<span>Tickets</span>
			</router-link>

			<!-- Auto Roles -->
			<router-link
				:to="`/server/${guildId}/autoroles`"
				class="flex items-center space-x-3 px-3 py-2 rounded-lg text-muted-foreground hover:bg-secondary hover:text-foreground transition-colors"
				:class="{ 'bg-secondary text-foreground': $route.name === 'Autoroles' }"
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
					<path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
					<circle cx="9" cy="7" r="4" />
					<path
						d="m22 21-3-3m0 0a5.5 5.5 0 1 0-7.78-7.78 5.5 5.5 0 0 0 7.78 7.78Z"
					/>
				</svg>
				<span>Auto Roles</span>
			</router-link>

			<!-- Reaction Roles -->
			<router-link
				:to="`/server/${guildId}/reaction-roles`"
				class="flex items-center space-x-3 px-3 py-2 rounded-lg text-muted-foreground hover:bg-secondary hover:text-foreground transition-colors"
				:class="{
					'bg-secondary text-foreground': $route.name === 'ReactionRoles',
				}"
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
					<circle cx="12" cy="12" r="10" />
					<path d="M8 14s1.5 2 4 2 4-2 4-2" />
					<line x1="9" y1="9" x2="9.01" y2="9" />
					<line x1="15" y1="9" x2="15.01" y2="9" />
				</svg>
				<span>Reaction Roles</span>
			</router-link>

			<!-- Custom Commands -->
			<router-link
				:to="`/server/${guildId}/custom-commands`"
				class="flex items-center space-x-3 px-3 py-2 rounded-lg text-muted-foreground hover:bg-secondary hover:text-foreground transition-colors"
				:class="{
					'bg-secondary text-foreground': $route.name === 'CustomCommands',
				}"
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
					<polyline points="16 18 22 12 16 6" />
					<polyline points="8 6 2 12 8 18" />
				</svg>
				<span>Custom Commands</span>
			</router-link>

			<!-- Command Aliases -->
			<router-link
				:to="`/server/${guildId}/command-aliases`"
				class="flex items-center space-x-3 px-3 py-2 rounded-lg text-muted-foreground hover:bg-secondary hover:text-foreground transition-colors"
				:class="{
					'bg-secondary text-foreground': $route.name === 'CommandAliases',
				}"
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
					<path d="M4 7V4a2 2 0 0 1 2-2h8.5L20 7.5V20a2 2 0 0 1-2 2h-6" />
					<path d="M14 2v4a2 2 0 0 0 2 2h4" />
					<path d="M5 12h6" />
					<path d="M5 16h6" />
					<path d="M2 20h6" />
				</svg>
				<span>Command Aliases</span>
			</router-link>

			<!-- Leveling -->
			<router-link
				:to="`/server/${guildId}/leveling`"
				class="flex items-center space-x-3 px-3 py-2 rounded-lg text-muted-foreground hover:bg-secondary hover:text-foreground transition-colors"
				:class="{ 'bg-secondary text-foreground': $route.name === 'Leveling' }"
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
					<path d="M6 9H4.5a2.5 2.5 0 0 1 0-5H6" />
					<path d="M18 9h1.5a2.5 2.5 0 0 0 0-5H18" />
					<path d="M4 22h16" />
					<path
						d="M10 14.66V17c0 .55-.47.98-.97 1.21C7.85 18.75 7 20.24 7 22"
					/>
					<path
						d="M14 14.66V17c0 .55.47.98.97 1.21C16.15 18.75 17 20.24 17 22"
					/>
					<path d="M18 2H6v7a6 6 0 0 0 12 0V2Z" />
				</svg>
				<span>Leveling</span>
			</router-link>

			<!-- Audit Log -->
			<router-link
				:to="`/server/${guildId}/audit-log`"
				class="flex items-center space-x-3 px-3 py-2 rounded-lg text-muted-foreground hover:bg-secondary hover:text-foreground transition-colors"
				:class="{ 'bg-secondary text-foreground': $route.name === 'AuditLog' }"
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
						d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"
					/>
					<polyline points="14,2 14,8 20,8" />
					<line x1="16" y1="13" x2="8" y2="13" />
					<line x1="16" y1="17" x2="8" y2="17" />
					<polyline points="10,9 9,9 8,9" />
				</svg>
				<span>Audit Log</span>
			</router-link>

			<!-- Logging -->
			<router-link
				:to="`/server/${guildId}/logging`"
				class="flex items-center space-x-3 px-3 py-2 rounded-lg text-muted-foreground hover:bg-secondary hover:text-foreground transition-colors"
				:class="{ 'bg-secondary text-foreground': $route.name === 'Logging' }"
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
						d="M4 19.5v-15A2.5 2.5 0 0 1 6.5 2H20v20H6.5a2.5 2.5 0 0 1 0-5H20"
					/>
				</svg>
				<span>Logging</span>
			</router-link>

			<!-- Automation -->
			<router-link
				:to="`/server/${guildId}/automation`"
				class="flex items-center space-x-3 px-3 py-2 rounded-lg text-muted-foreground hover:bg-secondary hover:text-foreground transition-colors"
				:class="{
					'bg-secondary text-foreground': $route.name === 'Automation',
				}"
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
					<path d="M12 2v6" />
					<path d="m16.2 7.8 2.9-2.9" />
					<path d="M18 12h6" />
					<path d="m16.2 16.2 2.9 2.9" />
					<path d="M12 18v6" />
					<path d="m4.9 19.1 2.9-2.9" />
					<path d="M2 12h6" />
					<path d="m4.9 4.9 2.9 2.9" />
				</svg>
				<span>Automation</span>
			</router-link>

			<!-- Applications -->
			<router-link
				:to="`/server/${guildId}/applications`"
				class="flex items-center space-x-3 px-3 py-2 rounded-lg text-muted-foreground hover:bg-secondary hover:text-foreground transition-colors"
				:class="{
					'bg-secondary text-foreground': $route.name === 'Applications',
				}"
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
					<rect width="18" height="18" x="3" y="4" rx="2" ry="2" />
					<line x1="16" y1="2" x2="16" y2="6" />
					<line x1="8" y1="2" x2="8" y2="6" />
					<line x1="3" y1="10" x2="21" y2="10" />
				</svg>
				<span>Applications</span>
			</router-link>

			<!-- Entertainment -->
			<router-link
				:to="`/server/${guildId}/entertainment`"
				class="flex items-center space-x-3 px-3 py-2 rounded-lg text-muted-foreground hover:bg-secondary hover:text-foreground transition-colors"
				:class="{
					'bg-secondary text-foreground': $route.name === 'Entertainment',
				}"
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
					<line x1="6" y1="3" x2="6" y2="15" />
					<circle cx="18" cy="6" r="3" />
					<circle cx="6" cy="18" r="3" />
					<path
						d="m18 9 2.26-2.26a1.5 1.5 0 0 1 2.12 0l1.38 1.38a1.5 1.5 0 0 1 0 2.12L21.5 12.5"
					/>
				</svg>
				<span>Entertainment</span>
			</router-link>

			<!-- Reminders -->
			<router-link
				:to="`/server/${guildId}/reminders`"
				class="flex items-center space-x-3 px-3 py-2 rounded-lg text-muted-foreground hover:bg-secondary hover:text-foreground transition-colors"
				:class="{ 'bg-secondary text-foreground': $route.name === 'Reminders' }"
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
					<circle cx="12" cy="12" r="10" />
					<polyline points="12,6 12,12 16,14" />
				</svg>
				<span>Reminders</span>
			</router-link>

			<!-- Starboard -->
			<router-link
				:to="`/server/${guildId}/starboard`"
				class="flex items-center space-x-3 px-3 py-2 rounded-lg text-muted-foreground hover:bg-secondary hover:text-foreground transition-colors"
				:class="{ 'bg-secondary text-foreground': $route.name === 'Starboard' }"
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
					<polygon
						points="12,2 15.09,8.26 22,9.27 17,14.14 18.18,21.02 12,17.77 5.82,21.02 7,14.14 2,9.27 8.91,8.26"
					/>
				</svg>
				<span>Starboard</span>
			</router-link>

			<!-- Welcome -->
			<router-link
				:to="`/server/${guildId}/welcome`"
				class="flex items-center space-x-3 px-3 py-2 rounded-lg text-muted-foreground hover:bg-secondary hover:text-foreground transition-colors"
				:class="{ 'bg-secondary text-foreground': $route.name === 'Welcome' }"
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
					<path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
					<circle cx="9" cy="7" r="4" />
					<line x1="19" y1="8" x2="19" y2="14" />
					<line x1="22" y1="11" x2="16" y2="11" />
				</svg>
				<span>Welcome</span>
			</router-link>

			<!-- Settings -->
			<router-link
				:to="`/server/${guildId}/settings`"
				class="flex items-center space-x-3 px-3 py-2 rounded-lg text-muted-foreground hover:bg-secondary hover:text-foreground transition-colors"
				:class="{ 'bg-secondary text-foreground': $route.name === 'Settings' }"
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
						d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z"
					/>
					<circle cx="12" cy="12" r="3" />
				</svg>
				<span>Settings</span>
			</router-link>
		</nav>

		<!-- Footer -->
		<div class="p-4 border-t border-border">
			<div class="flex items-center justify-between">
				<div class="flex items-center space-x-2">
					<div>
						<!-- Guild icon -->
						<img
							v-if="guildIconUrl"
							:src="guildIconUrl"
							class="w-8 h-8 rounded-full object-cover"
						/>
						<div
							v-else
							class="w-8 h-8 bg-gradient-to-br from-green-500 to-blue-500 rounded-full flex items-center justify-center"
						>
							<span class="text-primary-foreground text-xs font-bold">{{
								currentGuild?.name?.charAt(0) || 'D'
							}}</span>
						</div>
					</div>
					<div>
						<p
							class="text-sm font-medium text-foreground truncate max-w-[120px]"
						>
							{{ currentGuild?.name || 'Demo Server' }}
						</p>
						<p class="text-xs text-muted-foreground">
							{{ memberCountDisplay }}
						</p>
					</div>
				</div>
				<ThemeToggle />
			</div>
		</div>
	</div>
</template>

<script setup lang="ts">
import { computed, onMounted } from 'vue';
import { useRoute } from 'vue-router';
import { useGuildsStore } from '@/stores/guilds';
import { storeToRefs } from 'pinia';
import ThemeToggle from '@/components/ThemeToggle.vue';

const route = useRoute();
const guildsStore = useGuildsStore();
const { currentGuild, currentGuildStats } = storeToRefs(guildsStore);
const { getGuildIconUrl } = guildsStore;

const guildId = computed(() => (route.params.guildId as string) || 'demo');
const memberCount = computed(() => {
	const count =
		currentGuildStats.value?.memberCount ?? currentGuild.value?.memberCount;
	return typeof count === 'number' ? new Intl.NumberFormat().format(count) : '';
});

const memberCountDisplay = computed(() =>
	memberCount.value ? `${memberCount.value} members` : '—'
);

const guildIconUrl = computed(() =>
	currentGuild.value ? getGuildIconUrl(currentGuild.value) : null
);

onMounted(() => {
	if (!currentGuild.value && guildId.value && guildId.value !== 'demo') {
		guildsStore.fetchGuildStats(guildId.value);
	}

	// If stats not yet loaded for current guild, fetch them (ensures memberCount)
	if (!currentGuildStats.value && guildId.value && guildId.value !== 'demo') {
		guildsStore.fetchGuildStats(guildId.value);
	}

	// Ensure currentGuild is set from guilds list if missing (edge cases)
	if (!currentGuild.value && guildId.value !== 'demo') {
		const found = guildsStore.guilds.find((g) => g.id === guildId.value);
		if (found) guildsStore.setCurrentGuild(found);
	}
});
</script>
