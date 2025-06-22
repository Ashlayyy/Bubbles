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
import { computed, onMounted } from 'vue';
import { useRoute } from 'vue-router';
import DashboardWidgets from '@/components/DashboardWidgets.vue';
import { useGuildsStore } from '@/stores/guilds';

const route = useRoute();
const guildsStore = useGuildsStore();
const guildId = computed(() => route.params.guildId as string);

onMounted(() => {
	if (guildId.value) {
		guildsStore.fetchGuildStats(guildId.value);
	}
});
</script>
