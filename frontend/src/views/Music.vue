<template>
	<div class="max-w-5xl">
		<h1 class="text-3xl font-bold text-foreground mb-2">Music</h1>
		<p class="text-muted-foreground mb-8">
			Play songs in a voice channel from the dashboard or with
			<code>/music play</code>.
		</p>

		<p v-if="error" class="text-red-400 mb-4">{{ error }}</p>

		<section class="bg-card border border-border rounded-xl p-6 mb-6">
			<div class="flex flex-col md:flex-row gap-3">
				<input
					v-model="query"
					type="text"
					placeholder="Song name or YouTube URL"
					class="flex-1 bg-background border border-border rounded-lg px-3 py-2 text-foreground"
					@keyup.enter="play"
				/>
				<select
					v-model="voiceChannelId"
					class="bg-background border border-border rounded-lg px-3 py-2 text-foreground"
				>
					<option value="">Auto (occupied channel)</option>
					<option v-for="channel in voiceChannels" :key="channel.id" :value="channel.id">
						{{ channel.name }}
						{{ channel.memberCount ? `(${channel.memberCount})` : '' }}
					</option>
				</select>
				<button
					:disabled="busy || !query.trim()"
					class="bg-primary hover:bg-primary/90 text-primary-foreground px-4 py-2 rounded-lg disabled:opacity-50"
					@click="play"
				>
					{{ busy ? 'Working…' : 'Play' }}
				</button>
			</div>
		</section>

		<section class="bg-card border border-border rounded-xl p-6 mb-6">
			<div class="flex items-start justify-between gap-4 mb-4">
				<div>
					<p class="text-sm text-muted-foreground">Now playing</p>
					<h2 class="text-xl font-semibold text-foreground">
						{{ status.currentTrack?.title || 'Nothing is playing' }}
					</h2>
					<p class="text-muted-foreground">
						{{ status.currentTrack?.artist || 'Queue a track to start' }}
					</p>
				</div>
				<p class="text-sm text-muted-foreground">
					{{ status.isPaused ? 'Paused' : status.isPlaying ? 'Playing' : 'Idle' }}
					· {{ status.volume }}%
				</p>
			</div>
			<div class="flex flex-wrap gap-2">
				<button class="px-3 py-2 rounded-lg bg-secondary" :disabled="busy" @click="pause">Pause</button>
				<button class="px-3 py-2 rounded-lg bg-secondary" :disabled="busy" @click="resume">Resume</button>
				<button class="px-3 py-2 rounded-lg bg-secondary" :disabled="busy" @click="skip">Skip</button>
				<button class="px-3 py-2 rounded-lg bg-secondary" :disabled="busy" @click="stop">Stop</button>
				<button class="px-3 py-2 rounded-lg bg-secondary" :disabled="busy" @click="shuffle">Shuffle</button>
			</div>
			<label class="block mt-4 text-sm text-muted-foreground">
				Volume
				<input
					v-model.number="status.volume"
					type="range"
					min="0"
					max="100"
					class="w-full"
					@change="setVolume"
				/>
			</label>
		</section>

		<section class="bg-card border border-border rounded-xl p-6">
			<h2 class="text-xl font-semibold text-foreground mb-4">Queue</h2>
			<p v-if="status.queue.length === 0" class="text-muted-foreground">The queue is empty.</p>
			<ol v-else class="space-y-2">
				<li
					v-for="(track, index) in status.queue"
					:key="track.id || track.url || index"
					class="flex justify-between gap-4 bg-secondary/40 rounded-lg px-3 py-2"
				>
					<span class="text-foreground">{{ index + 1 }}. {{ track.title }} — {{ track.artist }}</span>
				</li>
			</ol>
		</section>
	</div>
</template>

<script setup lang="ts">
import { onMounted, reactive, ref } from 'vue';
import { useRoute } from 'vue-router';
import { musicEndpoints } from '@/lib/endpoints/music';
import { voiceEndpoints } from '@/lib/endpoints/voice';
import { useToastStore } from '@/stores/toast';

const route = useRoute();
const toastStore = useToastStore();
const query = ref('');
const voiceChannelId = ref('');
const busy = ref(false);
const error = ref('');
const voiceChannels = ref<Array<{ id: string; name: string; memberCount?: number }>>([]);
const status = reactive({
	isPlaying: false,
	isPaused: false,
	currentTrack: null as { title?: string; artist?: string } | null,
	queue: [] as Array<{ id?: string; url?: string; title: string; artist: string }>,
	volume: 50,
});

const guildId = () => String(route.params.guildId || '');

function applyStatus(payload: any) {
	const data = payload?.data ?? payload;
	status.isPlaying = Boolean(data?.isPlaying);
	status.isPaused = Boolean(data?.isPaused);
	status.currentTrack = data?.currentTrack ?? null;
	status.queue = Array.isArray(data?.queue) ? data.queue : [];
	status.volume = Number(data?.volume ?? status.volume);
}

async function refresh() {
	const id = guildId();
	if (!id) return;
	try {
		const [{ data: music }, { data: voice }] = await Promise.all([
			musicEndpoints.status(id),
			voiceEndpoints.activity(id),
		]);
		applyStatus(music);
		const live = (voice as any)?.data?.liveChannels ?? (voice as any)?.liveChannels ?? [];
		voiceChannels.value = live;
	} catch (err: any) {
		error.value = err.response?.data?.error || 'Could not load music status.';
	}
}

async function run(action: () => Promise<unknown>, fallback: string) {
	busy.value = true;
	error.value = '';
	try {
		const result: any = await action();
		applyStatus(result.data);
		await refresh();
	} catch (err: any) {
		const message = err.response?.data?.error || fallback;
		error.value = message;
		toastStore.addToast(message, 'error');
	} finally {
		busy.value = false;
	}
}

const play = () =>
	run(
		() =>
			musicEndpoints.play(guildId(), {
				query: query.value.trim(),
				voiceChannelId: voiceChannelId.value || undefined,
			}),
		'Could not start playback. Join a voice channel or pick one above.'
	);

const pause = () => run(() => musicEndpoints.pause(guildId()), 'Pause failed');
const resume = () => run(() => musicEndpoints.resume(guildId()), 'Resume failed');
const skip = () => run(() => musicEndpoints.skip(guildId()), 'Skip failed');
const stop = () => run(() => musicEndpoints.stop(guildId()), 'Stop failed');
const shuffle = () => run(() => musicEndpoints.shuffle(guildId()), 'Shuffle failed');
const setVolume = () =>
	run(() => musicEndpoints.setVolume(guildId(), status.volume), 'Volume update failed');

onMounted(refresh);
</script>
