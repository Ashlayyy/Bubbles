
<template>
  <div class="bg-slate-900 border border-slate-800 rounded-xl p-6">
    <div class="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-4">
      <h3 class="text-lg font-semibold">{{ category.label }}</h3>
      <div v-if="channelMode === 'multiple'" class="w-full sm:w-64">
         <select
           :value="category.channel"
           @change="$emit('update:categoryChannel', categoryKey, ($event.target as HTMLSelectElement).value)"
           class="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm focus:ring-blue-500 focus:border-blue-500"
         >
          <option :value="null" disabled>Select a channel</option>
          <option v-for="channel in availableChannels" :key="channel.id" :value="channel.id">#{{ channel.name }}</option>
          <option value="default">Use server default</option>
        </select>
      </div>
    </div>
    <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
      <div v-for="(event, eventKey) in category.events" :key="eventKey" class="flex items-center justify-between bg-slate-800/50 p-3 rounded-lg">
        <label :for="`${categoryKey}-${eventKey}`" class="text-sm font-medium text-slate-300">{{ event.label }}</label>
        <label class="relative inline-flex items-center cursor-pointer">
          <input
            type="checkbox"
            :id="`${categoryKey}-${eventKey}`"
            :checked="event.value"
            @change="$emit('update:eventValue', categoryKey, String(eventKey), ($event.target as HTMLInputElement).checked)"
            class="sr-only peer"
          >
          <div class="w-11 h-6 bg-slate-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
        </label>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import type { PropType } from 'vue';

type Category = {
  label: string;
  channel: string | null;
  events: Record<string, { label: string; value: boolean; recommended: boolean }>;
}

type Channel = {
  id: string;
  name: string;
}

defineProps({
  category: {
    type: Object as PropType<Category>,
    required: true
  },
  categoryKey: {
    type: String,
    required: true,
  },
  channelMode: {
    type: String as PropType<'single' | 'multiple'>,
    required: true,
  },
  availableChannels: {
    type: Array as PropType<Channel[]>,
    required: true,
  }
});

defineEmits<{
  (e: 'update:categoryChannel', categoryKey: string, value: string): void
  (e: 'update:eventValue', categoryKey: string, eventKey: string, value: boolean): void
}>();
</script>
