/* eslint-disable react-hooks/rules-of-hooks, react-hooks/exhaustive-deps */
import { defineStore } from 'pinia';
import { ref, watch } from 'vue';
import { websocketService } from '@/services/websocketService';
import { useGuildsStore } from '@/stores/guilds';

const DEFAULT_EVENTS = [
	'MESSAGE_CREATE',
	'MESSAGE_DELETE',
	'GUILD_BAN_ADD',
	'GUILD_BAN_REMOVE',
	'GUILD_MEMBER_UPDATE',
];

export const useWebsocketStore = defineStore('ws', () => {
	const connected = ref(false);
	const latency = ref<number | null>(null);
	const lastError = ref<string | null>(null);

	// forward events from service
	websocketService.on('authenticated', () => {
		connected.value = true;
		lastError.value = null;
	});

	websocketService.on('disconnected', () => {
		connected.value = false;
	});

	websocketService.on('auth_failed', (err) => {
		connected.value = false;
		lastError.value =
			err instanceof Error ? err.message : 'Authentication failed';
	});

	websocketService.on('pong', (ms: number) => {
		latency.value = ms;
	});

	const connect = (token: string) => {
		const guildStore = useGuildsStore();
		websocketService.connect(token, guildStore.currentGuild?.id);
		// Subscribe once connected & authenticated – handled via event
		websocketService.on('authenticated', () => {
			subscribe(DEFAULT_EVENTS);
		});
	};

	const subscribe = (events: string[]) => {
		const guildStore = useGuildsStore();
		websocketService.subscribe(events, guildStore.currentGuild?.id);
	};

	const reauth = (token: string) => websocketService.updateToken(token);

	const disconnect = () => websocketService.disconnect();

	// Reactively re-subscribe when guild changes and ws is connected
	const guildStore = useGuildsStore();
	watch(
		() => guildStore.currentGuild?.id,
		(gid) => {
			if (connected.value && gid) {
				// resubscribe default events for new guild
				subscribe(DEFAULT_EVENTS);
			}
		}
	);

	return {
		connected,
		latency,
		lastError,
		connect,
		subscribe,
		reauth,
		disconnect,
	};
});
