
<template>
  <div class="bg-slate-900 border border-slate-800 rounded-xl">
    <div class="p-6 border-b border-slate-800">
      <h2 class="text-xl font-semibold text-white">Prestige System</h2>
      <p class="text-slate-400 mt-1">Reward users for reaching the max level and resetting.</p>
    </div>
    <div class="p-6 space-y-6">
        <div class="flex items-start justify-between">
        <div>
          <label for="prestigeEnabled" class="font-medium text-white">Enable Prestige System</label>
          <p class="text-sm text-slate-400 mt-1">Allow users to reset their level for a special reward.</p>
        </div>
        <label class="relative inline-flex items-center cursor-pointer">
          <input type="checkbox" id="prestigeEnabled" :checked="prestigeEnabled" @change="$emit('update:prestigeEnabled', ($event.target as HTMLInputElement).checked)" class="sr-only peer">
          <div class="w-11 h-6 bg-slate-700 rounded-full peer peer-checked:after:translate-x-full after:content-[''] after:absolute after:top-0.5 after:left-[2px] after:bg-white after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
        </label>
      </div>

      <div class="border-t border-slate-800 !my-6"></div>

      <div :class="{ 'opacity-50 pointer-events-none': !prestigeEnabled || !levelingEnabled }">
        <div>
          <label for="prestigeLevel" class="block text-sm font-medium text-slate-300 mb-2">Required Level for Prestige</label>
          <input type="number" id="prestigeLevel" :value="prestigeLevel" @input="$emit('update:prestigeLevel', Number(($event.target as HTMLInputElement).value))" class="w-full bg-slate-800 border border-slate-700 rounded-lg px-4 py-2 text-white focus:ring-blue-500 focus:border-blue-500" placeholder="e.g., 100">
          <p class="mt-2 text-xs text-slate-500">The level a user must reach to be able to prestige.</p>
        </div>

        <div class="mt-4">
          <label class="block text-sm font-medium text-slate-300 mb-2">Prestige Reward Role</label>
          <DiscordItemSelector
            :items="allRoles"
            :selected-ids="prestigeRewardRoleId"
            @update:selected-ids="$emit('update:prestigeRewardRoleId', $event)"
            :multiple="false"
            item-type="role"
            placeholder="Select a reward role"
          />
          <p class="mt-2 text-xs text-slate-500">This role is given to the user permanently when they prestige.</p>
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
  prestigeEnabled: boolean;
  prestigeLevel: number;
  prestigeRewardRoleId: string;
  allRoles: DiscordItem[];
}>();

defineEmits<{
  (e: 'update:prestigeEnabled', value: boolean): void;
  (e: 'update:prestigeLevel', value: number): void;
  (e: 'update:prestigeRewardRoleId', value: string): void;
}>();

const toastStore = useToastStore();

const saveChanges = () => {
  toastStore.addToast('Prestige settings saved successfully!', 'success');
};
</script>
