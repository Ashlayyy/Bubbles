
```vue
<template>
  <div class="p-8 max-w-7xl mx-auto">
    <div class="flex flex-col sm:flex-row sm:items-center sm:justify-between mb-2 gap-4">
        <div>
            <h1 class="text-3xl font-bold text-white">Audit Log</h1>
            <p class="text-slate-400 mt-1">View and search through events that have happened on your server.</p>
        </div>
    </div>

    <AuditLogFilters 
      v-model:searchQuery="searchQuery"
      v-model:actionFilter="selectedAction"
      v-model:sourceFilter="selectedSource"
      v-model:startDate="startDate"
      v-model:endDate="endDate"
    />
    <AuditLogList :logs="paginatedLogs" @view-user-history="openUserHistoryModal" @view-details="openDetailModal" />

    <div v-if="totalPages > 1" class="mt-6 flex flex-col sm:flex-row items-center justify-between text-sm text-slate-400 gap-4">
      <p>Showing page <span class="font-semibold text-white">{{ currentPage }}</span> of <span class="font-semibold text-white">{{ totalPages }}</span></p>
      <div class="flex items-center gap-2">
        <button @click="prevPage" :disabled="currentPage === 1" class="px-4 py-2 rounded-lg bg-slate-800 border border-slate-700 hover:bg-slate-700 disabled:bg-slate-800/50 disabled:text-slate-500 disabled:cursor-not-allowed transition-colors">
          Previous
        </button>
        <button @click="nextPage" :disabled="currentPage >= totalPages" class="px-4 py-2 rounded-lg bg-slate-800 border border-slate-700 hover:bg-slate-700 disabled:bg-slate-800/50 disabled:text-slate-500 disabled:cursor-not-allowed transition-colors">
          Next
        </button>
      </div>
    </div>
  </div>

  <UserModHistoryModal 
    :is-open="isHistoryModalOpen"
    :user="selectedUser"
    :history="userModHistory"
    @close="isHistoryModalOpen = false"
  />

  <AuditLogDetailModal
    :is-open="isDetailModalOpen"
    :log="selectedLog"
    @close="isDetailModalOpen = false"
  />
</template>

<script setup lang="ts">
import { ref, computed, watch, onMounted, onUnmounted } from 'vue';
import { useRoute } from 'vue-router';
import { startOfDay, endOfDay } from 'date-fns';
import type { AuditLogEntry, AuditLogUser } from '@/types/audit-log';
import AuditLogFilters from '@/components/audit-log/AuditLogFilters.vue';
import AuditLogList from '@/components/audit-log/AuditLogList.vue';
import UserModHistoryModal from '@/components/audit-log/UserModHistoryModal.vue';
import AuditLogDetailModal from '@/components/audit-log/AuditLogDetailModal.vue';

const mockLogs = ref<AuditLogEntry[]>([
  {
    id: '1122334455',
    executor: { id: 'admin1', name: 'Zeta' },
    action: 'MEMBER_BAN_ADD',
    target: { id: 'user1', name: 'RogueUser', type: 'user' },
    reason: 'Repeatedly violating server rules about spam.',
    timestamp: new Date(Date.now() - 2 * 60 * 1000), // 2 minutes ago
    source: 'BUBBLES',
  },
  {
    id: '1122334454',
    executor: { id: 'mod1', name: 'Leo' },
    action: 'MEMBER_KICK',
    target: { id: 'user2', name: 'Troublemaker', type: 'user' },
    reason: 'Being disruptive in voice chat.',
    timestamp: new Date(Date.now() - 15 * 60 * 1000), // 15 minutes ago
    source: 'DISCORD',
  },
  {
    id: '1122334453',
    executor: { id: 'admin1', name: 'Zeta' },
    action: 'ROLE_UPDATE',
    target: { id: 'role1', name: 'Moderator', type: 'role' },
    reason: 'Updated permissions to allow channel management.',
    timestamp: new Date(Date.now() - 60 * 60 * 1000), // 1 hour ago
    source: 'DISCORD',
  },
  {
    id: '1122334452',
    executor: { id: 'bot', name: 'Bubbles' },
    action: 'MESSAGE_BULK_DELETE',
    target: { id: 'channel1', name: 'general', type: 'channel' },
    reason: 'Auto-clear of spam messages (52 messages)',
    timestamp: new Date(Date.now() - 3 * 60 * 60 * 1000), // 3 hours ago
    source: 'BUBBLES',
  },
  {
    id: '1122334451',
    executor: { id: 'admin1', name: 'Zeta' },
    action: 'ROLE_CREATE',
    target: { id: 'role2', name: 'Verified', type: 'role' },
    reason: null,
    timestamp: new Date(Date.now() - 24 * 60 * 60 * 1000), // 1 day ago
    source: 'DISCORD',
  },
]);

const route = useRoute();
const searchQuery = ref('');
const selectedAction = ref('');
const selectedSource = ref('');
const startDate = ref('');
const endDate = ref('');

const itemsPerPage = ref(5);
const currentPage = ref(1);

const filteredLogs = computed(() => {
  let logs = mockLogs.value;

  // Date Filter
  if (startDate.value) {
    const start = startOfDay(new Date(startDate.value)).getTime();
    logs = logs.filter(log => log.timestamp.getTime() >= start);
  }
  if (endDate.value) {
    const end = endOfDay(new Date(endDate.value)).getTime();
    logs = logs.filter(log => log.timestamp.getTime() <= end);
  }
  
  // Text, Action, Source filters
  if (searchQuery.value || selectedAction.value || selectedSource.value) {
    logs = logs.filter(log => {
      const searchLower = searchQuery.value.toLowerCase();
      const matchesSearch = !searchQuery.value ||
        log.id.includes(searchQuery.value) ||
        log.executor.id.toLowerCase().includes(searchLower) ||
        log.executor.name.toLowerCase().includes(searchLower) ||
        log.target.id.toLowerCase().includes(searchLower) ||
        log.target.name.toLowerCase().includes(searchLower) ||
        log.action.toLowerCase().replace(/_/g, ' ').includes(searchLower) ||
        (log.reason && log.reason.toLowerCase().includes(searchLower));
      
      const matchesAction = !selectedAction.value || log.action === selectedAction.value;
      const matchesSource = !selectedSource.value || log.source === selectedSource.value;

      return matchesSearch && matchesAction && matchesSource;
    });
  }

  return logs.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());
});

const totalPages = computed(() => {
  const total = filteredLogs.value.length;
  if (total === 0) return 1;
  return Math.ceil(total / itemsPerPage.value);
});

const paginatedLogs = computed(() => {
  if (filteredLogs.value.length === 0) return [];
  const start = (currentPage.value - 1) * itemsPerPage.value;
  const end = start + itemsPerPage.value;
  return filteredLogs.value.slice(start, end);
});

watch(filteredLogs, () => {
    if (currentPage.value > totalPages.value) {
        currentPage.value = totalPages.value;
    }
});

const prevPage = () => {
  if (currentPage.value > 1) {
    currentPage.value--;
  }
};

const nextPage = () => {
  if (currentPage.value < totalPages.value) {
    currentPage.value++;
  }
};

const isHistoryModalOpen = ref(false);
const selectedUser = ref<AuditLogUser | null>(null);
const userModHistory = ref<AuditLogEntry[]>([]);

const mockUserHistories: Record<string, AuditLogEntry[]> = {
  'admin1': [
    {
      id: '1122334455',
      executor: { id: 'admin1', name: 'Zeta' },
      action: 'MEMBER_BAN_ADD',
      target: { id: 'user1', name: 'RogueUser', type: 'user' },
      reason: 'Repeatedly violating server rules about spam.',
      timestamp: new Date(Date.now() - 2 * 60 * 1000),
      source: 'BUBBLES',
    },
    {
      id: '1122334453',
      executor: { id: 'admin1', name: 'Zeta' },
      action: 'ROLE_UPDATE',
      target: { id: 'role1', name: 'Moderator', type: 'role' },
      reason: 'Updated permissions to allow channel management.',
      timestamp: new Date(Date.now() - 60 * 60 * 1000),
      source: 'DISCORD',
    },
     {
      id: '1122334451',
      executor: { id: 'admin1', name: 'Zeta' },
      action: 'ROLE_CREATE',
      target: { id: 'role2', name: 'Verified', type: 'role' },
      reason: null,
      timestamp: new Date(Date.now() - 24 * 60 * 60 * 1000),
      source: 'DISCORD',
    },
  ],
  'mod1': [
      {
        id: '1122334454',
        executor: { id: 'mod1', name: 'Leo' },
        action: 'MEMBER_KICK',
        target: { id: 'user2', name: 'Troublemaker', type: 'user' },
        reason: 'Being disruptive in voice chat.',
        timestamp: new Date(Date.now() - 15 * 60 * 1000),
        source: 'DISCORD',
      },
  ],
  'bot': [],
};

const openUserHistoryModal = (user: AuditLogUser) => {
  selectedUser.value = user;
  userModHistory.value = mockUserHistories[user.id] || [];
  isHistoryModalOpen.value = true;
};

const isDetailModalOpen = ref(false);
const selectedLog = ref<AuditLogEntry | null>(null);

const openDetailModal = (log: AuditLogEntry) => {
  selectedLog.value = log;
  isDetailModalOpen.value = true;
};

// Real-time updates
let realTimeInterval: number | undefined;

const possibleActions = ['MESSAGE_DELETE', 'ROLE_UPDATE', 'MEMBER_KICK', 'MEMBER_BAN_ADD'];
const possibleTargets = [
    { id: 'channel-general', name: 'general', type: 'channel' },
    { id: 'user-newbie', name: 'Newbie', type: 'user' },
];
const possibleExecutors = [
    { id: 'mod1', name: 'Leo' },
    { id: 'bot', name: 'Bubbles' },
    { id: 'admin1', name: 'Zeta' },
];

onMounted(() => {
  if (route.query.userId && typeof route.query.userId === 'string') {
    searchQuery.value = route.query.userId;
  }
    
  realTimeInterval = window.setInterval(() => {
    const newLog: AuditLogEntry = {
      id: Math.random().toString(36).substring(2, 12),
      executor: possibleExecutors[Math.floor(Math.random() * possibleExecutors.length)],
      action: possibleActions[Math.floor(Math.random() * possibleActions.length)],
      target: possibleTargets[Math.floor(Math.random() * possibleTargets.length)],
      reason: 'A new event occurred in real-time.',
      timestamp: new Date(),
      source: Math.random() > 0.5 ? 'BUBBLES' : 'DISCORD',
    };
    mockLogs.value.unshift(newLog);
  }, 8000); // Add a new log every 8 seconds
});

onUnmounted(() => {
  clearInterval(realTimeInterval);
});
</script>
```
