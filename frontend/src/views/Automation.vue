<template>
  <div>
    <h1 class="text-3xl font-bold text-foreground mb-6">Advanced Automation</h1>

    <!-- Tabs -->
    <div class="mb-6 border-b border-border">
      <nav class="-mb-px flex space-x-6">
        <button
          @click="activeTab = 'discord-automod'"
          :class="[
            'py-3 px-1 border-b-2 font-medium text-sm transition-colors',
            activeTab === 'discord-automod'
              ? 'border-primary text-primary'
              : 'border-transparent text-muted-foreground hover:text-foreground hover:border-muted-foreground'
          ]"
        >
          Discord AutoMod
        </button>
        <button
          @click="activeTab = 'custom-rules'"
          :class="[
            'py-3 px-1 border-b-2 font-medium text-sm transition-colors',
            activeTab === 'custom-rules'
              ? 'border-primary text-primary'
              : 'border-transparent text-muted-foreground hover:text-foreground hover:border-muted-foreground'
          ]"
        >
          Custom Rules
        </button>
        <button
          @click="activeTab = 'scheduled'"
          :class="[
            'py-3 px-1 border-b-2 font-medium text-sm transition-colors',
            activeTab === 'scheduled'
              ? 'border-primary text-primary'
              : 'border-transparent text-muted-foreground hover:text-foreground hover:border-muted-foreground'
          ]"
        >
          Scheduled Events
        </button>
        <button
          @click="activeTab = 'triggers'"
          :class="[
            'py-3 px-1 border-b-2 font-medium text-sm transition-colors',
            activeTab === 'triggers'
              ? 'border-primary text-primary'
              : 'border-transparent text-muted-foreground hover:text-foreground hover:border-muted-foreground'
          ]"
        >
          Trigger Actions
        </button>
        <button
          @click="activeTab = 'templates'"
          :class="[
            'py-3 px-1 border-b-2 font-medium text-sm transition-colors',
            activeTab === 'templates'
              ? 'border-primary text-primary'
              : 'border-transparent text-muted-foreground hover:text-foreground hover:border-muted-foreground'
          ]"
        >
          Message Templates
        </button>
      </nav>
    </div>

    <!-- Discord AutoMod -->
    <div v-if="activeTab === 'discord-automod'" class="space-y-6">
      <div class="bg-card border border-border rounded-lg p-6">
        <div class="flex items-center gap-3 mb-4">
          <div class="w-10 h-10 bg-blue-500/20 rounded-lg flex items-center justify-center">
            <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="text-blue-500">
              <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10"/>
              <path d="m9 12 2 2 4-4"/>
            </svg>
          </div>
          <div>
            <h2 class="text-xl font-semibold text-foreground">Discord AutoMod Integration</h2>
            <p class="text-muted-foreground">Manage Discord's built-in AutoMod rules and create custom extensions</p>
          </div>
        </div>

        <div class="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div class="space-y-4">
            <h3 class="text-lg font-semibold text-foreground">AutoMod Rules</h3>
            <div v-for="rule in discordAutoModRules" :key="rule.id" class="bg-secondary/50 rounded-lg p-4">
              <div class="flex items-start justify-between mb-3">
                <div>
                  <h4 class="font-semibold text-foreground">{{ rule.name }}</h4>
                  <p class="text-sm text-muted-foreground">{{ rule.description }}</p>
                </div>
                <div class="flex items-center gap-2">
                  <span :class="rule.enabled ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300' : 'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-300'" 
                        class="px-2 py-1 rounded-full text-xs font-medium">
                    {{ rule.enabled ? 'Active' : 'Inactive' }}
                  </span>
                  <button @click="toggleAutoModRule(rule.id)" class="text-muted-foreground hover:text-foreground">
                    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                      <path d="M12 2v20M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/>
                    </svg>
                  </button>
                </div>
              </div>
              
              <div class="space-y-2 text-sm">
                <div class="flex justify-between">
                  <span class="text-muted-foreground">Trigger Type:</span>
                  <span class="text-foreground">{{ rule.triggerType }}</span>
                </div>
                <div class="flex justify-between">
                  <span class="text-muted-foreground">Actions:</span>
                  <span class="text-foreground">{{ rule.actions.join(', ') }}</span>
                </div>
                <div class="flex justify-between">
                  <span class="text-muted-foreground">Triggered:</span>
                  <span class="text-foreground">{{ rule.triggerCount }} times</span>
                </div>
              </div>

              <div class="mt-3 flex gap-2">
                <button @click="editAutoModRule(rule)" class="text-primary hover:text-primary/80 text-sm">
                  Configure
                </button>
                <button @click="viewAutoModLogs(rule)" class="text-muted-foreground hover:text-foreground text-sm">
                  View Logs
                </button>
              </div>
            </div>
          </div>

          <div class="space-y-4">
            <h3 class="text-lg font-semibold text-foreground">AutoMod Extensions</h3>
            <p class="text-sm text-muted-foreground">Enhance Discord's AutoMod with custom Bubbles features</p>
            
            <div class="space-y-3">
              <div class="bg-secondary/50 rounded-lg p-4">
                <div class="flex items-center justify-between mb-2">
                  <h4 class="font-semibold text-foreground">Smart Context Analysis</h4>
                  <label class="relative inline-flex items-center cursor-pointer">
                    <input type="checkbox" v-model="autoModExtensions.contextAnalysis" class="sr-only peer">
                    <div class="w-11 h-6 bg-muted rounded-full peer peer-checked:after:translate-x-full after:content-[''] after:absolute after:top-0.5 after:left-[2px] after:bg-white after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-primary"></div>
                  </label>
                </div>
                <p class="text-sm text-muted-foreground">AI-powered context understanding to reduce false positives</p>
              </div>

              <div class="bg-secondary/50 rounded-lg p-4">
                <div class="flex items-center justify-between mb-2">
                  <h4 class="font-semibold text-foreground">Advanced Spam Detection</h4>
                  <label class="relative inline-flex items-center cursor-pointer">
                    <input type="checkbox" v-model="autoModExtensions.advancedSpam" class="sr-only peer">
                    <div class="w-11 h-6 bg-muted rounded-full peer peer-checked:after:translate-x-full after:content-[''] after:absolute after:top-0.5 after:left-[2px] after:bg-white after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-primary"></div>
                  </label>
                </div>
                <p class="text-sm text-muted-foreground">Detect sophisticated spam patterns and coordinated attacks</p>
              </div>

              <div class="bg-secondary/50 rounded-lg p-4">
                <div class="flex items-center justify-between mb-2">
                  <h4 class="font-semibold text-foreground">Escalation System</h4>
                  <label class="relative inline-flex items-center cursor-pointer">
                    <input type="checkbox" v-model="autoModExtensions.escalation" class="sr-only peer">
                    <div class="w-11 h-6 bg-muted rounded-full peer peer-checked:after:translate-x-full after:content-[''] after:absolute after:top-0.5 after:left-[2px] after:bg-white after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-primary"></div>
                  </label>
                </div>
                <p class="text-sm text-muted-foreground">Automatically escalate punishments for repeat offenders</p>
              </div>

              <div class="bg-secondary/50 rounded-lg p-4">
                <div class="flex items-center justify-between mb-2">
                  <h4 class="font-semibold text-foreground">Custom Keyword Lists</h4>
                  <label class="relative inline-flex items-center cursor-pointer">
                    <input type="checkbox" v-model="autoModExtensions.customKeywords" class="sr-only peer">
                    <div class="w-11 h-6 bg-muted rounded-full peer peer-checked:after:translate-x-full after:content-[''] after:absolute after:top-0.5 after:left-[2px] after:bg-white after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-primary"></div>
                  </label>
                </div>
                <p class="text-sm text-muted-foreground">Maintain server-specific blocked word lists with regex support</p>
              </div>
            </div>

            <button @click="showAutoModSetupModal = true" class="w-full bg-primary hover:bg-primary/90 text-primary-foreground py-2 px-4 rounded-lg transition-colors">
              Configure AutoMod Integration
            </button>
          </div>
        </div>
      </div>

      <!-- AutoMod Analytics -->
      <div class="bg-card border border-border rounded-lg p-6">
        <h3 class="text-lg font-semibold text-foreground mb-4">AutoMod Analytics</h3>
        <div class="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div class="bg-secondary/50 rounded-lg p-4">
            <h4 class="font-semibold text-foreground">Actions Today</h4>
            <p class="text-2xl font-bold text-primary">{{ autoModAnalytics.actionsToday }}</p>
            <p class="text-sm text-green-500">-15% from yesterday</p>
          </div>
          <div class="bg-secondary/50 rounded-lg p-4">
            <h4 class="font-semibold text-foreground">False Positives</h4>
            <p class="text-2xl font-bold text-yellow-600">{{ autoModAnalytics.falsePositives }}</p>
            <p class="text-sm text-red-500">+2% this week</p>
          </div>
          <div class="bg-secondary/50 rounded-lg p-4">
            <h4 class="font-semibold text-foreground">Top Trigger</h4>
            <p class="text-lg font-bold text-foreground">{{ autoModAnalytics.topTrigger }}</p>
            <p class="text-sm text-muted-foreground">{{ autoModAnalytics.topTriggerCount }} times</p>
          </div>
          <div class="bg-secondary/50 rounded-lg p-4">
            <h4 class="font-semibold text-foreground">Accuracy Rate</h4>
            <p class="text-2xl font-bold text-green-600">{{ autoModAnalytics.accuracyRate }}%</p>
            <p class="text-sm text-green-500">+3% this month</p>
          </div>
        </div>
      </div>
    </div>

    <!-- Custom Rules -->
    <div v-if="activeTab === 'custom-rules'" class="space-y-6">
      <div class="flex justify-between items-center">
        <h2 class="text-xl font-semibold text-foreground">Custom Auto-Moderation Rules</h2>
        <button @click="showRuleModal = true" class="bg-primary hover:bg-primary/90 text-primary-foreground px-4 py-2 rounded-lg transition-colors">
          Create Rule
        </button>
      </div>

      <div class="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div v-for="rule in customAutoModRules" :key="rule.id" class="bg-card border border-border rounded-lg p-6">
          <div class="flex items-start justify-between mb-4">
            <div>
              <h3 class="font-semibold text-foreground">{{ rule.name }}</h3>
              <p class="text-sm text-muted-foreground">{{ rule.description }}</p>
            </div>
            <div class="flex items-center gap-2">
              <span :class="rule.enabled ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300' : 'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-300'" 
                    class="px-2 py-1 rounded-full text-xs font-medium">
                {{ rule.enabled ? 'Active' : 'Inactive' }}
              </span>
              <button @click="toggleRule(rule.id)" class="text-muted-foreground hover:text-foreground">
                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                  <path d="M12 2v20M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/>
                </svg>
              </button>
            </div>
          </div>
          
          <div class="space-y-2 text-sm">
            <div class="flex justify-between">
              <span class="text-muted-foreground">Trigger:</span>
              <span class="text-foreground">{{ rule.trigger }}</span>
            </div>
            <div class="flex justify-between">
              <span class="text-muted-foreground">Action:</span>
              <span class="text-foreground">{{ rule.action }}</span>
            </div>
            <div class="flex justify-between">
              <span class="text-muted-foreground">Triggered:</span>
              <span class="text-foreground">{{ rule.triggerCount }} times</span>
            </div>
          </div>

          <div class="mt-4 bg-secondary/50 rounded-lg p-3">
            <div class="flex items-center gap-2 text-sm">
              <span class="font-medium text-foreground">IF</span>
              <span class="bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300 px-2 py-1 rounded text-xs">
                {{ rule.condition }}
              </span>
              <span class="font-medium text-foreground">THEN</span>
              <span class="bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300 px-2 py-1 rounded text-xs">
                {{ rule.action }}
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- Scheduled Events -->
    <div v-if="activeTab === 'scheduled'" class="space-y-6">
      <div class="flex justify-between items-center">
        <h2 class="text-xl font-semibold text-foreground">Scheduled Events</h2>
        <button @click="showScheduleModal = true" class="bg-primary hover:bg-primary/90 text-primary-foreground px-4 py-2 rounded-lg transition-colors">
          Schedule Event
        </button>
      </div>

      <div class="space-y-4">
        <div v-for="event in scheduledEvents" :key="event.id" class="bg-card border border-border rounded-lg p-6">
          <div class="flex items-start justify-between">
            <div class="flex-1">
              <h3 class="font-semibold text-foreground mb-2">{{ event.name }}</h3>
              <p class="text-sm text-muted-foreground mb-3">{{ event.description }}</p>
              
              <div class="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                <div>
                  <span class="text-muted-foreground">Type:</span>
                  <span class="ml-2 text-foreground">{{ event.type }}</span>
                </div>
                <div>
                  <span class="text-muted-foreground">Schedule:</span>
                  <span class="ml-2 text-foreground">{{ event.schedule }}</span>
                </div>
                <div>
                  <span class="text-muted-foreground">Next Run:</span>
                  <span class="ml-2 text-foreground">{{ formatDate(event.nextRun) }}</span>
                </div>
                <div>
                  <span class="text-muted-foreground">Status:</span>
                  <span :class="event.enabled ? 'text-green-500' : 'text-red-500'" class="ml-2 font-medium">
                    {{ event.enabled ? 'Active' : 'Paused' }}
                  </span>
                </div>
              </div>
            </div>
            
            <div class="flex items-center gap-2">
              <button @click="toggleEvent(event.id)" class="text-muted-foreground hover:text-foreground">
                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                  <polygon points="5 3 19 12 5 21 5 3"/>
                </svg>
              </button>
              <button @click="editEvent(event)" class="text-muted-foreground hover:text-foreground">
                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                  <path d="M17 3a2.828 2.828 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5L17 3z"/>
                </svg>
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- Trigger Actions -->
    <div v-if="activeTab === 'triggers'" class="space-y-6">
      <div class="flex justify-between items-center">
        <h2 class="text-xl font-semibold text-foreground">Trigger-Based Actions</h2>
        <button @click="showTriggerModal = true" class="bg-primary hover:bg-primary/90 text-primary-foreground px-4 py-2 rounded-lg transition-colors">
          Create Trigger
        </button>
      </div>

      <div class="space-y-4">
        <div v-for="trigger in triggerActions" :key="trigger.id" class="bg-card border border-border rounded-lg p-6">
          <div class="flex items-start justify-between mb-4">
            <div>
              <h3 class="font-semibold text-foreground">{{ trigger.name }}</h3>
              <p class="text-sm text-muted-foreground">{{ trigger.description }}</p>
            </div>
            <span :class="trigger.enabled ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300' : 'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-300'" 
                  class="px-3 py-1 rounded-full text-xs font-medium">
              {{ trigger.enabled ? 'Active' : 'Inactive' }}
            </span>
          </div>
          
          <div class="bg-secondary/50 rounded-lg p-4">
            <div class="flex items-center gap-2 text-sm">
              <span class="font-medium text-foreground">IF</span>
              <span class="bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300 px-2 py-1 rounded text-xs">
                {{ trigger.condition }}
              </span>
              <span class="font-medium text-foreground">THEN</span>
              <span class="bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300 px-2 py-1 rounded text-xs">
                {{ trigger.action }}
              </span>
            </div>
          </div>
          
          <div class="mt-4 text-xs text-muted-foreground">
            Triggered {{ trigger.triggerCount }} times • Last: {{ formatDate(trigger.lastTriggered) }}
          </div>
        </div>
      </div>
    </div>

    <!-- Message Templates -->
    <div v-if="activeTab === 'templates'" class="space-y-6">
      <div class="flex justify-between items-center">
        <h2 class="text-xl font-semibold text-foreground">Message Templates</h2>
        <button @click="showTemplateModal = true" class="bg-primary hover:bg-primary/90 text-primary-foreground px-4 py-2 rounded-lg transition-colors">
          Create Template
        </button>
      </div>

      <div class="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div v-for="template in messageTemplates" :key="template.id" class="bg-card border border-border rounded-lg p-6">
          <div class="flex items-start justify-between mb-4">
            <div>
              <h3 class="font-semibold text-foreground">{{ template.name }}</h3>
              <span class="inline-flex items-center px-2 py-1 rounded-full text-xs bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200">
                {{ template.category }}
              </span>
            </div>
            <div class="flex items-center gap-2">
              <button @click="useTemplate(template)" class="text-primary hover:text-primary/80 text-sm">
                Use
              </button>
              <button @click="editTemplate(template)" class="text-muted-foreground hover:text-foreground">
                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                  <path d="M17 3a2.828 2.828 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5L17 3z"/>
                </svg>
              </button>
            </div>
          </div>
          
          <div class="bg-secondary/50 rounded-lg p-3 mb-3">
            <p class="text-sm text-foreground">{{ template.content }}</p>
          </div>
          
          <div class="text-xs text-muted-foreground">
            Used {{ template.usageCount }} times
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { useToastStore } from '@/stores/toast'

