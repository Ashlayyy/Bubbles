import { defineStore } from 'pinia';
import { websocketService } from '@/services/websocketService';

interface RawDiscordEvent {
	event: string;
	data: unknown;
	guildId?: string;
}

export const useWsEventsStore = defineStore('wsEvents', () => {
	// ---------------------------------------------------------------------------
	// Internal handler registry – Map<eventName, Set<callback>>
	// ---------------------------------------------------------------------------
	const handlers = new Map<string, Set<(payload: unknown) => void>>();

	function register(event: string, cb: (payload: unknown) => void): void {
		if (!handlers.has(event)) handlers.set(event, new Set());
		handlers.get(event)!.add(cb);
	}

	function unregister(event: string, cb: (payload: unknown) => void): void {
		handlers.get(event)?.delete(cb);
	}

	function dispatch(event: string, payload: unknown): void {
		const cbs = handlers.get(event);
		if (!cbs) return;
		for (const fn of cbs) {
			try {
				fn(payload);
			} catch (err) {
				// eslint-disable-next-line no-console
				console.error(`[wsEvents] handler error for ${event}`, err);
			}
		}
	}

	// ---------------------------------------------------------------------------
	// Wire up websocketService → local dispatchers
	// ---------------------------------------------------------------------------
	websocketService.on('discord_event', (payload: RawDiscordEvent) => {
		const evtKey = `discord_${payload.event}`;
		dispatch(evtKey, payload);
	});

	websocketService.on('bot_event', (payload: RawDiscordEvent) => {
		const evtKey = `bot_${payload.event}`;
		dispatch(evtKey, payload);
	});

	websocketService.on('system_message', (payload: unknown) => {
		dispatch('system_message', payload);
	});

	return { register, unregister };
});
