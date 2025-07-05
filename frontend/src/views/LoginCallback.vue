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
	const tokenParam = route.query.token as string | undefined;
	const state = route.query.state as string | undefined;

	try {
		if (code) {
			// Exchange code for token & user data via API
			const payload = await handleCallback(code, state);
			authStore.setSession(payload);
		} else if (tokenParam) {
			// Token already provided – store it then fetch user
			authStore.token = tokenParam;
			await authStore.checkAuth();
			if (!authStore.isAuthenticated) {
				throw new Error('Failed to verify token.');
			}
		} else {
			throw new Error('Missing authorization code or token in callback URL.');
		}

		// Success → go home
		router.replace({ path: '/', query: {} });
	} catch (err: any) {
		error.value =
			err.response?.data?.error || err.message || 'Failed to complete login.';
		setTimeout(() => router.push('/login'), 3000);
	}
});
</script>
