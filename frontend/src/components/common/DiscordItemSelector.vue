
<template>
  <div class="relative" ref="selectorRef">
    <div class="bg-slate-800 border border-slate-700 rounded-lg p-2 min-h-[90px]">
      <div v-if="selectedItems.length > 0" class="flex flex-wrap gap-2">
        <div 
          v-for="item in selectedItems" 
          :key="item.id" 
          class="flex items-center gap-2 bg-slate-700 rounded-md px-2 py-1"
          :class="{ 
            'text-purple-300 bg-purple-500/10': itemType === 'role', 
            'text-sky-300 bg-sky-500/10': itemType === 'channel' 
          }"
        >
          <span class="font-medium text-sm">{{ itemType === 'role' ? '@' : '#' }}{{ item.name }}</span>
          <button @click="toggleItem(item.id)" class="text-slate-500 hover:text-white">
            <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
          </button>
        </div>
      </div>
      <div v-else class="flex items-center justify-center h-full min-h-[66px]">
        <p class="text-slate-500 text-sm">{{ placeholder }}</p>
      </div>

      <button @click="isDropdownOpen = !isDropdownOpen" class="absolute top-2 right-2 bg-slate-700 hover:bg-slate-600 text-slate-300 font-semibold px-2 py-1 rounded-md transition-colors text-xs">
        {{ isDropdownOpen ? 'Close' : 'Add' }}
      </button>
    </div>

    <div v-if="isDropdownOpen" class="absolute z-10 top-full mt-2 w-full bg-slate-800 border border-slate-700 rounded-lg shadow-xl overflow-hidden">
      <div class="p-2">
        <input type="text" v-model="searchQuery" placeholder="Search..." class="w-full bg-slate-900 border border-slate-700 rounded-md px-3 py-1.5 text-white placeholder-slate-500 focus:ring-2 focus:ring-blue-500 outline-none transition-colors">
      </div>
      <ul class="max-h-60 overflow-y-auto">
        <li v-for="item in availableItems" :key="item.id">
          <button @click="toggleItem(item.id)" class="w-full text-left px-3 py-2 hover:bg-slate-700/50 flex items-center justify-between" :class="{ 'bg-slate-700': isSelected(item.id) }">
            <span class="text-slate-200">{{ item.name }}</span>
            <span v-if="isSelected(item.id)" class="text-blue-400">
              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>
            </span>
          </button>
        </li>
        <li v-if="availableItems.length === 0" class="px-3 py-2 text-slate-500 text-sm text-center">No results found.</li>
      </ul>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue';
import { onClickOutside } from '@vueuse/core';
import type { DiscordItem } from '@/types/discord';

const props = defineProps<{
  items: DiscordItem[];
  selectedIds: string[] | string;
  multiple: boolean;
  placeholder: string;
  itemType: 'role' | 'channel';
}>();

const emit = defineEmits(['update:selectedIds']);

const selectorRef = ref(null);
const isDropdownOpen = ref(false);
const searchQuery = ref('');

onClickOutside(selectorRef, () => {
  isDropdownOpen.value = false;
  searchQuery.value = '';
});

const selectedItemsMap = computed(() => {
  const ids = Array.isArray(props.selectedIds) ? props.selectedIds : [props.selectedIds];
  return new Map(props.items.filter(item => ids.includes(item.id)).map(item => [item.id, item]));
});

const selectedItems = computed(() => Array.from(selectedItemsMap.value.values()));

const availableItems = computed(() => {
  return props.items.filter(item => 
    item.name.toLowerCase().includes(searchQuery.value.toLowerCase())
  );
});

const isSelected = (id: string) => {
  return Array.isArray(props.selectedIds) 
    ? props.selectedIds.includes(id) 
    : props.selectedIds === id;
};

const toggleItem = (id: string) => {
  if (props.multiple) {
    const currentSelected = new Set(props.selectedIds as string[]);
    if (currentSelected.has(id)) {
      currentSelected.delete(id);
    } else {
      currentSelected.add(id);
    }
    emit('update:selectedIds', Array.from(currentSelected));
  } else {
    emit('update:selectedIds', id);
    isDropdownOpen.value = false;
  }
};
</script>
