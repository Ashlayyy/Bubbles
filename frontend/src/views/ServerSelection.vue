<template>
	<div
		class="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950"
	>
		<!-- Clean Header -->
		<header
			class="border-b border-slate-800/50 bg-slate-900/80 backdrop-blur-lg"
		>
			<div class="max-w-7xl mx-auto px-6 py-6">
				<div class="flex items-center justify-between">
					<div class="flex items-center space-x-4">
						<div
							class="w-12 h-12 bg-gradient-to-br from-blue-500 to-purple-600 rounded-2xl flex items-center justify-center shadow-lg"
						>
							<span class="text-white font-bold text-xl">B</span>
						</div>
						<div>
							<h1 class="text-2xl font-bold text-white">Bubbles Dashboard</h1>
							<p class="text-sm text-slate-400">Discord Server Management</p>
						</div>
					</div>

					<div
						v-if="authStore.isAuthenticated && authStore.user"
						class="flex items-center space-x-4"
					>
						<div
							class="flex items-center space-x-3 bg-slate-800/60 rounded-xl px-4 py-3 border border-slate-700/50"
						>
							<img
								v-if="authStore.avatarUrl"
								:src="authStore.avatarUrl"
								alt="User Avatar"
								class="w-8 h-8 rounded-full"
							/>
							<div
								v-else
								class="w-8 h-8 bg-gradient-to-br from-orange-500 to-red-500 rounded-full flex items-center justify-center"
							>
								<span class="text-white text-sm font-bold">{{
									authStore.user.username.charAt(0).toUpperCase()
								}}</span>
							</div>
							<span class="text-sm font-medium text-white">{{
								authStore.user.username
							}}</span>
						</div>
					</div>
				</div>
			</div>
		</header>

		<!-- Main Content -->
		<main class="max-w-7xl mx-auto px-6 py-16">
			<!-- Loading State -->
			<div v-if="loading" class="text-center text-slate-300">
				<p>Loading your servers...</p>
			</div>

			<!-- Empty State (No servers at all) -->
			<div v-else-if="guilds.length === 0" class="text-center">
				<h2 class="text-3xl font-bold text-white mb-4">
					No servers to display
				</h2>
				<p class="text-lg text-slate-400">
					Invite Bubbles to a server to get started.
				</p>
			</div>

			<!-- Content with servers -->
			<div v-else>
				<!-- Search and Title -->
				<div class="mb-12 text-center">
					<h2 class="text-4xl font-bold text-white mb-4">Select a Server</h2>
					<p class="text-lg text-slate-400 max-w-2xl mx-auto">
						Choose a server to manage with Bubbles. You can search for a server
						by name below.
					</p>
					<div class="mt-8 relative max-w-lg mx-auto">
						<span
							class="absolute inset-y-0 left-0 flex items-center pl-4 text-slate-500"
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
								<circle cx="11" cy="11" r="8" />
								<path d="m21 21-4.3-4.3" />
							</svg>
						</span>
						<input
							type="text"
							v-model="searchQuery"
							placeholder="Search for a server..."
							class="w-full bg-slate-900 border border-slate-700 rounded-xl py-3 pl-12 pr-4 text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 transition-colors"
						/>
					</div>
				</div>

				<!-- Manageable Servers -->
				<div v-if="filteredManage.length" class="mb-16">
					<h3 class="text-2xl font-bold text-white mb-6">Manage Servers</h3>

					<div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
						<div
							v-for="guild in filteredManage"
							:key="guild.id"
							class="group bg-slate-900 border border-slate-800 rounded-2xl p-6 transition-colors duration-300 hover:bg-slate-800/50 hover:border-slate-700 flex flex-col"
						>
							<div>
								<div class="flex items-center space-x-4 mb-6">
									<img
										v-if="guild.icon"
										:src="getGuildIconUrl(guild)"
										:alt="guild.name"
										class="w-16 h-16 rounded-xl shadow-lg"
									/>
									<div
										v-else
										class="w-16 h-16 rounded-xl flex items-center justify-center shadow-lg bg-gradient-to-br from-purple-500 to-indigo-500"
									>
										<span class="text-white font-bold text-2xl">{{
											guild.name.charAt(0)
										}}</span>
									</div>
									<div class="flex-1">
										<h3
											class="text-xl font-bold text-white group-hover:text-blue-400 transition-colors duration-300"
										>
											{{ guild.name }}
										</h3>
									</div>
									<div
										v-if="getUserRole(guild)"
										:class="getRoleBadgeClass(getUserRole(guild))"
										class="px-3 py-1 rounded-full text-xs font-semibold uppercase tracking-wide shrink-0"
									>
										{{ getUserRole(guild) }}
									</div>
								</div>
							</div>

							<router-link
								:to="`/server/${guild.id}/dashboard`"
								class="group w-full bg-blue-600 hover:bg-blue-700 text-white font-semibold py-3 px-5 rounded-lg transition-colors flex items-center justify-center space-x-2 mt-auto"
							>
								<span>Manage Server</span>
								<svg
									class="w-5 h-5 group-hover:translate-x-1 transition-transform duration-300"
									fill="none"
									stroke="currentColor"
									viewBox="0 0 24 24"
									stroke-width="2"
									stroke-linecap="round"
									stroke-linejoin="round"
								>
									<path d="M5 12h14" />
									<path d="m12 5 7 7-7 7" />
								</svg>
							</router-link>
						</div>
					</div>
				</div>

				<!-- Invite Bot Servers -->
				<div v-if="filteredInvite.length">
					<h3 class="text-2xl font-bold text-white mb-6">
						Invite Bubbles to a Server
					</h3>

					<div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
						<div
							v-for="guild in filteredInvite"
							:key="guild.id"
							class="group bg-slate-900 border border-slate-800 rounded-2xl p-6 transition-colors duration-300 hover:bg-slate-800/50 hover:border-slate-700 flex flex-col"
						>
							<div class="flex items-center space-x-4 mb-6">
								<img
									v-if="guild.icon"
									:src="getGuildIconUrl(guild)"
									:alt="guild.name"
									class="w-16 h-16 rounded-xl shadow-lg"
								/>
								<div
									v-else
									class="w-16 h-16 rounded-xl flex items-center justify-center shadow-lg bg-gradient-to-br from-purple-500 to-indigo-500"
								>
									<span class="text-white font-bold text-2xl">{{
										guild.name.charAt(0)
									}}</span>
								</div>
								<h3
									class="text-xl font-bold text-white group-hover:text-blue-400 transition-colors duration-300"
								>
									{{ guild.name }}
								</h3>
							</div>

							<a
								:href="getInviteUrl(guild.id)"
								target="_blank"
								rel="noopener"
								class="group w-full bg-emerald-600 hover:bg-emerald-700 text-white font-semibold py-3 px-5 rounded-lg transition-colors flex items-center justify-center space-x-2 mt-auto"
							>
								<span>Invite to Server</span>
								<svg
									class="w-5 h-5 group-hover:-translate-y-0.5 transition-transform duration-300"
									fill="none"
									stroke="currentColor"
									viewBox="0 0 24 24"
									stroke-width="2"
									stroke-linecap="round"
									stroke-linejoin="round"
								>
									<path d="M12 5v14" />
									<path d="M5 12h14" />
								</svg>
							</a>
						</div>
					</div>
				</div>
			</div>
		</main>
	</div>
