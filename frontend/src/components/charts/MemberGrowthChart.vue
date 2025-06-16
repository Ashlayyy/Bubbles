
<template>
  <Line :data="chartData" :options="chartOptions" />
</template>

<script setup lang="ts">
import { Line } from 'vue-chartjs'
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  Filler
} from 'chart.js'
import { computed } from 'vue';

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  Filler
)

const chartData = computed(() => ({
  labels: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul'],
  datasets: [
    {
      label: 'New Members',
      backgroundColor: (context: any) => {
          const ctx = context.chart.ctx;
          if (!ctx) return 'rgba(59, 130, 246, 0.5)';
          const gradient = ctx.createLinearGradient(0, 0, 0, 250);
          gradient.addColorStop(0, 'rgba(59, 130, 246, 0.4)');
          gradient.addColorStop(1, 'rgba(59, 130, 246, 0)');
          return gradient;
        },
      borderColor: '#3B82F6',
      data: [65, 59, 80, 81, 56, 55, 90],
      tension: 0.4,
      fill: true,
      pointBackgroundColor: '#3B82F6',
      pointBorderColor: '#fff',
      pointHoverBackgroundColor: '#fff',
      pointHoverBorderColor: '#3B82F6'
    },
  ],
}))

const chartOptions = {
  responsive: true,
  maintainAspectRatio: false,
  plugins: {
    legend: {
      display: false,
    },
  },
  scales: {
    x: {
      grid: {
        display: false,
      },
      ticks: {
        color: '#94A3B8' // slate-400
      }
    },
    y: {
      grid: {
        color: '#334155' // slate-700
      },
      ticks: {
        color: '#94A3B8' // slate-400
      },
      beginAtZero: true
    },
  },
}
</script>