const toastStore = useToastStore()

const activeTab = ref('discord-automod')
const showAutoModSetupModal = ref(false)
const showRuleModal = ref(false)
const showScheduleModal = ref(false)
const showTriggerModal = ref(false)
const showTemplateModal = ref(false)

// Discord AutoMod Integration
const discordAutoModRules = ref([
  {
    id: '1',
    name: 'Spam Prevention',
    description: 'Detects and prevents spam messages',
    enabled: true,
    triggerType: 'Spam',
    actions: ['Delete Message', 'Timeout User'],
    triggerCount: 156
  },
  {
    id: '2',
    name: 'Keyword Filter',
    description: 'Blocks messages containing prohibited words',
    enabled: true,
    triggerType: 'Keyword',
    actions: ['Delete Message', 'Flag for Review'],
    triggerCount: 89
  },
  {
    id: '3',
    name: 'Mention Spam',
    description: 'Prevents excessive mentions in messages',
    enabled: false,
    triggerType: 'Mention Spam',
    actions: ['Delete Message', 'Warn User'],
    triggerCount: 23
  }
])

const autoModExtensions = ref({
  contextAnalysis: true,
  advancedSpam: true,
  escalation: false,
  customKeywords: true
})

const autoModAnalytics = ref({
  actionsToday: 47,
  falsePositives: 3,
  topTrigger: 'Spam Prevention',
  topTriggerCount: 156,
  accuracyRate: 94
})

