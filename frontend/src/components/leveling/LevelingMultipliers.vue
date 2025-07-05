
<template>
  <div class="bg-slate-900 border border-slate-800 rounded-xl">
    <div class="p-6 border-b border-slate-800 flex items-center justify-between">
      <div>
        <h2 class="text-xl font-semibold text-white">XP Multipliers</h2>
        <p class="text-slate-400 mt-1">Grant bonus XP to specific roles or in certain channels.</p>
      </div>
      <button @click="addMultiplier" class="bg-blue-600 hover:bg-blue-700 text-white font-semibold px-3 py-2 rounded-lg transition-colors text-sm flex items-center space-x-2">
        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12h14"/><path d="M12 5v14"/></svg>
        <span>Add Multiplier</span>
      </button>
    </div>
    <div class="p-6" :class="{ 'opacity-50 pointer-events-none': !levelingEnabled }">
      <div v-if="xpMultipliers.length > 0" class="space-y-4">
        <div v-for="(item, index) in xpMultipliers" :key="item.uid" class="flex items-center justify-between bg-slate-800 p-4 rounded-lg">
          <div class="flex items-center space-x-4 flex-grow">
            
            <select :value="item.type" @change="updateMultiplierType(index, ($event.target as HTMLSelectElement).value as 'role'|'channel')" class="bg-slate-700 border border-slate-600 rounded-md px-3 py-2 text-white self-stretch">
              <option value="role">Role</option>
              <option value="channel">Channel</option>
            </select>

            <div class="flex-grow">
              <DiscordItemSelector
                v-if="item.type === 'role'"
                :items="allRoles"
                :selected-ids="item.id"
                @update:selected-ids="updateMultiplierItem(index, $event)"
                :multiple="false"
                item-type="role"
                placeholder="Select a role"
              />
              <DiscordItemSelector
                v-else
                :items="allChannels"
                :selected-ids="item.id"
                @update:selected-ids="updateMultiplierItem(index, $event)"
                :multiple="false"
                item-type="channel"
                placeholder="Select a channel"
              />
            </div>
            
            <div class="text-slate-400">Multiplier:</div>
            <input type="number" :value="item.multiplier" @input="updateMultiplierValue(index, Number(($event.target as HTMLInputElement).value))" step="0.1" class="w-20 bg-slate-700 border border-slate-600 rounded-md px-3 py-1 text-white text-center">
            <div class="text-slate-400">x</div>
          </div>
          <button @click="removeMultiplier(item.uid)" class="text-slate-500 hover:text-red-400 p-1 ml-4">
            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 6h18"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6"/><path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/><line x1="10" y1="11" x2="10" y2="17"/><line x1="14" y1="11" x2="14" y2="17"/></svg>
          </button>
        </div>
      </div>
      <div v-else class="text-center py-8">
        <p class="text-slate-500">No XP multipliers configured.</p>
         <button @click="addMultiplier" class="mt-4 bg-blue-600/50 hover:bg-blue-600/80 text-white font-semibold px-4 py-2 rounded-lg transition-colors text-sm">Add first multiplier</button>
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

interface XPMultiplier {
  uid: string;
  type: 'role' | 'channel';
  id: string;
  name: string;
  multiplier: number;
}

const props = defineProps<{
  levelingEnabled: boolean;
  xpMultipliers: XPMultiplier[];
  allRoles: DiscordItem[];
  allChannels: DiscordItem[];
}>();

const emit = defineEmits<{
  (e: 'update:xpMultipliers', value: XPMultiplier[]): void;
}>();

const toastStore = useToastStore();

const addMultiplier = () => {
  const newMultiplier: XPMultiplier = { 
    uid: Math.random().toString(36).substr(2, 9), 
    type: 'role', 
    id: '', 
    name: '', 
    multiplier: 1.5 
  };
  const newMultipliers = [...props.xpMultipliers, newMultiplier];
  emit('update:xpMultipliers', newMultipliers);
};

const removeMultiplier = (uid: string) => {
  const newMultipliers = props.xpMultipliers.filter(m => m.uid !== uid);
  emit('update:xpMultipliers', newMultipliers);
};

const updateMultiplier = (index: number, newValues: Partial<Omit<XPMultiplier, 'uid'>>) => {
  const newMultipliers = [...props.xpMultipliers];
  newMultipliers[index] = { ...newMultipliers[index], ...newValues };
  emit('update:xpMultipliers', newMultipliers);
};

const updateMultiplierType = (index: number, type: 'role' | 'channel') => {
  updateMultiplier(index, { type, id: '', name: '' });
};

const updateMultiplierItem = (index: number, id: string) => {
  const itemType = props.xpMultipliers[index].type;
  const items = itemType === 'role' ? props.allRoles : props.allChannels;
  const item = items.find(i => i.id === id);
  if (item) {
    updateMultiplier(index, { id, name: item.name });
  }
};

const updateMultiplierValue = (index: number, multiplier: number) => {
  if (isNaN(multiplier) || multiplier <= 0) return;
  updateMultiplier(index, { multiplier });
};

const saveChanges = () => {
  toastStore.addToast('XP multipliers saved successfully!', 'success');
};
</script>

