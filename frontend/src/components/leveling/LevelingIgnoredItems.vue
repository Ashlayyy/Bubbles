
<template>
  <div class="bg-slate-900 border border-slate-800 rounded-xl">
    <div class="p-6 border-b border-slate-800">
      <h2 class="text-xl font-semibold text-white">Ignored Items</h2>
      <p class="text-slate-400 mt-1">Users in these roles or channels will not gain XP.</p>
    </div>
    <div class="p-6" :class="{ 'opacity-50 pointer-events-none': !levelingEnabled }">
      <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div>
          <h4 class="font-semibold mb-2 text-slate-300">Ignored Channels</h4>
          <DiscordItemSelector
            :items="allChannels"
            :selected-ids="ignoredChannels"
            @update:selected-ids="$emit('update:ignoredChannels', $event)"
            :multiple="true"
            item-type="channel"
            placeholder="Select channels to ignore"
          />
        </div>
        <div>
          <h4 class="font-semibold mb-2 text-slate-300">Ignored Roles</h4>
           <DiscordItemSelector
            :items="allRoles"
            :selected-ids="ignoredRoles"
            @update:selected-ids="$emit('update:ignoredRoles', $event)"
            :multiple="true"
            item-type="role"
            placeholder="Select roles to ignore"
          />
        </div>
      </div>
    </div>
    <div class="p-6 bg-slate-900/50 border-t border-slate-800 rounded-b-xl flex justify-end">
      <button @click="saveChanges" class="bg-blue-600 hover:bg-blue-700 text-white font-semibold px-4 py-2 rounded-lg transition-colors">Save Changes</button>
    </div>
  </div>
</template>

<script setup lang="ts">
import DiscordItemSelector from '@/components/common/DiscordItemSelector.vue';
import type { DiscordItem } from '@/types/discord';
import { useToastStore } from '@/stores/toast';

defineProps<{
  levelingEnabled: boolean;
  ignoredRoles: string[];
  ignoredChannels: string[];
  allRoles: DiscordItem[];
  allChannels: DiscordItem[];
}>();

defineEmits<{
  (e: 'update:ignoredRoles', value: string[]): void;
  (e: 'update:ignoredChannels', value: string[]): void;
}>();

const toastStore = useToastStore();

const saveChanges = () => {
  toastStore.addToast('Ignored items saved!', 'success');
};
</script>