// Custom Rules
const customAutoModRules = ref([
  {
    id: '1',
    name: 'Link Spam Detection',
    description: 'Advanced detection of suspicious links and spam patterns',
    trigger: 'Multiple links in short time',
    action: 'Delete + timeout',
    condition: 'User posts >3 links in 30s',
    enabled: true,
    triggerCount: 45
  },
  {
    id: '2',
    name: 'Raid Protection',
    description: 'Detects coordinated raids and mass join events',
    trigger: 'Mass user join',
    action: 'Lock server + alert staff',
    condition: '>10 users join in 60s',
    enabled: true,
    triggerCount: 12
  }
])

// Scheduled Events
const scheduledEvents = ref([
  {
    id: '1',
    name: 'Daily Announcements',
    description: 'Send daily server announcements',
    type: 'Message',
    schedule: 'Daily at 9:00 AM',
    nextRun: new Date(Date.now() + 24 * 60 * 60 * 1000),
    enabled: true
  },
  {
    id: '2',
    name: 'Weekly Role Rotation',
    description: 'Rotate featured member role',
    type: 'Role Assignment',
    schedule: 'Weekly on Sunday',
    nextRun: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
    enabled: false
  }
])

// Trigger Actions
const triggerActions = ref([
  {
    id: '1',
    name: 'Welcome New Members',
    description: 'Send welcome message when user joins',
    condition: 'User joins server',
    action: 'Send welcome message',
    enabled: true,
    triggerCount: 234,
    lastTriggered: new Date(Date.now() - 2 * 60 * 60 * 1000)
  },
  {
    id: '2',
    name: 'Auto-Role Assignment',
    description: 'Assign role when user reacts',
    condition: 'User reacts with 👍',
    action: 'Assign Member role',
    enabled: true,
    triggerCount: 89,
    lastTriggered: new Date(Date.now() - 30 * 60 * 1000)
  }
])

