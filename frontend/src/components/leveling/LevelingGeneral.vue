
<template>
  <div class="bg-slate-900 border border-slate-800 rounded-xl">
    <div class="p-6 border-b border-slate-800">
      <h2 class="text-xl font-semibold text-white">General Settings</h2>
      <p class="text-slate-400 mt-1">Enable or disable the leveling system and configure XP rates.</p>
    </div>
    <div class="p-6 space-y-6">
      <div class="flex items-start justify-between">
        <div>
          <label for="levelingEnabled" class="font-medium text-white">Enable Leveling System</label>
          <p class="text-sm text-slate-400 mt-1">Users will gain XP for sending messages.</p>
        </div>
        <label class="relative inline-flex items-center cursor-pointer">
          <input type="checkbox" id="levelingEnabled" :checked="levelingEnabled" @change="$emit('update:levelingEnabled', ($event.target as HTMLInputElement).checked)" class="sr-only peer">
          <div class="w-11 h-6 bg-slate-700 rounded-full peer peer-checked:after:translate-x-full after:content-[''] after:absolute after:top-0.5 after:left-[2px] after:bg-white after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
        </label>
      </div>
      
      <div class="border-t border-slate-800 !my-6"></div>

      <div :class="{ 'opacity-50 pointer-events-none': !levelingEnabled }">
        <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <label for="xpPerMessage" class="block text-sm font-medium text-slate-300 mb-2">XP Per Message</label>
            <input type="number" id="xpPerMessage" :value="xpPerMessage" @input="$emit('update:xpPerMessage', Number(($event.target as HTMLInputElement).value))" class="w-full bg-slate-800 border border-slate-700 rounded-lg px-4 py-2 text-white focus:ring-blue-500 focus:border-blue-500" placeholder="e.g., 15">
            <p class="mt-2 text-xs text-slate-500">Amount of XP gained per message.</p>
          </div>
          <div>
            <label for="xpCooldown" class="block text-sm font-medium text-slate-300 mb-2">XP Cooldown (seconds)</label>
            <input type="number" id="xpCooldown" :value="xpCooldown" @input="$emit('update:xpCooldown', Number(($event.target as HTMLInputElement).value))" class="w-full bg-slate-800 border border-slate-700 rounded-lg px-4 py-2 text-white focus:ring-blue-500 focus:border-blue-500" placeholder="e.g., 60">
            <p class="mt-2 text-xs text-slate-500">How long a user must wait to gain XP again.</p>
          </div>
        </div>
      </div>
    </div>
    <div class="p-6 bg-slate-900/50 border-t border-slate-800 rounded-b-xl flex justify-end">
      <button @click="saveChanges" class="bg-blue-600 hover:bg-blue-700 text-white font-semibold px-4 py-2 rounded-lg transition-colors">Save Changes</button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { useToastStore } from '@/stores/toast';

defineProps<{
  levelingEnabled: boolean;
  xpPerMessage: number;
  xpCooldown: number;
}>();

defineEmits<{
  (e: 'update:levelingEnabled', value: boolean): void;
  (e: 'update:xpPerMessage', value: number): void;
  (e: 'update:xpCooldown', value: number): void;
}>();

const toastStore = useToastStore();

const saveChanges = () => {
  // In a real app, this would make an API call.
  toastStore.addToast('General leveling settings saved successfully!', 'success');
};
</script>
