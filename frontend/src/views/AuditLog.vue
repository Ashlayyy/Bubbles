<template>
  <div class="max-w-7xl mx-auto">
    <div class="flex flex-col sm:flex-row sm:items-center sm:justify-between mb-2 gap-4">
        <div>
            <h1 class="text-3xl font-bold text-foreground">Audit Log</h1>
            <p class="text-muted-foreground mt-1">View and search through events that have happened on your server.</p>
        </div>
    </div>

    <p v-if="loadError" class="text-red-400 mt-4">{{ loadError }}</p>
    <p v-else-if="loading" class="text-muted-foreground mt-6">Loading audit log…</p>

    <AuditLogFilters 
      v-model:searchQuery="searchQuery"
      v-model:actionFilter="selectedAction"
      v-model:sourceFilter="selectedSource"
      v-model:startDate="startDate"
      v-model:endDate="endDate"
    />
    <AuditLogList :logs="paginatedLogs" @view-user-history="openUserHistoryModal" @view-details="openDetailModal" />
    <p v-if="!loading && paginatedLogs.length === 0" class="text-muted-foreground mt-6">No audit log events yet.</p>

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
import { ref, computed, watch, onMounted } from 'vue';
import { useRoute } from 'vue-router';
import { startOfDay, endOfDay } from 'date-fns';
import type { AuditLogEntry, AuditLogUser } from '@/types/audit-log';
import AuditLogFilters from '@/components/audit-log/AuditLogFilters.vue';
import AuditLogList from '@/components/audit-log/AuditLogList.vue';
import UserModHistoryModal from '@/components/audit-log/UserModHistoryModal.vue';
import AuditLogDetailModal from '@/components/audit-log/AuditLogDetailModal.vue';
import { auditEndpoints } from '@/lib/endpoints/audit';

const ACTION_NAMES: Record<number, string> = {
  1: 'GUILD_UPDATE',
  10: 'CHANNEL_CREATE',
  11: 'CHANNEL_UPDATE',
  12: 'CHANNEL_DELETE',
  13: 'CHANNEL_OVERWRITE_CREATE',
  14: 'CHANNEL_OVERWRITE_UPDATE',
  15: 'CHANNEL_OVERWRITE_DELETE',
  20: 'MEMBER_KICK',
  21: 'MEMBER_PRUNE',
  22: 'MEMBER_BAN_ADD',
  23: 'MEMBER_BAN_REMOVE',
  24: 'MEMBER_UPDATE',
  25: 'MEMBER_ROLE_UPDATE',
  26: 'MEMBER_MOVE',
  27: 'MEMBER_DISCONNECT',
  28: 'BOT_ADD',
  30: 'ROLE_CREATE',
  31: 'ROLE_UPDATE',
  32: 'ROLE_DELETE',
  40: 'INVITE_CREATE',
  41: 'INVITE_UPDATE',
  42: 'INVITE_DELETE',
  50: 'WEBHOOK_CREATE',
  51: 'WEBHOOK_UPDATE',
  52: 'WEBHOOK_DELETE',
  60: 'EMOJI_CREATE',
  61: 'EMOJI_UPDATE',
  62: 'EMOJI_DELETE',
  72: 'MESSAGE_DELETE',
  73: 'MESSAGE_BULK_DELETE',
  74: 'MESSAGE_PIN',
  75: 'MESSAGE_UNPIN',
  80: 'INTEGRATION_CREATE',
  81: 'INTEGRATION_UPDATE',
  82: 'INTEGRATION_DELETE',
  83: 'STAGE_INSTANCE_CREATE',
  84: 'STAGE_INSTANCE_UPDATE',
  85: 'STAGE_INSTANCE_DELETE',
  90: 'STICKER_CREATE',
  91: 'STICKER_UPDATE',
  92: 'STICKER_DELETE',
  100: 'GUILD_SCHEDULED_EVENT_CREATE',
  101: 'GUILD_SCHEDULED_EVENT_UPDATE',
  102: 'GUILD_SCHEDULED_EVENT_DELETE',
  110: 'THREAD_CREATE',
  111: 'THREAD_UPDATE',
  112: 'THREAD_DELETE',
  121: 'APPLICATION_COMMAND_PERMISSION_UPDATE',
  140: 'AUTO_MODERATION_RULE_CREATE',
  141: 'AUTO_MODERATION_RULE_UPDATE',
  142: 'AUTO_MODERATION_RULE_DELETE',
  143: 'AUTO_MODERATION_BLOCK_MESSAGE',
  144: 'AUTO_MODERATION_FLAG_TO_CHANNEL',
  145: 'AUTO_MODERATION_USER_COMMUNICATION_DISABLED',
};

