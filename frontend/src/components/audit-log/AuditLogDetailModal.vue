
<template>
  <div v-if="isOpen && log" @click="handleBackdropClick" class="fixed inset-0 bg-black bg-opacity-70 z-50 flex justify-center items-center p-4">
    <div class="bg-slate-900 border border-slate-800 rounded-xl w-full max-w-2xl max-h-[90vh] flex flex-col" @click.stop>
      <div class="p-6 border-b border-slate-800 flex justify-between items-center">
        <div>
          <h2 class="text-xl font-bold text-white">Log Details</h2>
          <p class="text-sm text-slate-400">ID: {{ log.id }}</p>
        </div>
        <button @click="$emit('close')" class="text-slate-500 hover:text-white transition-colors">
            <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
        </button>
      </div>
      <div class="p-6 overflow-y-auto space-y-6">
        <!-- Main Info -->
        <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <h3 class="text-xs text-slate-500 font-semibold uppercase tracking-wider mb-2">Executor</h3>
            <div class="flex items-center gap-3">
              <div class="w-10 h-10 bg-slate-800 rounded-full flex items-center justify-center shrink-0">
                <span class="text-lg font-bold">{{ log.executor.name.charAt(0) }}</span>
              </div>
              <div>
                <p class="font-semibold text-white">{{ log.executor.name }}</p>
                <p class="text-xs text-slate-400 font-mono">{{ log.executor.id }}</p>
              </div>
            </div>
          </div>
          <div>
            <h3 class="text-xs text-slate-500 font-semibold uppercase tracking-wider mb-2">Target</h3>
            <div class="flex items-center gap-3">
               <div class="w-10 h-10 bg-slate-800 rounded-full flex items-center justify-center shrink-0">
                <span class="text-lg">{{ targetIcon }}</span>
              </div>
              <div>
                <p class="font-semibold text-white">{{ log.target.name }}</p>
                <p class="text-xs text-slate-400 font-mono">{{ log.target.id }} ({{ log.target.type }})</p>
              </div>
            </div>
          </div>
        </div>
        
        <!-- Action & Reason -->
        <div>
          <h3 class="text-xs text-slate-500 font-semibold uppercase tracking-wider mb-2">Action</h3>
          <p class="font-semibold text-lg" :class="actionDetails.color">{{ actionDetails.text.charAt(0).toUpperCase() + actionDetails.text.slice(1) }}</p>
        </div>
        
        <div v-if="log.reason">
          <h3 class="text-xs text-slate-500 font-semibold uppercase tracking-wider mb-2">Reason</h3>
          <p class="text-slate-300 bg-slate-800/50 p-3 rounded-lg">{{ log.reason }}</p>
        </div>

        <!-- Metadata -->
        <div>
          <h3 class="text-xs text-slate-500 font-semibold uppercase tracking-wider mb-2">Metadata</h3>
          <div class="grid grid-cols-2 md:grid-cols-3 gap-4 text-sm">
            <div>
              <p class="text-slate-400">Timestamp</p>
              <p class="font-semibold text-white">{{ formattedTimestamp }}</p>
            </div>
            <div>
              <p class="text-slate-400">Source</p>
              <p class="font-semibold text-white">{{ log.source }}</p>
            </div>
          </div>
        </div>

        <!-- Raw Data -->
        <div>
          <h3 class="text-xs text-slate-500 font-semibold uppercase tracking-wider mb-2">Raw Data</h3>
          <pre class="bg-slate-950 p-4 rounded-lg text-xs text-slate-300 overflow-x-auto"><code>{{ JSON.stringify(log, null, 2) }}</code></pre>
        </div>
      </div>
      <div class="p-4 border-t border-slate-800 text-right shrink-0">
        <button @click="$emit('close')" class="bg-slate-700 hover:bg-slate-600 text-white font-semibold px-4 py-2 rounded-lg transition-colors text-sm">Close</button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import { format } from 'date-fns';
import type { AuditLogEntry } from '@/types/audit-log';
import { getActionDetails } from '@/lib/auditLogUtils';

const props = defineProps<{
  isOpen: boolean;
  log: AuditLogEntry | null;
}>();

const emit = defineEmits(['close']);

const actionDetails = computed(() => props.log ? getActionDetails(props.log.action) : { icon: '', text: '', color: '' });

const formattedTimestamp = computed(() => {
  if (!props.log) return '';
  return format(props.log.timestamp, "MMM d, yyyy, h:mm:ss a");
});

const targetIcon = computed(() => {
  if (!props.log) return '';
  switch (props.log.target.type) {
    case 'user': return '👤';
    case 'role': return '🛡️';
    case 'channel': return '#️⃣';
    case 'message': return '💬';
    default: return '❓';
  }
});

const handleBackdropClick = (event: MouseEvent) => {
  if (event.target === event.currentTarget) {
    emit('close');
  }
};
</script>
