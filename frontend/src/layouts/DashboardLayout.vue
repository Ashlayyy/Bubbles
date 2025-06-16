
<template>
  <div class="min-h-screen flex">
    <Sidebar />
    <div class="ml-64 flex-1">
      <router-view />
    </div>
  </div>
</template>

<script setup lang="ts">
import Sidebar from '@/components/Sidebar.vue'
</script>
