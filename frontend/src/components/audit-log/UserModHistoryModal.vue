<template>
  <div v-if="isOpen && user" class="fixed inset-0 bg-black bg-opacity-70 z-50 flex justify-center items-start p-4 pt-10" @click.self="closeModal">
    <div class="bg-slate-900 rounded-xl shadow-lg w-full max-w-3xl border border-slate-800 max-h-[90vh] flex flex-col">
      <div class="p-6 border-b border-slate-800 flex justify-between items-start">
        <div>
          <h2 class="text-xl font-semibold text-white">Moderation History for {{ user.name }}</h2>
          <div class="flex items-center gap-4 mt-1">
            <p class="text-slate-500 text-sm">User ID: {{ user.id }}</p>
            <div v-if="warningsCount > 0" class="flex items-center gap-1.5 bg-yellow-500/10 text-yellow-300 text-xs font-semibold px-2 py-0.5 rounded-full">
               <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10"/><path d="M12 8v4"/><path d="M12 16h.01"/></svg>
              <span>{{ warningsCount }} {{ warningsCount > 1 ? 'Warnings' : 'Warning' }}</span>
            </div>
          </div>
          <div v-if="user.joinDate || (user.roles && user.roles.length > 0)" class="mt-4 pt-4 border-t border-slate-800">
            <div class="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
              <div v-if="user.joinDate">
                <p class="text-slate-400 font-medium">Joined Server</p>
                <p class="text-white">{{ formatJoinDate(user.joinDate) }}</p>
              </div>
              <div v-if="user.roles && user.roles.length > 0">
                <p class="text-slate-400 font-medium">Roles</p>
                <div class="flex flex-wrap gap-1.5 mt-1">
                  <span v-for="role in user.roles" :key="role" class="bg-slate-700 text-slate-300 text-xs font-medium px-2 py-0.5 rounded-full">
                    {{ role }}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
        <button @click="closeModal" class="text-slate-400 hover:text-white">
          <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
        </button>
      </div>

      <div class="p-6 grid grid-cols-1 md:grid-cols-2 gap-6 overflow-y-auto">
        <!-- History Column -->
        <div class="space-y-4">
          <h3 class="text-lg font-semibold text-white">Case History</h3>
          <div v-if="history.length > 0" class="space-y-3 max-h-96 overflow-y-auto pr-2">
            <div v-for="entry in history" :key="entry.id" class="p-4 bg-slate-800/50 rounded-lg">
                <div class="flex justify-between items-start">
                    <div class="flex items-center gap-3">
                      <span :class="getActionDetails(entry.action).color" class="text-xl w-6 text-center">{{ getActionDetails(entry.action).icon }}</span>
                      <div>
                        <span class="font-semibold text-white">{{ formatAction(entry.action) }}</span>
                        <span class="text-sm text-slate-400"> by {{ entry.executor.name }}</span>
                      </div>
                    </div>
                    <span class="text-xs text-slate-500">{{ formatTimestamp(entry.timestamp) }}</span>
                </div>
                <p v-if="entry.reason" class="text-sm text-slate-400 mt-2 pl-9">
                    <span class="font-semibold">Reason:</span> {{ entry.reason }}
                </p>
            </div>
          </div>
          <div v-else class="text-center py-10 text-slate-500">
            <p>No moderation history found for this user.</p>
          </div>
        </div>

        <!-- Notes Column -->
        <div class="space-y-4">
          <PrivateNotes :notes="notes" @add-note="handleAddNote" />
        </div>
      </div>
      
       <div class="p-4 border-t border-slate-800 bg-slate-900/50 flex justify-between items-center gap-4 mt-auto">
        <div>
          <ModerationActionButtons @action="handleAction" />
        </div>
        <div class="flex items-center gap-4">
          <button @click="viewInAuditLog" class="text-sm font-medium text-blue-400 hover:text-blue-300 hover:underline">
            View in Audit Log
          </button>
          <button @click="closeModal" class="bg-slate-700 hover:bg-slate-600 text-white font-semibold px-4 py-2 rounded-lg transition-colors">Close</button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import { useRouter } from 'vue-router';
import { formatDistanceToNow, format } from 'date-fns';
import type { AuditLogEntry, AuditLogUser } from '@/types/audit-log';
import type { ModeratorNote } from '@/types/moderation';
import { getActionDetails } from '@/lib/auditLogUtils';
import ModerationActionButtons from '@/components/moderation/ModerationActionButtons.vue';
import PrivateNotes from '@/components/moderation/PrivateNotes.vue';

const props = defineProps<{
  isOpen: boolean;
  user: AuditLogUser | null;
  history: AuditLogEntry[];
  notes: ModeratorNote[];
}>();

const emit = defineEmits<{
  (e: 'close'): void;
  (e: 'action', action: 'warn' | 'mute' | 'kick' | 'ban', user: AuditLogUser): void;
  (e: 'add-note', payload: { userId: string; content: string }): void;
}>();

const router = useRouter();

const warningsCount = computed(() => {
  if (!props.history) return 0;
  return props.history.filter(entry => 
    entry.action.toUpperCase().includes('WARN')
  ).length;
});

const closeModal = () => {
  emit('close');
};

const viewInAuditLog = () => {
  if (props.user) {
    // Navigate to Audit Log, passing user ID. The Audit Log page can use this to filter.
    router.push({ path: '/audit-log', query: { userId: props.user.id } });
    closeModal();
  }
};

const handleAction = (action: 'warn' | 'mute' | 'kick' | 'ban') => {
  if (props.user) {
    emit('action', action, props.user);
  }
}

const handleAddNote = (content: string) => {
  if (props.user) {
    emit('add-note', { userId: props.user.id, content });
  }
}

const formatTimestamp = (timestamp: Date) => {
  return formatDistanceToNow(timestamp, { addSuffix: true });
};

const formatJoinDate = (date: Date) => {
  return format(date, 'MMMM d, yyyy');
};

const formatAction = (action: string) => {
    return action.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
}
</script>
