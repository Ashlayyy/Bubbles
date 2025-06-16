
<template>
  <div class="p-8">
    <h1 class="text-3xl font-bold text-foreground mb-6">Appeals</h1>

    <!-- Tabs -->
    <div class="mb-6 border-b border-border">
      <nav class="-mb-px flex space-x-6">
        <button
          @click="activeTab = 'setup'"
          :class="[
            'py-3 px-1 border-b-2 font-medium text-sm transition-colors',
            activeTab === 'setup'
              ? 'border-primary text-primary'
              : 'border-transparent text-muted-foreground hover:text-foreground hover:border-muted-foreground'
          ]"
        >
          Setup
        </button>
        <button
          @click="activeTab = 'preview'"
          :class="[
            'py-3 px-1 border-b-2 font-medium text-sm transition-colors',
            activeTab === 'preview'
              ? 'border-primary text-primary'
              : 'border-transparent text-muted-foreground hover:text-foreground hover:border-muted-foreground'
          ]"
        >
          Preview
        </button>
      </nav>
    </div>

    <div class="max-w-4xl space-y-8">
      <AppealsSetup v-if="activeTab === 'setup'" />
      <AppealsPreview v-if="activeTab === 'preview'" />
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue';
import AppealsSetup from '@/components/appeals/AppealsSetup.vue';
import AppealsPreview from '@/components/appeals/AppealsPreview.vue';

const activeTab = ref('setup');
</script>
