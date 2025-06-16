<template>
  <div v-if="isOpen && actionInfo" class="fixed inset-0 bg-black bg-opacity-70 z-50 flex justify-center items-center p-4" @click.self="closeModal">
    <div class="bg-slate-900 rounded-xl shadow-lg w-full max-w-md border border-slate-800">
      <div class="p-6 border-b border-slate-800 flex justify-between items-center">
        <h2 class="text-xl font-semibold text-white">{{ title }}</h2>
        <button @click="closeModal" class="text-slate-400 hover:text-white">
          <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
        </button>
      </div>

      <form @submit.prevent="submitForm">
        <div class="p-6 space-y-4">
          <div v-if="actionInfo.predefinedReasons && actionInfo.predefinedReasons.length > 0">
            <label for="predefined-reason" class="block text-sm font-medium text-slate-400 mb-1">Select a common reason</label>
            <select id="predefined-reason" @change="handleReasonSelect" class="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-white text-sm focus:ring-blue-500 focus:border-blue-500 mb-2">
              <option value="">-- Custom Reason --</option>
              <option v-for="predefinedReason in actionInfo.predefinedReasons" :key="predefinedReason" :value="predefinedReason">
                {{ predefinedReason }}
              </option>
            </select>
          </div>
          
          <div>
            <label for="reason" class="block text-sm font-medium text-slate-400 mb-1">Reason</label>
            <textarea id="reason" v-model="reason" rows="3" class="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-white text-sm focus:ring-blue-500 focus:border-blue-500" placeholder="Enter reason for this action..."></textarea>
          </div>

          <div v-if="actionInfo.action === 'mute' || actionInfo.action === 'ban'" class="grid grid-cols-2 gap-4">
            <div>
              <label for="duration" class="block text-sm font-medium text-slate-400 mb-1">Duration</label>
              <input id="duration" v-model.number="duration" type="number" min="0" class="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-white text-sm focus:ring-blue-500 focus:border-blue-500" placeholder="e.g., 7">
              <p v-if="actionInfo.action === 'ban'" class="text-xs text-slate-500 mt-1">Set to 0 for a permanent ban.</p>
            </div>
            <div>
              <label for="unit" class="block text-sm font-medium text-slate-400 mb-1">Unit</label>
              <select id="unit" v-model="durationUnit" class="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-white text-sm focus:ring-blue-500 focus:border-blue-500" :disabled="duration === 0 && actionInfo.action === 'ban'">
                <option>minutes</option>
                <option>hours</option>
                <option>days</option>
              </select>
            </div>
          </div>
        </div>

        <div class="p-4 bg-slate-800/50 flex justify-end items-center gap-4 border-t border-slate-800">
          <button type="button" @click="closeModal" class="bg-slate-700 hover:bg-slate-600 text-white font-semibold px-4 py-2 rounded-lg transition-colors">Cancel</button>
          <button type="submit" class="bg-blue-600 hover:bg-blue-500 text-white font-semibold px-4 py-2 rounded-lg transition-colors">{{ actionText }}</button>
        </div>
      </form>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch } from 'vue';
import type { AuditLogUser } from '@/types/audit-log';

type Action = 'warn' | 'mute' | 'kick' | 'ban';

interface ActionInfo {
  action: Action;
  user: AuditLogUser;
  predefinedReasons?: string[];
}

const props = defineProps<{
  isOpen: boolean;
  actionInfo: ActionInfo | null;
}>();

const emit = defineEmits<{
  (e: 'close'): void;
  (e: 'submit', payload: { reason: string; duration: number; durationUnit: 'minutes' | 'hours' | 'days' }): void;
}>();

const reason = ref('');
const duration = ref(0);
const durationUnit = ref<'minutes' | 'hours' | 'days'>('days');

const title = computed(() => {
  if (!props.actionInfo) return '';
  const action = props.actionInfo.action.charAt(0).toUpperCase() + props.actionInfo.action.slice(1);
  return `${action} User: @${props.actionInfo.user.name}`;
});

const actionText = computed(() => {
  if (!props.actionInfo) return '';
  return props.actionInfo.action.charAt(0).toUpperCase() + props.actionInfo.action.slice(1);
});

const handleReasonSelect = (e: Event) => {
  const target = e.target as HTMLSelectElement;
  reason.value = target.value;
};

const closeModal = () => {
  emit('close');
};

const submitForm = () => {
  emit('submit', {
    reason: reason.value,
    duration: duration.value,
    durationUnit: durationUnit.value
  });
  closeModal();
};

watch(() => props.isOpen, (newVal) => {
  if (newVal) {
    reason.value = '';
    duration.value = 0;
    if (props.actionInfo?.action === 'mute') {
      duration.value = 30; // Default mute duration
      durationUnit.value = 'minutes';
    } else {
      durationUnit.value = 'days';
    }
  }
});

watch(duration, (newVal) => {
  if (props.actionInfo?.action === 'ban' && newVal === 0) {
    // No need to change unit, it's just disabled.
  }
});
</script>
