<template>
	<div class="flex items-center justify-center min-h-screen bg-gray-900">
		<div class="text-white text-center">
			<p class="text-2xl">Logging you in...</p>
			<p v-if="error" class="text-red-500 mt-4">{{ error }}</p>
		</div>
	</div>
</template>

<script setup lang="ts">
import { onMounted, ref } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { useAuthStore } from '@/stores/auth';
import { handleCallback } from '@/lib/endpoints/auth';

const route = useRoute();
const router = useRouter();
const authStore = useAuthStore();
const error = ref<string | null>(null);

onMounted(async () => {
	const code = route.query.code as string | undefined;
	const state = route.query.state as string | undefined;
	const hashParams = new URLSearchParams(
		window.location.hash.startsWith('#')
			? window.location.hash.slice(1)
			: window.location.hash
	);
	const hashToken = hashParams.get('token');
	const hashExpires = Number.parseInt(hashParams.get('expiresIn') || '86400', 10);

	try {
		if (hashToken) {
			await authStore.completeWithToken(
				hashToken,
				Number.isFinite(hashExpires) ? hashExpires : 86400
			);
		} else if (code) {
			const payload = await handleCallback(code, state);
			authStore.setSession(payload);
		} else {
			await authStore.checkAuth();
			if (!authStore.isAuthenticated) {
				throw new Error('Login did not complete.');
			}
			await authStore.refreshToken();
		}

		window.history.replaceState(null, '', '/login/callback');
		router.replace({ path: '/', query: {} });
	} catch (err: any) {
		error.value =
			err.response?.data?.error || err.message || 'Failed to complete login.';
		setTimeout(() => router.push('/login'), 3000);
	}
});
</script>