</template>

<script setup lang="ts">
import { onMounted, ref, computed } from 'vue';
import { useGuildsStore, type Guild } from '@/stores/guilds';
import { useAuthStore } from '@/stores/auth';
import { storeToRefs } from 'pinia';

const searchQuery = ref('');

const guildsStore = useGuildsStore();
const { guilds, loading } = storeToRefs(guildsStore);
const { fetchGuilds, getGuildIconUrl } = guildsStore;

const authStore = useAuthStore();

const manageGuilds = computed<Guild[]>(() =>
	guilds.value.filter((g) => g.hasBubbles)
);

const inviteGuilds = computed<Guild[]>(() =>
	guilds.value.filter((g) => !g.hasBubbles)
);

const filteredManage = computed(() => {
	const q = searchQuery.value.trim().toLowerCase();
	if (!q) return manageGuilds.value;
	return manageGuilds.value.filter((g) => g.name.toLowerCase().includes(q));
});

const filteredInvite = computed(() => {
	const q = searchQuery.value.trim().toLowerCase();
	if (!q) return inviteGuilds.value;
	return inviteGuilds.value.filter((g) => g.name.toLowerCase().includes(q));
});

const CLIENT_ID = import.meta.env.VITE_DISCORD_CLIENT_ID || '';
const getInviteUrl = (guildId?: string) => {
	const base = `https://discord.com/api/oauth2/authorize?client_id=${CLIENT_ID}&permissions=8&scope=bot%20applications.commands`;
	return guildId
		? `${base}&guild_id=${guildId}&disable_guild_select=true`
		: base;
};

onMounted(() => {
	// The navigation guard in main.ts ensures we are authenticated.
	if (authStore.isAuthenticated) {
		fetchGuilds();
	}
});

const getUserRole = (guild: Guild) => {
	if (guild.owner) return 'owner';
	if (
		guild.permissions &&
		(BigInt(guild.permissions) & BigInt(8)) === BigInt(8)
	) {
		return 'admin';
	}
	return null;
};

const getRoleBadgeClass = (role: string | null) => {
	switch (role) {
		case 'owner':
			return 'bg-gradient-to-r from-amber-500/20 to-yellow-500/20 text-amber-300 border border-amber-500/40';
		case 'admin':
			return 'bg-gradient-to-r from-red-500/20 to-pink-500/20 text-red-300 border border-red-500/40';
		default:
			return 'bg-gradient-to-r from-green-500/20 to-emerald-500/20 text-green-300 border border-green-500/40';
	}
};

const formatCount = (count: number | undefined) => {
	if (count === undefined) return 'N/A';
	if (count >= 1000) {
		return (count / 1000).toFixed(1) + 'k';
	}
	return count.toString();
};
</script>
