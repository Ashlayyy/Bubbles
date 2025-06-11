<template>
  <div class="space-y-8">
    <div class="text-center">
      <h2 class="text-3xl font-bold text-white mb-4">Discord Bot Message Queue Demo</h2>
      <p class="text-gray-300">Send messages to Discord channels through the API queue system</p>
    </div>
    
    <div class="max-w-md mx-auto bg-gray-800 rounded-lg shadow-lg p-6">
      <form @submit.prevent="sendMessage" class="space-y-4">
        <div>
          <label class="block text-sm font-medium text-gray-300 mb-2">
            Channel ID
          </label>
          <input
            v-model="form.channelId"
            type="text"
            placeholder="Enter Discord channel ID"
            class="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-md text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-discord-500 focus:border-transparent"
            required
          />
        </div>
        
        <div>
          <label class="block text-sm font-medium text-gray-300 mb-2">
            Message Content
          </label>
          <textarea
            v-model="form.content"
            placeholder="Enter your message"
            rows="3"
            class="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-md text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-discord-500 focus:border-transparent resize-none"
            maxlength="2000"
            required
          ></textarea>
          <p class="text-xs text-gray-400 mt-1">{{ form.content.length }}/2000 characters</p>
        </div>
        
        <button
          type="submit"
          :disabled="isLoading"
          class="w-full bg-discord-600 hover:bg-discord-700 disabled:bg-gray-600 text-white font-medium py-2 px-4 rounded-md transition duration-200 focus:outline-none focus:ring-2 focus:ring-discord-500 focus:ring-offset-2 focus:ring-offset-gray-800"
        >
          {{ isLoading ? 'Sending...' : 'Send Message' }}
        </button>
      </form>
      
      <div v-if="message" class="mt-4 p-3 rounded-md" :class="messageClass">
        {{ message }}
      </div>
    </div>
    
    <div class="max-w-md mx-auto bg-gray-800 rounded-lg shadow-lg p-6">
      <h3 class="text-lg font-medium text-white mb-4">System Status</h3>
      <div class="space-y-2">
        <div class="flex justify-between">
          <span class="text-gray-300">API Status:</span>
          <span class="text-green-400">● Online</span>
        </div>
        <div class="flex justify-between">
          <span class="text-gray-300">Queue Status:</span>
          <span class="text-yellow-400">● Testing</span>
        </div>
        <div class="flex justify-between">
          <span class="text-gray-300">Bot Status:</span>
          <span class="text-yellow-400">● Integration Pending</span>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'

const form = ref({
  channelId: '',
  content: ''
})

const isLoading = ref(false)
const message = ref('')
const isError = ref(false)

const messageClass = computed(() => ({
  'bg-green-600': !isError.value,
  'bg-red-600': isError.value
}))

const sendMessage = async () => {
  isLoading.value = true
  message.value = ''
  
  try {
    // TODO: Replace with actual API call when backend is ready
    await new Promise(resolve => setTimeout(resolve, 1000)) // Simulate API call
    
    message.value = `Message queued successfully! (Channel: ${form.value.channelId})`
    isError.value = false
    
    // Reset form
    form.value.channelId = ''
    form.value.content = ''
    
  } catch (error) {
    message.value = 'Failed to send message. Please try again.'
    isError.value = true
  } finally {
    isLoading.value = false
  }
}
</script> 