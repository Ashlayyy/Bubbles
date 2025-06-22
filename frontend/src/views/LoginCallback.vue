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
import { apiClient } from '@/lib/apiClient';

const route = useRoute();
const router = useRouter();
const authStore = useAuthStore();
const error = ref<string | null>(null);

onMounted(async () => {
	try {
		await authStore.checkAuth();

		if (authStore.isAuthenticated) {
			router.push('/');
		} else {
			throw new Error('Authentication failed after callback.');
		}
	} catch (err: any) {
		error.value =
			err.response?.data?.message ||
			err.message ||
			'An unknown error occurred.';
		setTimeout(() => router.push('/login'), 3000);
	}
});
</script>
