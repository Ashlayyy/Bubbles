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
            <p class="text-sm text-muted-foreground">Current period</p>
          </div>
          <div class="bg-secondary/50 rounded-lg p-4">
            <h4 class="font-semibold text-foreground">False Positives</h4>
            <p class="text-2xl font-bold text-yellow-600">{{ autoModAnalytics.falsePositives }}</p>
            <p class="text-sm text-muted-foreground">Not tracked separately</p>
          </div>
          <div class="bg-secondary/50 rounded-lg p-4">
            <h4 class="font-semibold text-foreground">Top Trigger</h4>
            <p class="text-lg font-bold text-foreground">{{ autoModAnalytics.topTrigger }}</p>
            <p class="text-sm text-muted-foreground">{{ autoModAnalytics.topTriggerCount }} times</p>
          </div>
          <div class="bg-secondary/50 rounded-lg p-4">
            <h4 class="font-semibold text-foreground">Accuracy Rate</h4>
            <p class="text-2xl font-bold text-green-600">{{ autoModAnalytics.accuracyRate }}%</p>
            <p class="text-sm text-muted-foreground">Successful executions</p>
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
import { onMounted, ref } from 'vue'
import { useRoute } from 'vue-router'
import { automationEndpoints } from '@/lib/endpoints/automation'
import { useToastStore } from '@/stores/toast'

const toastStore = useToastStore()
const route = useRoute()
const guildId = () => String(route.params.guildId || '')

const activeTab = ref('discord-automod')
const showAutoModSetupModal = ref(false)
const showRuleModal = ref(false)
const showScheduleModal = ref(false)
const showTriggerModal = ref(false)
const showTemplateModal = ref(false)
const loadError = ref('')

const triggerTypeNames: Record<number, string> = {
  1: 'Keyword',
  3: 'Spam',
  4: 'Keyword Preset',
  5: 'Mention Spam',
  6: 'Member Profile',
}

const discordAutoModRules = ref<Array<{
  id: string
  name: string
  description: string
  enabled: boolean
  triggerType: string
  actions: string[]
  triggerCount: number
}>>([])

const autoModExtensions = ref({
  contextAnalysis: false,
  advancedSpam: false,
  escalation: false,
  customKeywords: false
})

const autoModAnalytics = ref({
  actionsToday: 0,
  falsePositives: 0,
  topTrigger: 'None',
  topTriggerCount: 0,
  accuracyRate: 0
})

const customAutoModRules = ref<Array<{
  id: string
  name: string
  description: string
  trigger: string
  action: string
  condition: string
  enabled: boolean
  triggerCount: number
}>>([])

const scheduledEvents = ref<Array<{
  id: string
  name: string
  description: string
  type: string
  schedule: string
  nextRun: Date
  enabled: boolean
}>>([])

const triggerActions = ref<Array<{
  id: string
  name: string
  description: string
  condition: string
  action: string
  enabled: boolean
  triggerCount: number
  lastTriggered: Date
}>>([])

const messageTemplates = ref<Array<{
  id: string
  name: string
  category: string
  content: string
  usageCount: number
}>>([])

const formatDate = (date: Date) => {
  return new Date(date).toLocaleString()
}

function unwrap(payload: any) {
  return payload?.data ?? payload
}

function stringifyTrigger(trigger: unknown) {
  if (typeof trigger === 'string') return trigger
  if (trigger && typeof trigger === 'object') {
    const obj = trigger as Record<string, unknown>
    return String(obj.type ?? obj.name ?? JSON.stringify(trigger))
  }
  return 'Unknown'
}

function stringifyActions(actions: unknown) {
  if (Array.isArray(actions)) {
    return actions
      .map((action) => {
        if (typeof action === 'string') return action
        if (action && typeof action === 'object') {
          const obj = action as Record<string, unknown>
          return String(obj.type ?? obj.name ?? JSON.stringify(action))
        }
        return String(action)
      })
      .join(', ')
  }
  return String(actions ?? 'None')
}

