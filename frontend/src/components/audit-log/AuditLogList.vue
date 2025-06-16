
<template>
  <div class="bg-slate-900 border border-slate-800 rounded-xl divide-y divide-slate-800">
    <div v-if="logs.length > 0">
      <AuditLogItem v-for="log in logs" :key="log.id" :log="log" @viewUserHistory="$emit('viewUserHistory', $event)" @viewDetails="$emit('viewDetails', $event)" />
    </div>
    <div v-else class="p-8 text-center text-slate-500">
      <p>No audit logs found for the selected criteria.</p>
    </div>
  </div>
</template>

<script setup lang="ts">
import type { AuditLogEntry } from '@/types/audit-log';
import AuditLogItem from './AuditLogItem.vue';

defineProps<{
  logs: AuditLogEntry[];
}>();

defineEmits(['viewUserHistory', 'viewDetails']);
</script>
