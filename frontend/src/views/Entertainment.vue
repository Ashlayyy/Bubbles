<template>
	<div class="max-w-4xl">
		<h1 class="text-3xl font-bold text-foreground mb-2">Entertainment</h1>
		<p class="text-muted-foreground mb-8">
			Mini-games are configured here. Giveaways and polls run through the bot
			with <code>/giveaway</code> and <code>/poll</code>.
		</p>

		<section class="bg-card border border-border rounded-xl p-6 mb-8">
			<div class="flex items-center justify-between gap-4 mb-4">
				<h2 class="text-xl font-semibold text-foreground">Games</h2>
				<button
					:disabled="saving"
					@click="saveGames"
					class="bg-primary hover:bg-primary/90 text-primary-foreground px-4 py-2 rounded-lg"
				>
					{{ saving ? 'Saving…' : 'Save' }}
				</button>
			</div>
			<p v-if="loadError" class="text-red-400 mb-4">{{ loadError }}</p>
			<label class="flex items-center gap-3 mb-4 text-foreground">
				<input v-model="games.enabled" type="checkbox" />
				Games enabled
			</label>
			<label class="flex items-center gap-3 mb-4 text-foreground">
				<input v-model="games.triviaEnabled" type="checkbox" />
				Trivia enabled
			</label>
		</section>

		<section class="bg-card border border-border rounded-xl p-6 mb-6">
			<h2 class="text-xl font-semibold text-foreground mb-2">Music</h2>
			<p class="text-muted-foreground mb-4">
				Play YouTube tracks in a voice channel from the dashboard or with
				<code>/music play query:never gonna give you up</code>.
			</p>
			<router-link
				:to="`/server/${String(route.params.guildId || '')}/music`"
				class="inline-flex bg-primary hover:bg-primary/90 text-primary-foreground px-4 py-2 rounded-lg"
			>
				Open music player
			</router-link>
		</section>

		<section class="bg-card border border-border rounded-xl p-6 mb-6">
			<h2 class="text-xl font-semibold text-foreground mb-2">Giveaways</h2>
			<p class="text-muted-foreground">
				Create one in Discord with
				<code>/giveaway create prize:Nitro duration:60</code>.
				Use <code>/giveaway list</code> to see active ones.
			</p>
		</section>

		<section class="bg-card border border-border rounded-xl p-6">
			<h2 class="text-xl font-semibold text-foreground mb-2">Polls</h2>
			<p class="text-muted-foreground">
				Create a poll with
				<code>/poll question:… options:Yes;No</code>.
			</p>
		</section>
	</div>
</template>

<script setup lang="ts">
import { onMounted, reactive, ref } from 'vue';
import { useRoute } from 'vue-router';
import { entertainmentEndpoints } from '@/lib/endpoints/entertainment';
import { useToastStore } from '@/stores/toast';

const route = useRoute();
const toastStore = useToastStore();
const loadError = ref('');
const saving = ref(false);
const games = reactive({
	enabled: true,
	triviaEnabled: true,
	allowedChannels: [] as string[],
});

onMounted(async () => {
	const guildId = String(route.params.guildId || '');
	if (!guildId) return;
	try {
		const { data } = await entertainmentEndpoints.getGameConfigs(guildId);
		const payload = (data as { data?: typeof games }).data ?? data;
		Object.assign(games, payload);
	} catch (error: any) {
		loadError.value = error.response?.data?.error || 'Could not load game settings.';
	}
});

const saveGames = async () => {
	const guildId = String(route.params.guildId || '');
	saving.value = true;
	try {
		await entertainmentEndpoints.updateGameSettings(guildId, { ...games });
		toastStore.addToast('Game settings saved', 'success');
	} catch (error: any) {
		toastStore.addToast(error.response?.data?.error || 'Save failed', 'error');
	} finally {
		saving.value = false;
	}
};
</script>
