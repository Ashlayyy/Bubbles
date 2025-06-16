
<template>
  <div class="space-y-8">
    <!-- Stat Cards -->
    <div class="grid grid-cols-1 md:grid-cols-3 gap-6">
      <div class="bg-card border border-border rounded-xl p-6 flex items-center justify-between">
        <div>
          <p class="text-sm text-muted-foreground">Total Cases</p>
          <p class="text-3xl font-bold text-card-foreground">{{ stats.totalCases }}</p>
        </div>
        <div class="w-12 h-12 bg-blue-500/20 rounded-lg flex items-center justify-center text-blue-400 text-2xl">
          <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-shield-check"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10"/><path d="m9 12 2 2 4-4"/></svg>
        </div>
      </div>
      <div class="bg-card border border-border rounded-xl p-6 flex items-center justify-between">
        <div>
          <p class="text-sm text-muted-foreground">Currently Muted</p>
          <p class="text-3xl font-bold text-card-foreground">{{ stats.mutedUsers }}</p>
        </div>
        <div class="w-12 h-12 bg-yellow-500/20 rounded-lg flex items-center justify-center text-yellow-400 text-2xl">
          <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-mic-off"><path d="M12 8V5a3 3 0 0 0-6 0v3"/><path d="M8.8 8.8A4.95 4.95 0 0 0 8 10v3a4 4 0 0 0 8 0v-1.2"/><line x1="1" y1="1" x2="23" y2="23"/><path d="M16 10a4 4 0 0 0-4-4V4a4 4 0 0 0-4 4"/></svg>
        </div>
      </div>
      <div class="bg-card border border-border rounded-xl p-6 flex items-center justify-between">
        <div>
          <p class="text-sm text-muted-foreground">Currently Banned</p>
          <p class="text-3xl font-bold text-card-foreground">{{ stats.bannedUsers }}</p>
        </div>
        <div class="w-12 h-12 bg-red-500/20 rounded-lg flex items-center justify-center text-red-400 text-2xl">
          <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-gavel"><path d="M14 12l-4-4"/><path d="M10 8l4 4"/><path d="M16 5H8a2 2 0 0 0-2 2v10a2 2 0 0 0 2 2h8a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2Z"/><path d="M12 5V3"/><path d="M6 5H4"/><path d="M20 5h-2"/></svg>
        </div>
      </div>
    </div>
    
    <!-- Mod Actions Chart -->
    <div class="bg-card border border-border rounded-xl p-6">
      <h2 class="text-xl font-semibold text-card-foreground mb-4">Moderation Actions (Last 7 Days)</h2>
      <div class="h-80">
        <ModActionChart :chart-data="modActionsChartData" :chart-options="modActionsChartOptions" />
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import ModActionChart from './charts/ModActionChart.vue';
import type { ChartData, ChartOptions } from 'chart.js';
import { computed } from 'vue';
import { useUIStore } from '@/stores/ui';

interface ModerationStats {
  totalCases: number;
  mutedUsers: number;
  bannedUsers: number;
}

defineProps<{
  stats: ModerationStats;
  modActionsChartData: ChartData<'bar'>;
}>();

const uiStore = useUIStore();

const modActionsChartOptions = computed((): ChartOptions<'bar'> => {
  const isDark = uiStore.theme === 'dark';
  return {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        display: false,
      },
      tooltip: {
        backgroundColor: isDark ? '#1e293b' : '#ffffff',
        titleColor: isDark ? '#cbd5e1' : '#1e293b',
        bodyColor: isDark ? '#cbd5e1' : '#1e293b',
        borderColor: isDark ? '#334155' : '#e2e8f0',
        borderWidth: 1,
      }
    },
    scales: {
      y: {
        beginAtZero: true,
        grid: {
          color: isDark ? '#334155' : '#e2e8f0'
        },
        ticks: {
          color: isDark ? '#94a3b8' : '#64748b'
        }
      },
      x: {
        grid: {
          display: false
        },
        ticks: {
          color: isDark ? '#94a3b8' : '#64748b'
        }
      }
    }
  }
});
</script>
