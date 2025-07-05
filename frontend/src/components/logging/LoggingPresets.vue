
<template>
  <div class="bg-slate-900 border border-slate-800 rounded-xl p-6">
    <div class="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
      <div>
        <h3 class="text-lg font-semibold">Master Switch</h3>
        <p class="text-slate-400 text-sm">Use this to quickly enable or disable all logging.</p>
      </div>
      <label class="relative inline-flex items-center cursor-pointer">
        <input type="checkbox" :checked="masterEnabled" @change="$emit('update:masterEnabled', ($event.target as HTMLInputElement).checked)" class="sr-only peer">
        <div class="w-11 h-6 bg-slate-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
      </label>
    </div>
    <div class="border-t border-slate-800 my-6"></div>
    <div>
      <h3 class="text-lg font-semibold">Presets</h3>
      <p class="text-slate-400 text-sm mb-4">Apply a preset to quickly configure logging settings.</p>
      <div class="flex justify-between items-start flex-wrap gap-y-2">
        <div class="flex flex-wrap gap-2">
          <button @click="$emit('apply-preset', 'all')" :class="['px-4 py-2 rounded-lg text-sm font-medium transition-colors', activePreset === 'all' ? 'bg-blue-600 text-white' : 'bg-slate-800 hover:bg-slate-700 text-slate-300']">
            Log Everything
          </button>
          <button v-for="preset in presets" :key="preset.name" @click="$emit('apply-preset', preset.name)" :class="['px-4 py-2 rounded-lg text-sm font-medium transition-colors', activePreset === preset.name ? 'bg-blue-600 text-white' : 'bg-slate-800 hover:bg-slate-700 text-slate-300']">
            {{ preset.emoji }} {{ preset.name }}
          </button>
        </div>
        <button @click="$emit('apply-preset', 'none')" :class="['px-4 py-2 rounded-lg text-sm font-medium transition-colors', activePreset === 'none' ? 'bg-red-600/80 text-white' : 'bg-slate-800 hover:bg-slate-700 text-slate-300']">
          Log Nothing
        </button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import type { PropType } from 'vue';

defineProps({
  masterEnabled: {
    type: Boolean,
    required: true,
  },
  activePreset: {
    type: String as PropType<string | null>,
    required: true,
  },
  presets: {
    type: Array as PropType<any[]>,
    required: true,
  }
});

defineEmits(['update:masterEnabled', 'apply-preset']);
</script>