// Message Templates
const messageTemplates = ref([
  {
    id: '1',
    name: 'Welcome Message',
    category: 'Greetings',
    content: 'Welcome to our server, {{user}}! Please read the rules and enjoy your stay.',
    usageCount: 156
  },
  {
    id: '2',
    name: 'Rule Reminder',
    category: 'Moderation',
    content: 'Please remember to follow our server rules. You can find them in #rules.',
    usageCount: 89
  },
  {
    id: '3',
    name: 'Event Announcement',
    category: 'Events',
    content: '🎉 Exciting event coming up! Join us for {{event_name}} on {{date}}.',
    usageCount: 23
  }
])

const formatDate = (date: Date) => {
  return date.toLocaleString()
}

const toggleAutoModRule = (id: string) => {
  const rule = discordAutoModRules.value.find(r => r.id === id)
  if (rule) {
    rule.enabled = !rule.enabled
    toastStore.addToast(`AutoMod rule "${rule.name}" ${rule.enabled ? 'enabled' : 'disabled'}!`, 'success')
  }
}

const editAutoModRule = (rule: any) => {
  console.log('Edit AutoMod rule:', rule)
  toastStore.addToast('AutoMod rule configuration would open here', 'info')
}

const viewAutoModLogs = (rule: any) => {
  console.log('View AutoMod logs for:', rule)
  toastStore.addToast('AutoMod logs would open here', 'info')
}

const toggleRule = (id: string) => {
  const rule = customAutoModRules.value.find(r => r.id === id)
  if (rule) {
    rule.enabled = !rule.enabled
    toastStore.addToast(`Custom rule "${rule.name}" ${rule.enabled ? 'enabled' : 'disabled'}!`, 'success')
  }
}

const toggleEvent = (id: string) => {
  const event = scheduledEvents.value.find(e => e.id === id)
  if (event) {
    event.enabled = !event.enabled
    toastStore.addToast(`Event "${event.name}" ${event.enabled ? 'enabled' : 'disabled'}!`, 'success')
  }
}

const editEvent = (event: any) => {
  console.log('Edit event:', event)
  toastStore.addToast('Edit event functionality would open here', 'info')
}

const useTemplate = (template: any) => {
  template.usageCount++
  toastStore.addToast(`Template "${template.name}" used successfully!`, 'success')
}

const editTemplate = (template: any) => {
  console.log('Edit template:', template)
  toastStore.addToast('Edit template functionality would open here', 'info')
}
</script>