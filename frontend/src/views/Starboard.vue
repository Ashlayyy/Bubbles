
<template>
  <div class="p-8">
    <h1 class="text-3xl font-bold text-foreground mb-6">Starboard</h1>

    <!-- Tabs -->
    <div class="mb-6 border-b border-border">
      <nav class="-mb-px flex space-x-6">
        <button
          @click="activeTab = 'overview'"
          :class="[
            'py-3 px-1 border-b-2 font-medium text-sm transition-colors',
            activeTab === 'overview'
              ? 'border-primary text-primary'
              : 'border-transparent text-muted-foreground hover:text-foreground hover:border-muted-foreground'
          ]"
        >
          Overview
        </button>
        <button
          @click="activeTab = 'messages'"
          :class="[
            'py-3 px-1 border-b-2 font-medium text-sm transition-colors',
            activeTab === 'messages'
              ? 'border-primary text-primary'
              : 'border-transparent text-muted-foreground hover:text-foreground hover:border-muted-foreground'
          ]"
        >
          Starred Messages
        </button>
        <button
          @click="activeTab = 'settings'"
          :class="[
            'py-3 px-1 border-b-2 font-medium text-sm transition-colors',
            activeTab === 'settings'
              ? 'border-primary text-primary'
              : 'border-transparent text-muted-foreground hover:text-foreground hover:border-muted-foreground'
          ]"
        >
          Settings
        </button>
      </nav>
    </div>

    <!-- Overview -->
    <div v-if="activeTab === 'overview'" class="grid grid-cols-1 md:grid-cols-3 gap-6">
      <div class="bg-card border border-border rounded-lg p-6">
        <h3 class="text-lg font-semibold text-card-foreground mb-2">Total Stars</h3>
        <p class="text-3xl font-bold text-yellow-600">{{ stats.totalStars }}</p>
      </div>
      <div class="bg-card border border-border rounded-lg p-6">
        <h3 class="text-lg font-semibold text-card-foreground mb-2">Starred Messages</h3>
        <p class="text-3xl font-bold text-blue-600">{{ stats.totalMessages }}</p>
      </div>
      <div class="bg-card border border-border rounded-lg p-6">
        <h3 class="text-lg font-semibold text-card-foreground mb-2">Top Starred</h3>
        <p class="text-3xl font-bold text-green-600">{{ stats.topMessage }}</p>
      </div>
    </div>

    <!-- Starred Messages -->
    <div v-if="activeTab === 'messages'" class="space-y-4">
      <div v-if="starredMessages.length === 0" class="text-center py-12">
        <p class="text-muted-foreground">No starred messages found.</p>
      </div>
      
      <div v-for="message in starredMessages" :key="message.id" class="bg-card border border-border rounded-lg p-4">
        <div class="flex items-start space-x-3">
          <img :src="message.author.avatar" :alt="message.author.username" class="w-10 h-10 rounded-full">
          <div class="flex-1">
            <div class="flex items-center space-x-2 mb-2">
              <span class="font-medium text-card-foreground">{{ message.author.username }}</span>
              <span class="text-sm text-muted-foreground">{{ formatDate(message.timestamp) }}</span>
              <div class="flex items-center text-yellow-500">
                <span class="mr-1">⭐</span>
                <span class="text-sm font-medium">{{ message.starCount }}</span>
              </div>
            </div>
            <div class="text-foreground mb-2">{{ message.content }}</div>
            <div class="text-sm text-muted-foreground">
              #{{ message.channel }} • <a :href="message.jumpUrl" class="text-primary hover:underline">Jump to message</a>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- Settings -->
    <div v-if="activeTab === 'settings'" class="max-w-2xl space-y-6">
      <div class="bg-card border border-border rounded-lg p-6">
        <h2 class="text-lg font-semibold text-card-foreground mb-4">Starboard Settings</h2>
        
        <div class="space-y-4">
          <div class="flex items-center justify-between">
            <div>
              <label class="font-medium text-card-foreground">Enable Starboard</label>
              <p class="text-sm text-muted-foreground">Allow users to star messages</p>
            </div>
            <label class="relative inline-flex items-center cursor-pointer">
              <input type="checkbox" v-model="settings.enabled" class="sr-only peer">
              <div class="w-11 h-6 bg-muted rounded-full peer peer-checked:after:translate-x-full after:content-[''] after:absolute after:top-0.5 after:left-[2px] after:bg-white after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-primary"></div>
            </label>
          </div>

          <div>
            <label class="block text-sm font-medium text-card-foreground mb-2">Starboard Channel</label>
            <input v-model="settings.channelName" type="text" class="w-full bg-background border border-border rounded-lg px-3 py-2 text-foreground" placeholder="#starboard">
          </div>

          <div>
            <label class="block text-sm font-medium text-card-foreground mb-2">Minimum Stars Required</label>
            <input v-model="settings.minStars" type="number" min="1" class="w-full bg-background border border-border rounded-lg px-3 py-2 text-foreground">
          </div>

          <div class="flex items-center justify-between">
            <div>
              <label class="font-medium text-card-foreground">Self Star</label>
              <p class="text-sm text-muted-foreground">Allow users to star their own messages</p>
            </div>
            <label class="relative inline-flex items-center cursor-pointer">
              <input type="checkbox" v-model="settings.allowSelfStar" class="sr-only peer">
              <div class="w-11 h-6 bg-muted rounded-full peer peer-checked:after:translate-x-full after:content-[''] after:absolute after:top-0.5 after:left-[2px] after:bg-white after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-primary"></div>
            </label>
          </div>

          <div class="flex items-center justify-between">
            <div>
              <label class="font-medium text-card-foreground">Remove on Reaction Remove</label>
              <p class="text-sm text-muted-foreground">Remove from starboard when reaction is removed</p>
            </div>
            <label class="relative inline-flex items-center cursor-pointer">
              <input type="checkbox" v-model="settings.removeOnUnstar" class="sr-only peer">
              <div class="w-11 h-6 bg-muted rounded-full peer peer-checked:after:translate-x-full after:content-[''] after:absolute after:top-0.5 after:left-[2px] after:bg-white after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-primary"></div>
            </label>
          </div>
        </div>

        <div class="mt-6 flex justify-end">
          <button @click="saveSettings" class="bg-primary hover:bg-primary/90 text-primary-foreground font-semibold px-4 py-2 rounded-lg transition-colors">
            Save Changes
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { useStarboardStore } from '@/stores/starboard'
import { storeToRefs } from 'pinia'

const starboardStore = useStarboardStore()
const { settings, starredMessages, stats } = storeToRefs(starboardStore)

const activeTab = ref<'overview' | 'messages' | 'settings'>('overview')

const saveSettings = () => {
  console.log('Starboard settings saved')
}

const formatDate = (dateString: string) => {
  return new Date(dateString).toLocaleString()
}
</script>
