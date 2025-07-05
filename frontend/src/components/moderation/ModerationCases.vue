<template>
  <div class="bg-slate-900 border border-slate-800 rounded-xl">
    <div class="p-6 border-b border-slate-800">
      <h2 class="text-xl font-semibold text-white">Moderation Cases</h2>
      <p class="text-slate-400 mt-1">Review all moderation actions taken in your server.</p>
    </div>
    <div class="p-6">
      <!-- Filters -->
      <div class="flex flex-wrap items-end gap-4 mb-6">
        <div>
          <label for="action-filter" class="block text-sm font-medium text-slate-400 mb-1">Filter by Action</label>
          <select id="action-filter" v-model="selectedAction" class="bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-white text-sm focus:ring-blue-500 focus:border-blue-500 w-48">
            <option v-for="action in availableActions" :key="action" :value="action">{{ formatActionForDisplay(action) }}</option>
          </select>
        </div>
        <div>
          <label for="search-filter" class="block text-sm font-medium text-slate-400 mb-1">Search by Target</label>
          <input id="search-filter" v-model.lazy.trim="searchQuery" type="text" placeholder="e.g. Troublemaker" class="bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-white text-sm focus:ring-blue-500 focus:border-blue-500 w-64">
        </div>
      </div>

      <div class="overflow-x-auto">
        <table class="w-full text-sm text-left text-slate-400">
          <thead class="text-xs text-slate-400 uppercase bg-slate-800/50">
            <tr>
              <th scope="col" class="px-6 py-3">Case</th>
              <th scope="col" class="px-6 py-3">Moderator</th>
              <th scope="col" class="px-6 py-3">Reason</th>
              <th scope="col" class="px-6 py-3">Date</th>
            </tr>
          </thead>
          <tbody>
            <tr v-if="filteredCases.length === 0">
              <td colspan="4" class="text-center py-10 text-slate-500">No moderation cases found with the current filters.</td>
            </tr>
            <tr
              v-else
              v-for="caseEntry in paginatedCases"
              :key="caseEntry.id"
              class="border-b border-slate-800 hover:bg-slate-800/50 cursor-pointer transition-colors"
              @click="$emit('case-selected', caseEntry)"
            >
              <td class="px-6 py-4 font-medium text-white">
                <div class="flex items-center gap-3">
                  <span :class="getActionDetails(caseEntry.action).color">{{ getActionDetails(caseEntry.action).icon }}</span>
                  <div>
                    <button
                      v-if="caseEntry.target.type === 'user'"
                      @click.stop="$emit('user-selected', caseEntry.target)"
                      class="font-semibold hover:underline focus:outline-none focus:ring-2 focus:ring-blue-500 rounded"
                    >
                      {{ formatTarget(caseEntry) }}
                    </button>
                    <span v-else class="font-semibold">{{ formatTarget(caseEntry) }}</span>
                    <span class="text-slate-400"> was {{ getActionDetails(caseEntry.action).text }}</span>
                  </div>
                </div>
              </td>
              <td class="px-6 py-4">
                {{ caseEntry.executor.name }}
              </td>
              <td class="px-6 py-4 max-w-xs truncate" :title="caseEntry.reason || ''">
                {{ caseEntry.reason || 'No reason provided' }}
              </td>
              <td class="px-6 py-4">
                {{ formatTimestamp(caseEntry.timestamp) }}
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      <!-- Pagination -->
      <div v-if="totalPages > 1" class="flex items-center justify-between pt-6 text-sm">
        <span class="text-slate-400">
          Page {{ currentPage }} of {{ totalPages }}
        </span>
        <div class="flex items-center gap-2">
          <button @click="prevPage" :disabled="currentPage === 1" class="px-3 py-1 font-medium text-white bg-slate-800 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed hover:bg-slate-700 transition-colors">Previous</button>
          <button @click="nextPage" :disabled="currentPage === totalPages" class="px-3 py-1 font-medium text-white bg-slate-800 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed hover:bg-slate-700 transition-colors">Next</button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch } from 'vue';
import type { AuditLogEntry, AuditLogUser } from '@/types/audit-log';
import { formatDistanceToNow } from 'date-fns';
import { getActionDetails, formatTarget } from '@/lib/auditLogUtils';

const props = defineProps<{
  cases: AuditLogEntry[];
}>();

defineEmits<{
  (e: 'case-selected', value: AuditLogEntry): void;
  (e: 'user-selected', user: AuditLogUser): void;
}>();

const formatTimestamp = (timestamp: Date) => {
  return formatDistanceToNow(timestamp, { addSuffix: true });
};

// Filtering logic
const selectedAction = ref('All');
const searchQuery = ref('');

const availableActions = computed(() => {
  const allActions = new Set(props.cases.map(c => c.action));
  return ['All', ...Array.from(allActions).sort()];
});

const filteredCases = computed(() => {
  return props.cases.filter(caseEntry => {
    const actionMatch = selectedAction.value === 'All' || caseEntry.action === selectedAction.value;
    const searchMatch = !searchQuery.value || caseEntry.target.name.toLowerCase().includes(searchQuery.value.toLowerCase());
    return actionMatch && searchMatch;
  });
});

const formatActionForDisplay = (action: string) => {
  if (action === 'All') return 'All Actions';
  return action.replace(/_/g, ' ').replace('USER', '').trim().split(' ').map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()).join(' ');
};

// Pagination logic
const currentPage = ref(1);
const itemsPerPage = 10;

const totalPages = computed(() => {
  return Math.ceil(filteredCases.value.length / itemsPerPage);
});

const paginatedCases = computed(() => {
  const start = (currentPage.value - 1) * itemsPerPage;
  const end = start + itemsPerPage;
  return filteredCases.value.slice(start, end);
});

const nextPage = () => {
  if (currentPage.value < totalPages.value) {
    currentPage.value++;
  }
};

const prevPage = () => {
  if (currentPage.value > 1) {
    currentPage.value--;
  }
};

watch(filteredCases, () => {
  currentPage.value = 1;
});
</script>
