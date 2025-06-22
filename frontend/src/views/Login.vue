<template>
	<div
		class="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 flex items-center justify-center"
	>
		<div
			class="bg-white/10 backdrop-blur-md rounded-3xl border border-white/20 p-8 w-full max-w-md"
		>
			<h1 class="text-3xl font-bold text-white text-center mb-8">
				Login to Bubbles
			</h1>
			<div class="space-y-4">
				<button
					@click="handleLogin"
					class="w-full bg-indigo-600 hover:bg-indigo-700 text-white py-3 px-6 rounded-xl font-semibold transition-colors"
				>
					Login with Discord
				</button>
			</div>
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
