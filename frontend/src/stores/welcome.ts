import { defineStore } from 'pinia';
import { ref, watch } from 'vue';
import { welcomeEndpoints } from '@/lib/endpoints/welcome';
import { useGuildsStore } from './guilds';

export interface WelcomeSettings {
	enabled: boolean;
	channelId: string;
	channelName: string;
	messages: string[];
	embedEnabled: boolean;
	embedTitle: string;
	embedDescription: string;
	embedColor: string;
	embedThumbnail: string;
	embedImage: string;
	embedFooter: string;
	pingUser: boolean;
	deleteAfter: number;
	dmUser: boolean;
	dmMessage: string;
	autoRole: string[];
}

export interface LeaveSettings {
	enabled: boolean;
	channelId: string;
	channelName: string;
	messages: string[];
	embedEnabled: boolean;
	embedTitle: string;
	embedDescription: string;
	embedColor: string;
	embedFooter: string;
}

export const useWelcomeStore = defineStore('welcome', () => {
	const welcomeSettings = ref<WelcomeSettings | null>(null);
	const leaveSettings = ref<LeaveSettings | null>(null);
	const guildsStore = useGuildsStore();

	const fetchSettings = async (guildId: string) => {
		if (!guildId) return;
		try {
			const { data } = await welcomeEndpoints.getSettings(guildId);
			welcomeSettings.value = data.welcome;
			leaveSettings.value = data.leave;
		} catch (error) {
			console.error('Failed to fetch welcome settings:', error);
			welcomeSettings.value = null;
			leaveSettings.value = null;
		}
	};

	const saveSettings = async () => {
		const guildId = guildsStore.selectedGuild?.id;
		if (!guildId) throw new Error('No guild selected');

		const payload = {
			welcome: welcomeSettings.value,
			leave: leaveSettings.value,
		};

		await welcomeEndpoints.updateSettings(guildId, payload);
	};

	watch(
		() => guildsStore.selectedGuild,
		(newGuild) => {
			if (newGuild) {
				fetchSettings(newGuild.id);
			} else {
				welcomeSettings.value = null;
				leaveSettings.value = null;
			}
		},
		{ immediate: true }
	);

	const updateWelcomeSettings = (settings: Partial<WelcomeSettings>) => {
		if (!welcomeSettings.value) return;
		welcomeSettings.value = { ...welcomeSettings.value, ...settings };
	};

	const updateLeaveSettings = (settings: Partial<LeaveSettings>) => {
		if (!leaveSettings.value) return;
		leaveSettings.value = { ...leaveSettings.value, ...settings };
	};

	return {
		welcomeSettings,
		leaveSettings,
		fetchSettings,
		saveSettings,
		updateWelcomeSettings,
		updateLeaveSettings,
	};
});
