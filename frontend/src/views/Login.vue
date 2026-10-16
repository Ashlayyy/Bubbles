<template>
	<div
		class="min-h-screen bg-gradient-to-br from-slate-950 via-indigo-950 to-slate-950 flex items-center justify-center px-6"
	>
		<div
			class="bg-white/10 backdrop-blur-md rounded-3xl border border-white/20 p-10 w-full max-w-lg"
		>
			<div
				class="w-14 h-14 mx-auto mb-6 bg-gradient-to-br from-blue-500 to-purple-600 rounded-2xl flex items-center justify-center"
			>
				<span class="text-white font-bold text-2xl">B</span>
			</div>
			<h1 class="text-3xl font-bold text-white text-center mb-3">
				Bubbles
			</h1>
			<p class="text-slate-300 text-center mb-8">
				Moderation, tickets, welcome messages, leveling, giveaways and logging
				for your Discord server.
			</p>
			<button
				@click="handleLogin"
				class="w-full bg-indigo-600 hover:bg-indigo-700 text-white py-3 px-6 rounded-xl font-semibold transition-colors"
			>
				Login with Discord
			</button>
		</div>
	</div>
</template>

<script setup lang="ts">
import { useAuthStore } from '@/stores/auth';

const authStore = useAuthStore();

const handleLogin = () => {
	authStore.login();
};
</script>
