import { ref, onMounted } from 'vue';
import { useGuildsStore } from '@/stores/guilds';
import { useToastStore } from '@/stores/toast';
import { levelingEndpoints } from '@/lib/endpoints/leveling';
import { getGuildChannels, getGuildRoles } from '@/lib/endpoints/guilds';
import type { DiscordItem } from '@/types/discord';

export interface RoleReward {
	id?: string;
	level: number;
	roleId: string;
	roleName?: string;
}

export interface XPMultiplier {
	uid: string;
	type: 'role' | 'channel';
	id: string;
	name?: string;
	multiplier: number;
}

export function useLeveling() {
	const guildStore = useGuildsStore();
	const toastStore = useToastStore();

	const levelingEnabled = ref(true);
	const xpPerMessage = ref(15);
	const xpCooldown = ref(60);
	const levelUpMessageEnabled = ref(true);
	const levelUpMessageDestination = ref('current');
	const levelUpChannelId = ref('');
	const levelUpMessage = ref('GG {user}, you reached level {level}!');
	const roleRewards = ref<RoleReward[]>([]);
	const xpMultipliers = ref<XPMultiplier[]>([]);
	const ignoredRoles = ref<string[]>([]);
	const ignoredChannels = ref<string[]>([]);
	const prestigeEnabled = ref(false);
	const prestigeLevel = ref(100);
	const prestigeRewardRoleId = ref('');

	const allRoles = ref<DiscordItem[]>([]);
	const allChannels = ref<DiscordItem[]>([]);

	const fetchSettings = async () => {
		if (!guildStore.currentGuild) return;
		try {
			const [channels, roles, settings] = await Promise.all([
				getGuildChannels(guildStore.currentGuild.id),
				getGuildRoles(guildStore.currentGuild.id),
				levelingEndpoints.getSettings(guildStore.currentGuild.id),
			]);

			allChannels.value = channels;
			allRoles.value = roles;

			const { data } = settings;
			levelingEnabled.value = data.enabled;
			xpPerMessage.value = data.xpPerMessage;
			xpCooldown.value = data.xpCooldown;
			levelUpMessageEnabled.value = data.levelUpMessage.enabled;
			levelUpMessageDestination.value = data.levelUpMessage.destination;
			levelUpChannelId.value = data.levelUpMessage.channelId;
			levelUpMessage.value = data.levelUpMessage.message;
			roleRewards.value = data.roleRewards;
			xpMultipliers.value = data.xpMultipliers;
			ignoredRoles.value = data.ignoredRoles;
			ignoredChannels.value = data.ignoredChannels;
			prestigeEnabled.value = data.prestige.enabled;
			prestigeLevel.value = data.prestige.level;
			prestigeRewardRoleId.value = data.prestige.rewardRoleId;
		} catch (error) {
			console.error('Failed to fetch leveling settings:', error);
			toastStore.addToast('Failed to load leveling settings.', 'error');
		}
	};

	const saveSettings = async () => {
		if (!guildStore.currentGuild) return;
		try {
			const payload = {
				enabled: levelingEnabled.value,
				xpPerMessage: xpPerMessage.value,
				xpCooldown: xpCooldown.value,
				levelUpMessage: {
					enabled: levelUpMessageEnabled.value,
					destination: levelUpMessageDestination.value,
					channelId: levelUpChannelId.value,
					message: levelUpMessage.value,
				},
				roleRewards: roleRewards.value,
				xpMultipliers: xpMultipliers.value,
				ignoredRoles: ignoredRoles.value,
				ignoredChannels: ignoredChannels.value,
				prestige: {
					enabled: prestigeEnabled.value,
					level: prestigeLevel.value,
					rewardRoleId: prestigeRewardRoleId.value,
				},
			};
			await levelingEndpoints.updateSettings(
				guildStore.currentGuild.id,
				payload
			);
			toastStore.addToast('Leveling settings saved!', 'success');
		} catch (error) {
			console.error('Failed to save leveling settings:', error);
			toastStore.addToast('Failed to save leveling settings.', 'error');
		}
	};

	onMounted(fetchSettings);

	return {
		levelingEnabled,
		xpPerMessage,
		xpCooldown,
		levelUpMessageEnabled,
		levelUpMessageDestination,
		levelUpChannelId,
		levelUpMessage,
		roleRewards,
		xpMultipliers,
		ignoredRoles,
		ignoredChannels,
		prestigeEnabled,
		prestigeLevel,
		prestigeRewardRoleId,
		allRoles,
		allChannels,
		saveSettings,
	};
}
