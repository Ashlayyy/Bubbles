<template>
  <div id="app" class="min-h-screen bg-gray-900 text-white">
    <nav class="bg-discord-600 shadow-lg">
      <div class="max-w-7xl mx-auto px-4">
        <div class="flex justify-between h-16">
          <div class="flex items-center">
            <h1 class="text-xl font-bold">Discord Bot Dashboard</h1>
          </div>
          <div class="flex items-center space-x-4">
            <span class="text-sm">Phase 1 - Message Queue Demo</span>
          </div>
        </div>
      </div>
    </nav>
    
    <main class="max-w-7xl mx-auto py-6 px-4">
      <router-view />
    </main>
  </div>
</template>

<script setup lang="ts">
// Main app component
</script> 