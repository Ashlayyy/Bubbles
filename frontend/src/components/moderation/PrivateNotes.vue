
<template>
  <div class="space-y-4">
    <h3 class="text-lg font-semibold text-white">Private Moderator Notes</h3>
    
    <!-- Notes List -->
    <div class="space-y-3 max-h-48 overflow-y-auto pr-2">
      <div v-if="notes.length === 0" class="text-sm text-slate-500 text-center py-4">
        No private notes for this user.
      </div>
      <div v-for="note in notes" :key="note.id" class="bg-slate-800/60 p-3 rounded-lg text-sm">
        <p class="text-slate-300">{{ note.content }}</p>
        <div class="text-xs text-slate-500 mt-2 flex justify-between">
          <span>by @{{ note.moderator.name }}</span>
          <span>{{ formatTimestamp(note.timestamp) }}</span>
        </div>
      </div>
    </div>
    
    <!-- Add Note Form -->
    <form @submit.prevent="handleAddNote">
      <textarea
        v-model="newNote"
        rows="2"
        class="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-white text-sm focus:ring-blue-500 focus:border-blue-500"
        placeholder="Add a new private note..."
      ></textarea>
      <div class="text-right mt-2">
        <button type="submit" class="bg-blue-600 hover:bg-blue-500 text-white font-semibold px-3 py-1.5 rounded-lg text-sm transition-colors" :disabled="!newNote.trim()">
          Add Note
        </button>
      </div>
    </form>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue';
import type { ModeratorNote } from '@/types/moderation';
import { formatDistanceToNow } from 'date-fns';

defineProps<{
  notes: ModeratorNote[];
}>();

const emit = defineEmits<{
  (e: 'add-note', content: string): void;
}>();

const newNote = ref('');

const handleAddNote = () => {
  if (!newNote.value.trim()) return;
  emit('add-note', newNote.value.trim());
  newNote.value = '';
};

const formatTimestamp = (timestamp: Date) => {
  return formatDistanceToNow(timestamp, { addSuffix: true });
};
</script>
