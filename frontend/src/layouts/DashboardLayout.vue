<template>
  <div class="min-h-screen flex bg-background">
    <Sidebar />
    <div class="ml-64 flex-1 flex flex-col">
      <Header />
      <div class="p-8">
        <Breadcrumbs />
        <router-view />
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import Sidebar from '@/components/Sidebar.vue'
import Header from '@/components/Header.vue'
import Breadcrumbs from '@/components/Breadcrumbs.vue'
</script>