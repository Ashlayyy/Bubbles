
<template>
  <div class="space-y-3">
    <div class="flex gap-2">
      <input
        v-model.trim="newWord"
        @keydown.enter.prevent="addWord"
        type="text"
        placeholder="Type a word or phrase and press Enter"
        class="flex-grow bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-white text-sm focus:ring-blue-500 focus:border-blue-500"
      />
      <button
        @click="addWord"
        :disabled="!newWord"
        class="bg-blue-600 hover:bg-blue-700 text-white font-semibold px-4 py-2 rounded-lg transition-colors disabled:bg-slate-600 disabled:cursor-not-allowed"
      >
        Add
      </button>
    </div>
    <div v-if="modelValue.length > 0" class="flex flex-wrap gap-2">
      <span v-for="(word, index) in modelValue" :key="index" class="flex items-center gap-2 bg-slate-700 text-slate-200 text-sm font-medium px-2.5 py-1 rounded-full">
        {{ word }}
        <button @click="removeWord(index)" class="text-slate-400 hover:text-white">
          <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
        </button>
      </span>
    </div>
    <p v-else class="text-sm text-slate-500 text-center py-2">No words added yet.</p>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue';

const props = defineProps<{
  modelValue: string[];
}>();

const emit = defineEmits<{
  (e: 'update:modelValue', value: string[]): void;
}>();

const newWord = ref('');

const addWord = () => {
  if (newWord.value && !props.modelValue.includes(newWord.value)) {
    const updatedWords = [...props.modelValue, newWord.value];
    emit('update:modelValue', updatedWords);
    newWord.value = '';
  }
};

const removeWord = (index: number) => {
  const updatedWords = props.modelValue.filter((_, i) => i !== index);
  emit('update:modelValue', updatedWords);
};
</script>