async function loadAutomation() {
  const id = guildId()
  if (!id) return
  try {
    const [discordRes, rulesRes, statsRes] = await Promise.all([
      automationEndpoints.getDiscordRules(id).catch(() => null),
      automationEndpoints.getRules(id),
      automationEndpoints.stats(id, { period: '7d' }).catch(() => null),
    ])

    const discord = unwrap(discordRes?.data)
    discordAutoModRules.value = (discord?.rules ?? []).map((rule: any) => ({
      id: rule.id,
      name: rule.name,
      description: `Discord AutoMod • event ${rule.eventType ?? ''}`,
      enabled: Boolean(rule.enabled),
      triggerType: triggerTypeNames[rule.triggerType] ?? String(rule.triggerType ?? 'Unknown'),
      actions: Array.isArray(rule.actions)
        ? rule.actions.map((action: any) => String(action.type ?? action))
        : [],
      triggerCount: Number(rule.triggerCount ?? 0),
    }))
    autoModAnalytics.value.actionsToday = Number(discord?.analytics?.actionsToday ?? 0)
    autoModAnalytics.value.topTrigger = discordAutoModRules.value[0]?.name ?? 'None'
    autoModAnalytics.value.topTriggerCount = discordAutoModRules.value[0]?.triggerCount ?? 0

    const rulesPayload = unwrap(rulesRes.data)
    const rules = Array.isArray(rulesPayload) ? rulesPayload : rulesPayload?.rules ?? []
    customAutoModRules.value = rules.map((rule: any) => ({
      id: rule.id,
      name: rule.name,
      description: rule.description || '',
      trigger: stringifyTrigger(rule.trigger),
      action: stringifyActions(rule.actions),
      condition: stringifyTrigger(rule.conditions),
      enabled: Boolean(rule.enabled),
      triggerCount: Number(rule.currentExecutions ?? 0),
    }))

    scheduledEvents.value = rules
      .filter((rule: any) => stringifyTrigger(rule.trigger).toUpperCase().includes('SCHEDULE'))
      .map((rule: any) => ({
        id: rule.id,
        name: rule.name,
        description: rule.description || '',
        type: stringifyActions(rule.actions),
        schedule: stringifyTrigger(rule.trigger),
        nextRun: rule.lastExecuted ? new Date(rule.lastExecuted) : new Date(),
        enabled: Boolean(rule.enabled),
      }))

    triggerActions.value = rules.map((rule: any) => ({
      id: rule.id,
      name: rule.name,
      description: rule.description || '',
      condition: stringifyTrigger(rule.trigger),
      action: stringifyActions(rule.actions),
      enabled: Boolean(rule.enabled),
      triggerCount: Number(rule.currentExecutions ?? 0),
      lastTriggered: rule.lastExecuted ? new Date(rule.lastExecuted) : new Date(0),
    }))

    messageTemplates.value = rules
      .filter((rule: any) => String(rule.category || '').toLowerCase() === 'templates')
      .map((rule: any) => ({
        id: rule.id,
        name: rule.name,
        category: rule.category || 'General',
        content: stringifyActions(rule.actions),
        usageCount: Number(rule.currentExecutions ?? 0),
      }))

    const stats = unwrap(statsRes?.data)
    if (stats?.overview) {
      autoModAnalytics.value.accuracyRate = Number(stats.overview.successRate ?? 0)
      autoModAnalytics.value.falsePositives = Math.max(
        0,
        Number(stats.overview.totalExecutions ?? 0) - Number(stats.overview.successfulExecutions ?? 0)
      )
    }
  } catch (error: any) {
    loadError.value = error.response?.data?.error || 'Could not load automation.'
    toastStore.addToast(loadError.value, 'error')
  }
}

const toggleAutoModRule = async (id: string) => {
  const rule = discordAutoModRules.value.find(r => r.id === id)
  if (!rule) return
  try {
    await automationEndpoints.toggleDiscordRule(guildId(), id, !rule.enabled)
    rule.enabled = !rule.enabled
    toastStore.addToast(`AutoMod rule "${rule.name}" ${rule.enabled ? 'enabled' : 'disabled'}`, 'success')
  } catch (error: any) {
    toastStore.addToast(error.response?.data?.error || 'Could not update Discord AutoMod rule', 'error')
  }
}

const editAutoModRule = (_rule: any) => {
  toastStore.addToast('Edit Discord AutoMod rules in Server Settings > AutoMod, or toggle them here.', 'info')
}

const viewAutoModLogs = (_rule: any) => {
  toastStore.addToast('AutoMod actions are written to the server audit and logging pages.', 'info')
}

const toggleRule = async (id: string) => {
  const rule = customAutoModRules.value.find(r => r.id === id)
  if (!rule) return
  try {
    await automationEndpoints.updateRule(guildId(), id, { enabled: !rule.enabled })
    rule.enabled = !rule.enabled
    toastStore.addToast(`Custom rule "${rule.name}" ${rule.enabled ? 'enabled' : 'disabled'}`, 'success')
  } catch (error: any) {
    toastStore.addToast(error.response?.data?.error || 'Could not update rule', 'error')
  }
}

const toggleEvent = async (id: string) => {
  const event = scheduledEvents.value.find(e => e.id === id)
  if (!event) return
  try {
    await automationEndpoints.updateRule(guildId(), id, { enabled: !event.enabled })
    event.enabled = !event.enabled
    toastStore.addToast(`Event "${event.name}" ${event.enabled ? 'enabled' : 'disabled'}`, 'success')
  } catch (error: any) {
    toastStore.addToast(error.response?.data?.error || 'Could not update event', 'error')
  }
}

const editEvent = (_event: any) => {
  toastStore.addToast('Update scheduled automations from Custom Rules for now.', 'info')
}

const useTemplate = async (template: any) => {
  try {
    await automationEndpoints.executeRule(guildId(), template.id)
    template.usageCount++
    toastStore.addToast(`Template "${template.name}" executed`, 'success')
  } catch (error: any) {
    toastStore.addToast(error.response?.data?.error || 'Could not run template', 'error')
  }
}

const editTemplate = (_template: any) => {
  toastStore.addToast('Templates are automation rules in the templates category.', 'info')
}

onMounted(loadAutomation)
</script>
