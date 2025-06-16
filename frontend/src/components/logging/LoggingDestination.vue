
<template>
  <div class="bg-slate-900 border border-slate-800 rounded-xl p-6">
    <h3 class="text-lg font-semibold">Log Destination</h3>
    <p class="text-slate-400 text-sm mb-4">Choose where logs should be sent.</p>
    <div class="flex bg-slate-800 rounded-lg p-1 max-w-sm">
      <button @click="$emit('update:channelMode', 'single')" :class="['w-1/2 py-2 text-sm font-medium rounded-md transition-colors', channelMode === 'single' ? 'bg-blue-600 text-white' : 'text-slate-300 hover:bg-slate-700']">
        Single Channel
      </button>
      <button @click="$emit('update:channelMode', 'multiple')" :class="['w-1/2 py-2 text-sm font-medium rounded-md transition-colors', channelMode === 'multiple' ? 'bg-blue-600 text-white' : 'text-slate-300 hover:bg-slate-700']">
        Multiple Channels
      </button>
    </div>
    <div v-if="channelMode === 'single'" class="mt-4 max-w-sm">
      <label for="single-log-channel" class="block text-sm font-medium text-slate-300 mb-2">Log Channel</label>
      <select
        :value="singleLogChannel"
        @change="$emit('update:singleLogChannel', ($event.target as HTMLSelectElement).value)"
        id="single-log-channel"
        class="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm focus:ring-blue-500 focus:border-blue-500"
      >
        <option :value="null" disabled>Select a channel</option>
        <option v-for="channel in availableChannels" :key="channel.id" :value="channel.id">#{{ channel.name }}</option>
        <option value="default">Use server default</option>
      </select>
    </div>
  </div>
</template>

<script setup lang="ts">
import type { PropType } from 'vue';

defineProps({
  channelMode: {
    type: String as PropType<'single' | 'multiple'>,
    required: true,
  },
  singleLogChannel: {
    type: String as PropType<string | null>,
    default: null,
  },
  availableChannels: {
    type: Array as PropType<{ id: string, name: string }[]>,
    required: true,
  },
});

defineEmits(['update:channelMode', 'update:singleLogChannel']);
</script>
