
<template>
  <div class="bg-slate-900 border border-slate-800 rounded-xl">
    <div class="p-6 border-b border-slate-800 flex items-center justify-between">
      <div>
        <h2 class="text-xl font-semibold text-white">Role Rewards</h2>
        <p class="text-slate-400 mt-1">Automatically assign roles to users as they level up.</p>
      </div>
      <button @click="addReward" class="bg-blue-600 hover:bg-blue-700 text-white font-semibold px-3 py-2 rounded-lg transition-colors text-sm flex items-center space-x-2">
        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12h14"/><path d="M12 5v14"/></svg>
        <span>Add Reward</span>
      </button>
    </div>
    <div class="p-6" :class="{ 'opacity-50 pointer-events-none': !levelingEnabled }">
      <div v-if="roleRewards.length > 0" class="space-y-4">
        <div v-for="(reward, index) in roleRewards" :key="index" class="flex items-center justify-between bg-slate-800 p-4 rounded-lg">
          <div class="flex items-center space-x-4 flex-grow">
            <div class="text-slate-400">Level</div>
            <input type="number" :value="reward.level" @input="updateRewardLevel(index, Number(($event.target as HTMLInputElement).value))" class="w-20 bg-slate-700 border border-slate-600 rounded-md px-3 py-1 text-white text-center">
            <div class="text-slate-400 text-lg">→</div>
            <div class="flex-grow">
              <DiscordItemSelector
                :items="allRoles"
                :selected-ids="reward.roleId"
                @update:selected-ids="updateRewardRole(index, $event)"
                :multiple="false"
                item-type="role"
                placeholder="Select a role"
              />
            </div>
          </div>
          <button @click="removeReward(index)" class="text-slate-500 hover:text-red-400 p-1 ml-4">
            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 6h18"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6"/><path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/><line x1="10" y1="11" x2="10" y2="17"/><line x1="14" y1="11" x2="14" y2="17"/></svg>
          </button>
        </div>
      </div>
      <div v-else class="text-center py-8">
        <p class="text-slate-500">No role rewards configured.</p>
        <button @click="addReward" class="mt-4 bg-blue-600/50 hover:bg-blue-600/80 text-white font-semibold px-4 py-2 rounded-lg transition-colors text-sm">Add first reward</button>
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

interface RoleReward {
  level: number;
  roleId: string;
  roleName: string;
}

const props = defineProps<{
  levelingEnabled: boolean;
  roleRewards: RoleReward[];
  allRoles: DiscordItem[];
}>();

const emit = defineEmits<{
  (e: 'update:roleRewards', value: RoleReward[]): void;
}>();

const toastStore = useToastStore();

const addReward = () => {
  const newRewards = [...props.roleRewards, { level: 1, roleId: '', roleName: '' }];
  emit('update:roleRewards', newRewards);
};

const removeReward = (index: number) => {
  const newRewards = [...props.roleRewards];
  newRewards.splice(index, 1);
  emit('update:roleRewards', newRewards);
};

const updateRewardLevel = (index: number, level: number) => {
  if (isNaN(level) || level < 1) return;
  const newRewards = [...props.roleRewards];
  newRewards[index] = { ...newRewards[index], level: level };
  emit('update:roleRewards', newRewards);
};

const updateRewardRole = (index: number, roleId: string) => {
  const role = props.allRoles.find(r => r.id === roleId);
  if (role) {
    const newRewards = [...props.roleRewards];
    newRewards[index] = { ...newRewards[index], roleId: role.id, roleName: role.name };
    emit('update:roleRewards', newRewards);
  }
};

const saveChanges = () => {
  // Can add validation here to ensure all rewards are fully configured
  toastStore.addToast('Role rewards saved successfully!', 'success');
};
</script>