function snowflakeDate(id: string): Date {
  try {
    return new Date(Number(BigInt(id) >> 22n) + 1420070400000);
  } catch {
    return new Date();
  }
}

function mapAuditPayload(payload: any): AuditLogEntry[] {
  const root = payload?.data ?? payload;
  const entries = root?.audit_log_entries ?? root?.auditLogEntries ?? [];
  const users = new Map(
    (root?.users ?? []).map((user: any) => [user.id, user])
  );

  return entries.map((entry: any) => {
    const executorUser = users.get(entry.user_id) ?? { id: entry.user_id || 'unknown', username: 'Unknown' };
    const targetUser = users.get(entry.target_id);
    return {
      id: String(entry.id),
      executor: {
        id: String(executorUser.id || 'unknown'),
        name: executorUser.global_name || executorUser.username || 'Unknown',
        avatarUrl: executorUser.avatar
          ? `https://cdn.discordapp.com/avatars/${executorUser.id}/${executorUser.avatar}.png?size=64`
          : undefined,
      },
      action: ACTION_NAMES[entry.action_type] || `ACTION_${entry.action_type ?? 'UNKNOWN'}`,
      target: {
        id: String(entry.target_id || 'unknown'),
        name: targetUser?.global_name || targetUser?.username || String(entry.target_id || 'Unknown'),
        type: 'user',
      },
      reason: entry.reason ?? null,
      timestamp: snowflakeDate(String(entry.id)),
      changes: (entry.changes || []).map((change: any) => ({
        key: change.key,
        from: change.old_value,
        to: change.new_value,
      })),
      source: 'DISCORD' as const,
    };
  });
}

const allLogs = ref<AuditLogEntry[]>([]);
const loading = ref(false);
const loadError = ref('');

const route = useRoute();
const searchQuery = ref('');
const selectedAction = ref('');
const selectedSource = ref('');
const startDate = ref('');
const endDate = ref('');

const itemsPerPage = ref(5);
const currentPage = ref(1);

const filteredLogs = computed(() => {
  let logs = allLogs.value;

  if (startDate.value) {
    const start = startOfDay(new Date(startDate.value)).getTime();
    logs = logs.filter(log => log.timestamp.getTime() >= start);
  }
  if (endDate.value) {
    const end = endOfDay(new Date(endDate.value)).getTime();
    logs = logs.filter(log => log.timestamp.getTime() <= end);
  }
  
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

const openUserHistoryModal = async (user: AuditLogUser) => {
  selectedUser.value = user;
  userModHistory.value = allLogs.value.filter(
    (log) => log.executor.id === user.id || log.target.id === user.id
  );
  isHistoryModalOpen.value = true;

  const guildId = String(route.params.guildId || '');
  if (!guildId) return;
  try {
    const { data } = await auditEndpoints.logsByUser(guildId, user.id, { limit: 50 });
    const mapped = mapAuditPayload(data);
    if (mapped.length) userModHistory.value = mapped;
  } catch {
    // Keep the locally filtered history if Discord's user filter is unavailable.
  }
};

const isDetailModalOpen = ref(false);
const selectedLog = ref<AuditLogEntry | null>(null);

const openDetailModal = (log: AuditLogEntry) => {
  selectedLog.value = log;
  isDetailModalOpen.value = true;
};

onMounted(async () => {
  if (route.query.userId && typeof route.query.userId === 'string') {
    searchQuery.value = route.query.userId;
  }

  const guildId = String(route.params.guildId || '');
  if (!guildId) {
    loadError.value = 'Missing server id.';
    return;
  }

  loading.value = true;
  try {
    const { data } = await auditEndpoints.getLogs(guildId, { limit: 100 });
    allLogs.value = mapAuditPayload(data);
  } catch (error: any) {
    loadError.value = error.response?.data?.error || 'Could not load audit logs.';
  } finally {
    loading.value = false;
  }
});
</script>
