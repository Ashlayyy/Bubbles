
<template>
  <div class="flex items-start space-x-4 p-4 transition-colors hover:bg-slate-800/50 rounded-lg cursor-pointer" @click="$emit('viewDetails', log)">
    <div class="w-10 h-10 bg-slate-800 rounded-full flex items-center justify-center shrink-0">
      <img v-if="log.executor.avatarUrl" :src="log.executor.avatarUrl" alt="" class="w-full h-full rounded-full" />
      <span v-else class="text-lg font-bold">{{ log.executor.name.charAt(0) }}</span>
    </div>
    <div class="flex-grow">
      <p class="text-sm text-slate-300">
        <button @click.stop="$emit('viewUserHistory', log.executor)" class="font-semibold text-white hover:underline">{{ log.executor.name }}</button>
        <span :class="actionDetails.color" class="ml-1">{{ actionDetails.text }}</span>
        <strong class="font-semibold text-white ml-1">{{ formattedTarget }}</strong>
        <span v-if="log.source === 'BUBBLES'" class="ml-2 text-xs text-blue-400 bg-blue-900/50 px-1.5 py-0.5 rounded-md font-mono">
          Bubbles
        </span>
      </p>
      <p v-if="log.reason" class="text-sm text-slate-400 mt-1">
        <span class="font-semibold">Reason:</span> {{ log.reason }}
      </p>
    </div>
    <div class="text-xs text-slate-500 shrink-0 text-right">
      <p>{{ formattedTimestamp }}</p>
      <p class="mt-1">ID: {{ log.id }}</p>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import { formatDistanceToNow } from 'date-fns';
import type { AuditLogEntry } from '@/types/audit-log';
import { getActionDetails, formatTarget as formatTargetUtil } from '@/lib/auditLogUtils';

const props = defineProps<{
  log: AuditLogEntry;
}>();

defineEmits(['viewUserHistory', 'viewDetails']);

const actionDetails = computed(() => getActionDetails(props.log.action));
const formattedTarget = computed(() => formatTargetUtil(props.log));

const formattedTimestamp = computed(() => {
  return formatDistanceToNow(props.log.timestamp, { addSuffix: true });
});
</script>
