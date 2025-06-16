
<template>
  <div class="p-8">
    <h1 class="text-3xl font-bold text-foreground mb-6">Welcome & Leave</h1>

    <!-- Tabs -->
    <div class="mb-6 border-b border-border">
      <nav class="-mb-px flex space-x-6">
        <button
          @click="activeTab = 'welcome'"
          :class="[
            'py-3 px-1 border-b-2 font-medium text-sm transition-colors',
            activeTab === 'welcome'
              ? 'border-primary text-primary'
              : 'border-transparent text-muted-foreground hover:text-foreground hover:border-muted-foreground'
          ]"
        >
          Welcome Messages
        </button>
        <button
          @click="activeTab = 'leave'"
          :class="[
            'py-3 px-1 border-b-2 font-medium text-sm transition-colors',
            activeTab === 'leave'
              ? 'border-primary text-primary'
              : 'border-transparent text-muted-foreground hover:text-foreground hover:border-muted-foreground'
          ]"
        >
          Leave Messages
        </button>
      </nav>
    </div>

    <!-- Welcome Settings -->
    <div v-if="activeTab === 'welcome'" class="max-w-4xl space-y-6">
      <div class="bg-card border border-border rounded-lg p-6">
        <div class="flex items-center justify-between mb-4">
          <h2 class="text-lg font-semibold text-card-foreground">Welcome Messages</h2>
          <label class="relative inline-flex items-center cursor-pointer">
            <input type="checkbox" v-model="welcomeSettings.enabled" class="sr-only peer">
            <div class="w-11 h-6 bg-muted rounded-full peer peer-checked:after:translate-x-full after:content-[''] after:absolute after:top-0.5 after:left-[2px] after:bg-white after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-primary"></div>
          </label>
        </div>

        <div class="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <!-- Settings -->
          <div class="space-y-4">
            <div>
              <label class="block text-sm font-medium text-card-foreground mb-2">Welcome Channel</label>
              <DiscordItemSelector
                :items="mockChannels"
                :selectedIds="welcomeSettings.channelId"
                :multiple="false"
                placeholder="Select a channel..."
                itemType="channel"
                @update:selectedIds="welcomeSettings.channelId = $event"
              />
            </div>

            <MultiMessageInput
              v-model="welcomeSettings.messages"
              label="Welcome Messages"
              placeholder="Welcome [[.USER]] to [[.SERVER.NAME]]!"
              helperText="Variables: [[.USER]], [[.SERVER.NAME]], [[.MEMBER.COUNT]]. Bot will randomly choose one message."
            />

            <div class="flex items-center justify-between">
              <div>
                <label class="font-medium text-card-foreground">Use Embed</label>
                <p class="text-sm text-muted-foreground">Send as rich embed</p>
              </div>
              <label class="relative inline-flex items-center cursor-pointer">
                <input type="checkbox" v-model="welcomeSettings.embedEnabled" class="sr-only peer">
                <div class="w-11 h-6 bg-muted rounded-full peer peer-checked:after:translate-x-full after:content-[''] after:absolute after:top-0.5 after:left-[2px] after:bg-white after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-primary"></div>
              </label>
            </div>

            <div v-if="welcomeSettings.embedEnabled" class="space-y-4 pl-4 border-l-2 border-primary">
              <div>
                <label class="block text-sm font-medium text-card-foreground mb-2">Embed Title</label>
                <input v-model="welcomeSettings.embedTitle" type="text" class="w-full bg-background border border-border rounded-lg px-3 py-2 text-foreground" placeholder="Welcome!">
              </div>
              <div>
                <label class="block text-sm font-medium text-card-foreground mb-2">Embed Description</label>
                <textarea v-model="welcomeSettings.embedDescription" class="w-full bg-background border border-border rounded-lg px-3 py-2 text-foreground" rows="2"></textarea>
              </div>
              <div>
                <label class="block text-sm font-medium text-card-foreground mb-2">Embed Color</label>
                <input v-model="welcomeSettings.embedColor" type="color" class="w-full h-10 bg-background border border-border rounded-lg">
              </div>
            </div>

            <div class="flex items-center justify-between">
              <div>
                <label class="font-medium text-card-foreground">Ping User</label>
                <p class="text-sm text-muted-foreground">Mention the user in the welcome message</p>
              </div>
              <label class="relative inline-flex items-center cursor-pointer">
                <input type="checkbox" v-model="welcomeSettings.pingUser" class="sr-only peer">
                <div class="w-11 h-6 bg-muted rounded-full peer peer-checked:after:translate-x-full after:content-[''] after:absolute after:top-0.5 after:left-[2px] after:bg-white after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-primary"></div>
              </label>
            </div>

            <div class="flex items-center justify-between">
              <div>
                <label class="font-medium text-card-foreground">DM User</label>
                <p class="text-sm text-muted-foreground">Send a private message to the user</p>
              </div>
              <label class="relative inline-flex items-center cursor-pointer">
                <input type="checkbox" v-model="welcomeSettings.dmUser" class="sr-only peer">
                <div class="w-11 h-6 bg-muted rounded-full peer peer-checked:after:translate-x-full after:content-[''] after:absolute after:top-0.5 after:left-[2px] after:bg-white after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-primary"></div>
              </label>
            </div>

            <div v-if="welcomeSettings.dmUser">
              <label class="block text-sm font-medium text-card-foreground mb-2">DM Message</label>
              <textarea v-model="welcomeSettings.dmMessage" class="w-full bg-background border border-border rounded-lg px-3 py-2 text-foreground" rows="2" placeholder="Welcome to [[.SERVER.NAME]]!"></textarea>
            </div>
          </div>

          <!-- Preview -->
          <div class="space-y-4">
            <h3 class="text-lg font-semibold text-card-foreground">Preview</h3>
            <div class="bg-background border border-border rounded-lg p-4">
              <div v-if="welcomeSettings.embedEnabled" class="border-l-4 pl-4" :style="{ borderColor: welcomeSettings.embedColor }">
                <h4 class="font-semibold text-card-foreground mb-2">{{ welcomeSettings.embedTitle || 'Welcome!' }}</h4>
                <p class="text-card-foreground">{{ welcomeSettings.embedDescription || welcomeSettings.messages[0] || 'Welcome to the server!' }}</p>
                <div class="text-xs text-muted-foreground mt-2">{{ welcomeSettings.embedFooter || 'Member #1,234' }}</div>
              </div>
              <div v-else>
                <p class="text-card-foreground">{{ welcomeSettings.messages[0] || 'Welcome to the server!' }}</p>
              </div>
            </div>
            <div v-if="welcomeSettings.messages.length > 1" class="text-xs text-muted-foreground">
              Showing preview of first message ({{ welcomeSettings.messages.length }} total messages)
            </div>
          </div>
        </div>

        <div class="mt-6 flex justify-end">
          <button @click="saveWelcomeSettings" class="bg-primary hover:bg-primary/90 text-primary-foreground font-semibold px-4 py-2 rounded-lg transition-colors">
            Save Changes
          </button>
        </div>
      </div>
    </div>

    <!-- Leave Settings -->
    <div v-if="activeTab === 'leave'" class="max-w-4xl space-y-6">
      <div class="bg-card border border-border rounded-lg p-6">
        <div class="flex items-center justify-between mb-4">
          <h2 class="text-lg font-semibold text-card-foreground">Leave Messages</h2>
          <label class="relative inline-flex items-center cursor-pointer">
            <input type="checkbox" v-model="leaveSettings.enabled" class="sr-only peer">
            <div class="w-11 h-6 bg-muted rounded-full peer peer-checked:after:translate-x-full after:content-[''] after:absolute after:top-0.5 after:left-[2px] after:bg-white after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-primary"></div>
          </label>
        </div>

        <div class="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <!-- Settings -->
          <div class="space-y-4">
            <div>
              <label class="block text-sm font-medium text-card-foreground mb-2">Leave Channel</label>
              <DiscordItemSelector
                :items="mockChannels"
                :selectedIds="leaveSettings.channelId"
                :multiple="false"
                placeholder="Select a channel..."
                itemType="channel"
                @update:selectedIds="leaveSettings.channelId = $event"
              />
            </div>

            <MultiMessageInput
              v-model="leaveSettings.messages"
              label="Leave Messages"
              placeholder="[[.USER]] has left the server."
              helperText="Variables: [[.USER]], [[.SERVER.NAME]], [[.MEMBER.COUNT]]. Bot will randomly choose one message."
            />

            <div class="flex items-center justify-between">
              <div>
                <label class="font-medium text-card-foreground">Use Embed</label>
                <p class="text-sm text-muted-foreground">Send as rich embed</p>
              </div>
              <label class="relative inline-flex items-center cursor-pointer">
                <input type="checkbox" v-model="leaveSettings.embedEnabled" class="sr-only peer">
                <div class="w-11 h-6 bg-muted rounded-full peer peer-checked:after:translate-x-full after:content-[''] after:absolute after:top-0.5 after:left-[2px] after:bg-white after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-primary"></div>
              </label>
            </div>

            <div v-if="leaveSettings.embedEnabled" class="space-y-4 pl-4 border-l-2 border-primary">
              <div>
                <label class="block text-sm font-medium text-card-foreground mb-2">Embed Title</label>
                <input v-model="leaveSettings.embedTitle" type="text" class="w-full bg-background border border-border rounded-lg px-3 py-2 text-foreground" placeholder="Goodbye!">
              </div>
              <div>
                <label class="block text-sm font-medium text-card-foreground mb-2">Embed Description</label>
                <textarea v-model="leaveSettings.embedDescription" class="w-full bg-background border border-border rounded-lg px-3 py-2 text-foreground" rows="2"></textarea>
              </div>
              <div>
                <label class="block text-sm font-medium text-card-foreground mb-2">Embed Color</label>
                <input v-model="leaveSettings.embedColor" type="color" class="w-full h-10 bg-background border border-border rounded-lg">
              </div>
            </div>
          </div>

          <!-- Preview -->
          <div class="space-y-4">
            <h3 class="text-lg font-semibold text-card-foreground">Preview</h3>
            <div class="bg-background border border-border rounded-lg p-4">
              <div v-if="leaveSettings.embedEnabled" class="border-l-4 pl-4" :style="{ borderColor: leaveSettings.embedColor }">
                <h4 class="font-semibold text-card-foreground mb-2">{{ leaveSettings.embedTitle || 'Goodbye!' }}</h4>
                <p class="text-card-foreground">{{ leaveSettings.embedDescription || leaveSettings.messages[0] || 'User has left the server.' }}</p>
                <div class="text-xs text-muted-foreground mt-2">{{ leaveSettings.embedFooter || 'We now have 1,233 members' }}</div>
              </div>
              <div v-else>
                <p class="text-card-foreground">{{ leaveSettings.messages[0] || 'User has left the server.' }}</p>
              </div>
            </div>
            <div v-if="leaveSettings.messages.length > 1" class="text-xs text-muted-foreground">
              Showing preview of first message ({{ leaveSettings.messages.length }} total messages)
            </div>
          </div>
        </div>

        <div class="mt-6 flex justify-end">
          <button @click="saveLeaveSettings" class="bg-primary hover:bg-primary/90 text-primary-foreground font-semibold px-4 py-2 rounded-lg transition-colors">
            Save Changes
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { useWelcomeStore } from '@/stores/welcome'
import { storeToRefs } from 'pinia'
import DiscordItemSelector from '@/components/common/DiscordItemSelector.vue'
import MultiMessageInput from '@/components/common/MultiMessageInput.vue'

const welcomeStore = useWelcomeStore()
const { welcomeSettings, leaveSettings } = storeToRefs(welcomeStore)

const activeTab = ref<'welcome' | 'leave'>('welcome')

// Mock channels for the selector
const mockChannels = [
  { id: '123456789', name: 'welcome' },
  { id: '987654321', name: 'general' },
  { id: '456789123', name: 'announcements' },
  { id: '789123456', name: 'goodbye' }
]

const saveWelcomeSettings = () => {
  console.log('Welcome settings saved')
}

const saveLeaveSettings = () => {
  console.log('Leave settings saved')
}
</script>
