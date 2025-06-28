<template>
	<div>
		<h1 class="text-3xl font-bold text-foreground mb-2">Dashboard</h1>
		<p class="text-muted-foreground mb-6">
			Overview of your server activity and statistics
		</p>

		<DashboardWidgets />
	</div>
</template>

<script setup lang="ts">
import { computed, watch } from 'vue';
import { useRoute } from 'vue-router';
import DashboardWidgets from '@/components/DashboardWidgets.vue';
import { useGuildsStore } from '@/stores/guilds';

const route = useRoute();
const guildsStore = useGuildsStore();
const guildId = computed(() => route.params.guildId as string | undefined);

watch(
	() => guildId.value,
	(id) => {
		if (id) guildsStore.fetchGuildStats(id);
	},
	{ immediate: true }
);
</script>
