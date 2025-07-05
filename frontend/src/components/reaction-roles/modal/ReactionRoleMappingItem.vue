
<template>
  <div class="bg-slate-800/50 p-4 rounded-lg space-y-4">
    <div class="flex items-center space-x-3">
      <div class="relative">
        <input type="text" :value="mapping.emoji" @input="updateMapping('emoji', ($event.target as HTMLInputElement).value)" placeholder="👍" class="w-16 text-center bg-slate-700 border border-slate-600 rounded-md px-2 py-1 text-white text-xl transition-colors pr-8">
        <button 
          @click="toggleEmojiPicker" 
          :class="['emoji-picker-button', 'absolute', 'right-0', 'top-0', 'h-full', 'px-2', 'text-slate-400', 'hover:text-white']"
          aria-label="Select emoji"
        >
          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><path d="M8 14s1.5 2 4 2 4-2 4-2"/><line x1="9" y1="9" x2="9.01" y2="9"/><line x1="15" y1="9" x2="15.01" y2="9"/></svg>
        </button>
        <div v-if="isEmojiPickerOpen" ref="emojiPickerContainer" class="absolute z-20 top-full mt-2 -left-4">
          <EmojiPicker :native="true" @select="onSelectEmoji" />
        </div>
      </div>
      <div class="text-slate-400 text-lg">→</div>
      <div class="flex-grow space-y-2">
        <div v-for="(role, roleIndex) in mapping.roles" :key="roleIndex" class="flex items-center space-x-2">
          <input type="text" :value="role.roleName" @input="updateRole(roleIndex, 'roleName', ($event.target as HTMLInputElement).value)" placeholder="Role Name" class="flex-grow bg-slate-700 border border-slate-600 rounded-md px-3 py-1 text-white transition-colors">
            <button @click="emit('removeRole', roleIndex)" class="text-slate-500 hover:text-red-400 p-1.5 rounded-md hover:bg-slate-700 transition-colors" aria-label="Delete Role">
            <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 6h18"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6"/><path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
          </button>
        </div>
      </div>
        <button @click="emit('removeMapping')" class="text-slate-400 hover:text-red-400 p-2 rounded-md hover:bg-slate-700/50 transition-colors self-start" aria-label="Delete Reaction">
        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>
      </button>
    </div>
    <button @click="emit('addRole')" class="text-xs font-semibold text-blue-400 hover:text-blue-300 transition-colors flex items-center space-x-1 pl-20">
      <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12h14"/><path d="M12 5v14"/></svg>
      <span>Add Role</span>
    </button>

    <div class="border-t border-slate-700/50 !my-3 ml-20"></div>

    <div class="flex items-start justify-between pl-20">
        <div>
          <label :for="'tempRoleEnabled' + mappingIndex" class="font-medium text-slate-200 text-sm">Temporary Role</label>
          <p class="text-xs text-slate-400 mt-1 max-w-sm">When enabled, the role(s) will be removed after a set time.</p>
        </div>
        <label class="relative inline-flex items-center cursor-pointer mt-1">
          <input type="checkbox" :id="'tempRoleEnabled' + mappingIndex" :checked="!!mapping.duration" @change="toggleTempRole(($event.target as HTMLInputElement).checked)" class="sr-only peer">
          <div class="w-11 h-6 bg-slate-700 rounded-full peer peer-checked:after:translate-x-full after:content-[''] after:absolute after:top-0.5 after:left-[2px] after:bg-white after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
        </label>
    </div>

    <div v-if="mapping.duration" class="pl-20 mt-3 space-y-2">
      <label class="block text-xs font-medium text-slate-300">Duration</label>
      <div class="flex space-x-2">
        <input type="number" :value="mapping.duration.value" @input="updateDuration('value', Number(($event.target as HTMLInputElement).value))" class="w-full bg-slate-700 border border-slate-600 rounded-lg px-4 py-2 text-white focus:ring-blue-500 focus:border-blue-500" placeholder="e.g. 7">
        <select :value="mapping.duration.unit" @change="updateDuration('unit', ($event.target as HTMLSelectElement).value)" class="bg-slate-700 border border-slate-600 rounded-lg px-4 py-2 text-white focus:ring-blue-500 focus:border-blue-500">
          <option value="minutes">Minutes</option>
          <option value="hours">Hours</option>
          <option value="days">Days</option>
        </select>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue';
import EmojiPicker from 'vue3-emoji-picker';
import { onClickOutside } from '@vueuse/core';
import type { ReactionMapping, Role } from '@/types/reaction-roles';

interface RoleFormData extends Omit<Role, 'roleId'> {
  roleId?: string;
}
interface ReactionMappingFormData extends Omit<ReactionMapping, 'roles'> {
  roles: RoleFormData[];
  duration?: {
    value: number;
    unit: 'minutes' | 'hours' | 'days';
  };
}

const props = defineProps<{
  mapping: ReactionMappingFormData,
  mappingIndex: number
}>();

const emit = defineEmits<{
  (e: 'update:mapping', value: ReactionMappingFormData): void;
  (e: 'removeMapping'): void;
  (e: 'addRole'): void;
  (e: 'removeRole', roleIndex: number): void;
}>();

const isEmojiPickerOpen = ref(false);
const emojiPickerContainer = ref<HTMLElement | null>(null);

onClickOutside(emojiPickerContainer, () => {
  isEmojiPickerOpen.value = false;
});

const toggleEmojiPicker = () => {
  isEmojiPickerOpen.value = !isEmojiPickerOpen.value;
};

const onSelectEmoji = (emoji: { i: string }) => {
  updateMapping('emoji', emoji.i);
  isEmojiPickerOpen.value = false;
};

const updateMapping = (key: keyof ReactionMappingFormData, value: any) => {
  emit('update:mapping', { ...props.mapping, [key]: value });
};

const updateRole = (roleIndex: number, key: keyof RoleFormData, value: any) => {
  const newRoles = [...props.mapping.roles];
  newRoles[roleIndex] = { ...newRoles[roleIndex], [key]: value };
  updateMapping('roles', newRoles);
};

const toggleTempRole = (isEnabled: boolean) => {
  if (isEnabled) {
    updateMapping('duration', { value: 24, unit: 'hours' });
  } else {
    const newMapping = { ...props.mapping };
    delete newMapping.duration;
    emit('update:mapping', newMapping);
  }
};

const updateDuration = (key: 'value' | 'unit', value: any) => {
  updateMapping('duration', { ...props.mapping.duration, [key]: value });
};
</script>
