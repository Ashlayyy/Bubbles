<template>
	<div>
		<LoggingHeader @save="saveSettings" />

		<div class="space-y-8">
			<LoggingPresets
				v-model:masterEnabled="masterEnabled"
				:active-preset="activePreset"
				:presets="LOGGING_PRESETS"
				@apply-preset="applyPreset"
			/>

			<LoggingDestination
				v-model:channelMode="channelMode"
				v-model:singleLogChannel="singleLogChannel"
				:available-channels="availableChannels"
			/>

			<LoggingCategory
				v-for="(category, key) in logEvents"
				:key="key"
				:category="category"
				:category-key="String(key)"
				:channel-mode="channelMode"
				:available-channels="availableChannels"
				@update:category-channel="updateCategoryChannel"
				@update:event-value="updateEventValue"
			/>

			<LoggingIgnoredItems
				:all-roles="allRoles"
				:all-channels="availableChannels"
				v-model:ignored-roles="ignoredRoles"
				v-model:ignored-channels="ignoredChannels"
			/>
		</div>
	</div>
</template>

<script setup lang="ts">
import LoggingHeader from '@/components/logging/LoggingHeader.vue';
import LoggingPresets from '@/components/logging/LoggingPresets.vue';
import LoggingDestination from '@/components/logging/LoggingDestination.vue';
import LoggingCategory from '@/components/logging/LoggingCategory.vue';
import LoggingIgnoredItems from '@/components/logging/LoggingIgnoredItems.vue';
import { useLogging } from '@/composables/useLogging';

const {
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
} = useLogging();
</script>
