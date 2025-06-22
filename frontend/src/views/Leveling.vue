<template>
	<div>
		<div class="flex items-center justify-between mb-8">
			<h1 class="text-3xl font-bold text-foreground">Leveling System</h1>
			<button
				@click="saveSettings"
				class="bg-primary hover:bg-primary/90 text-primary-foreground font-semibold px-6 py-2 rounded-lg transition-colors flex items-center space-x-2"
			>
				<svg
					xmlns="http://www.w3.org/2000/svg"
					width="20"
					height="20"
					viewBox="0 0 24 24"
					fill="none"
					stroke="currentColor"
					stroke-width="2"
					stroke-linecap="round"
					stroke-linejoin="round"
				>
					<path
						d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"
					></path>
					<polyline points="17 21 17 13 7 13 7 21"></polyline>
					<polyline points="7 3 7 8 15 8"></polyline>
				</svg>
				<span>Save Changes</span>
			</button>
		</div>

		<div class="space-y-8 max-w-4xl">
			<LevelingGeneral
				v-model:leveling-enabled="levelingEnabled"
				v-model:xp-per-message="xpPerMessage"
				v-model:xp-cooldown="xpCooldown"
			/>

			<LevelingMessage
				:leveling-enabled="levelingEnabled"
				v-model:level-up-message-enabled="levelUpMessageEnabled"
				v-model:level-up-message-destination="levelUpMessageDestination"
				v-model:level-up-channel-id="levelUpChannelId"
				v-model:level-up-message="levelUpMessage"
				:all-channels="allChannels"
			/>

			<LevelingIgnoredItems
				:leveling-enabled="levelingEnabled"
				v-model:ignored-roles="ignoredRoles"
				v-model:ignored-channels="ignoredChannels"
				:all-roles="allRoles"
				:all-channels="allChannels"
			/>

			<LevelingMultipliers
				:leveling-enabled="levelingEnabled"
				v-model:xp-multipliers="xpMultipliers"
				:all-roles="allRoles"
				:all-channels="allChannels"
			/>

			<LevelingRoleRewards
				:leveling-enabled="levelingEnabled"
				v-model:role-rewards="roleRewards"
				:all-roles="allRoles"
			/>

			<LevelingPrestige
				:leveling-enabled="levelingEnabled"
				v-model:prestige-enabled="prestigeEnabled"
				v-model:prestige-level="prestigeLevel"
				v-model:prestige-reward-role-id="prestigeRewardRoleId"
				:all-roles="allRoles"
			/>
		</div>
	</div>
</template>

<script setup lang="ts">
import LevelingGeneral from '@/components/leveling/LevelingGeneral.vue';
import LevelingMessage from '@/components/leveling/LevelingMessage.vue';
import LevelingMultipliers from '@/components/leveling/LevelingMultipliers.vue';
import LevelingRoleRewards from '@/components/leveling/LevelingRoleRewards.vue';
import LevelingPrestige from '@/components/leveling/LevelingPrestige.vue';
import LevelingIgnoredItems from '@/components/leveling/LevelingIgnoredItems.vue';
import { useLeveling } from '@/composables/useLeveling';

const {
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
} = useLeveling();
</script>
