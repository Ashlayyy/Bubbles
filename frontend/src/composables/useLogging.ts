import { ref, watch, onMounted } from 'vue';
import { useGuildsStore } from '@/stores/guilds';
import { useToastStore } from '@/stores/toast';
import { loggingEndpoints } from '@/lib/endpoints/logging';
import { getGuildChannels, getGuildRoles } from '@/lib/endpoints/guilds';
import type { DiscordItem } from '@/types/discord';
import {
	LOG_CATEGORIES,
	STANDARD_LOG_TYPES,
	LOGGING_PRESETS,
	type LogEvent,
} from '@/lib/loggingConstants';

const formatLabel = (str: string) => {
	return str
		.replace(/_/g, ' ')
		.toLowerCase()
		.replace(/\b\w/g, (l) => l.toUpperCase());
};

type LogEvents = Record<
	string,
	{
		label: string;
		channel: string | null;
		events: Record<
			string,
			{ label: string; value: boolean; recommended: boolean }
		>;
	}
>;

const generateLogEvents = (): LogEvents => {
	const newLogEvents: LogEvents = {};

	for (const categoryKey in LOG_CATEGORIES) {
		const categoryData =
			LOG_CATEGORIES[categoryKey as keyof typeof LOG_CATEGORIES];
		const events: Record<
			string,
			{ label: string; value: boolean; recommended: boolean }
		> = {};

		for (const eventType of categoryData) {
			const isRecommended = STANDARD_LOG_TYPES.includes(eventType as LogEvent);
			events[eventType] = {
				label: formatLabel(eventType),
				value: false, // Default to false, will be populated by fetched settings
				recommended: isRecommended,
			};
		}

		newLogEvents[categoryKey] = {
			label: formatLabel(categoryKey),
			channel: null,
			events: events,
		};
	}
	return newLogEvents;
};

export function useLogging() {
	const guildStore = useGuildsStore();
	const toastStore = useToastStore();

	const channelMode = ref<'single' | 'multiple'>('single');
	const singleLogChannel = ref<string | null>(null);
	const masterEnabled = ref(true);
	const availableChannels = ref<DiscordItem[]>([]);
	const allRoles = ref<DiscordItem[]>([]);
	const ignoredRoles = ref<string[]>([]);
	const ignoredChannels = ref<string[]>([]);
	const activePreset = ref<string | null>(null);
	const logEvents = ref(generateLogEvents());

	const fetchSettings = async () => {
		if (!guildStore.currentGuild) return;
		try {
			const [channels, roles, settings] = await Promise.all([
				getGuildChannels(guildStore.currentGuild.id),
				getGuildRoles(guildStore.currentGuild.id),
				loggingEndpoints.getSettings(guildStore.currentGuild.id),
			]);

			availableChannels.value = channels;
			allRoles.value = roles;

			const { data } = settings;
			masterEnabled.value = data.enabled;
			channelMode.value = data.channelMode;
			singleLogChannel.value = data.singleLogChannel;
			ignoredRoles.value = data.ignoredRoles;
			ignoredChannels.value = data.ignoredChannels;

			// Populate logEvents from the fetched settings
			for (const categoryKey in logEvents.value) {
				const categorySettings = data.categories[categoryKey];
				if (categorySettings) {
					logEvents.value[categoryKey].channel = categorySettings.channel;
					for (const eventKey in logEvents.value[categoryKey].events) {
						logEvents.value[categoryKey].events[eventKey].value =
							categorySettings.events[eventKey] ?? false;
					}
				}
			}
		} catch (error) {
			console.error('Failed to fetch logging settings:', error);
			toastStore.addToast('Failed to load logging settings.', 'error');
		}
	};

	const saveSettings = async () => {
		if (!guildStore.currentGuild) return;
		try {
			const payload = {
				enabled: masterEnabled.value,
				channelMode: channelMode.value,
				singleLogChannel: singleLogChannel.value,
				ignoredRoles: ignoredRoles.value,
				ignoredChannels: ignoredChannels.value,
				categories: logEvents.value,
			};
			await loggingEndpoints.updateSettings(
				guildStore.currentGuild.id,
				payload
			);
			toastStore.addToast('Logging settings saved successfully!', 'success');
		} catch (error) {
			console.error('Failed to save logging settings:', error);
			toastStore.addToast('Failed to save logging settings.', 'error');
		}
	};

	onMounted(fetchSettings);

	const applyPreset = (presetName: string) => {
		activePreset.value = presetName;

		if (presetName === 'all') {
			for (const category of Object.values(logEvents.value)) {
				for (const event of Object.values(category.events)) {
					event.value = true;
				}
			}
			return;
		}

		if (presetName === 'none') {
			for (const category of Object.values(logEvents.value)) {
				for (const event of Object.values(category.events)) {
					event.value = false;
				}
			}
			return;
		}

		const preset = LOGGING_PRESETS.find((p) => p.name === presetName);
		if (!preset) return;

		const enabledTypes = new Set(preset.logTypes);

		for (const category of Object.values(logEvents.value)) {
			for (const eventKey in category.events) {
				category.events[eventKey].value = enabledTypes.has(eventKey);
			}
		}
	};

	watch(masterEnabled, (newValue) => {
		if (!newValue) {
			applyPreset('none');
		}
	});

	const updateCategoryChannel = (
		categoryKey: string,
		channel: string | null
	) => {
		if (logEvents.value[categoryKey]) {
			logEvents.value[categoryKey].channel = channel;
		}
	};

	const updateEventValue = (
		categoryKey: string,
		eventKey: string,
		value: boolean
	) => {
		if (
			logEvents.value[categoryKey] &&
			logEvents.value[categoryKey].events[eventKey]
		) {
			logEvents.value[categoryKey].events[eventKey].value = value;
		}
	};

	return {
		masterEnabled,
		channelMode,
		singleLogChannel,
		availableChannels,
		allRoles,
		ignoredRoles,
		ignoredChannels,
		activePreset,
		logEvents,
		applyPreset,
		updateCategoryChannel,
		updateEventValue,
		saveSettings,
		LOGGING_PRESETS,
	};
}
