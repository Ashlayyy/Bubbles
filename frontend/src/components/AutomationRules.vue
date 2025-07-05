<template>
  <div class="space-y-6">
    <div class="flex justify-between items-center">
      <h2 class="text-xl font-semibold text-foreground">Automation Rules</h2>
      <button @click="showCreateModal = true" class="bg-primary hover:bg-primary/90 text-primary-foreground px-4 py-2 rounded-lg transition-colors">
        Create Rule
      </button>
    </div>

    <!-- Rules List -->
    <div class="space-y-4">
      <div v-if="rules.length === 0" class="text-center py-12">
        <div class="text-muted-foreground">
          <svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="mx-auto mb-4 opacity-50">
            <path d="M12 2v20M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/>
          </svg>
          <p class="text-lg font-medium">No automation rules</p>
          <p class="text-sm">Create your first rule to automate server management</p>
        </div>
      </div>

      <div v-for="rule in rules" :key="rule.id" class="bg-card border border-border rounded-lg p-6">
        <div class="flex items-start justify-between mb-4">
          <div>
            <h3 class="font-semibold text-foreground mb-2">{{ rule.name }}</h3>
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
            <button @click="editRule(rule)" class="text-muted-foreground hover:text-foreground">
              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <path d="M17 3a2.828 2.828 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5L17 3z"/>
              </svg>
            </button>
            <button @click="deleteRule(rule.id)" class="text-muted-foreground hover:text-destructive">
              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <path d="M3 6h18"/>
                <path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"/>
                <path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"/>
              </svg>
            </button>
          </div>
        </div>
        
        <div class="bg-secondary/50 rounded-lg p-4 mb-4">
          <div class="flex flex-col md:flex-row md:items-center gap-2 text-sm">
            <div class="font-medium text-foreground">IF</div>
            <div class="bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300 px-3 py-1 rounded">
              {{ rule.trigger }}
            </div>
            <div class="font-medium text-foreground">THEN</div>
            <div class="bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300 px-3 py-1 rounded">
              {{ rule.action }}
            </div>
          </div>
        </div>
        
        <div class="text-sm text-muted-foreground">
          <div>Triggered {{ rule.triggerCount }} times</div>
          <div>Last triggered: {{ rule.lastTriggered ? formatDate(rule.lastTriggered) : 'Never' }}</div>
        </div>
      </div>
    </div>

    <!-- Create/Edit Modal -->
    <div v-if="showCreateModal" class="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div class="bg-card border border-border rounded-lg w-full max-w-2xl max-h-[90vh] overflow-y-auto m-4">
        <div class="p-6 border-b border-border">
          <h3 class="text-lg font-semibold text-foreground">
            {{ editingRule ? 'Edit Rule' : 'Create Automation Rule' }}
          </h3>
        </div>
        
        <form @submit.prevent="saveRule" class="p-6 space-y-4">
          <div>
            <label class="block text-sm font-medium text-foreground mb-2">Rule Name</label>
            <input v-model="ruleForm.name" type="text" class="w-full bg-background border border-border rounded-lg px-3 py-2 text-foreground" required>
          </div>
          
          <div>
            <label class="block text-sm font-medium text-foreground mb-2">Description</label>
            <input v-model="ruleForm.description" type="text" class="w-full bg-background border border-border rounded-lg px-3 py-2 text-foreground">
          </div>
          
          <div>
            <label class="block text-sm font-medium text-foreground mb-2">Trigger (When this happens...)</label>
            <select v-model="ruleForm.triggerType" class="w-full bg-background border border-border rounded-lg px-3 py-2 text-foreground" required>
              <option value="">Select a trigger</option>
              <option v-for="trigger in availableTriggers" :key="trigger.id" :value="trigger.id">
                {{ trigger.name }}
              </option>
            </select>
          </div>
          
          <!-- Trigger Configuration -->
          <div v-if="ruleForm.triggerType" class="space-y-4 pl-6 border-l-2 border-primary">
            <div v-if="ruleForm.triggerType === 'member_join'">
              <label class="block text-sm font-medium text-foreground mb-2">Account Age Requirement</label>
              <div class="flex items-center gap-2">
                <input v-model.number="ruleForm.triggerConfig.accountAgeDays" type="number" min="0" class="w-24 bg-background border border-border rounded-lg px-3 py-2 text-foreground">
                <span class="text-foreground">days</span>
              </div>
            </div>
            
            <div v-if="ruleForm.triggerType === 'message_contains'">
              <label class="block text-sm font-medium text-foreground mb-2">Keywords (comma separated)</label>
              <input v-model="ruleForm.triggerConfig.keywords" type="text" class="w-full bg-background border border-border rounded-lg px-3 py-2 text-foreground">
            </div>
            
            <div v-if="ruleForm.triggerType === 'user_role_added'">
              <label class="block text-sm font-medium text-foreground mb-2">Role</label>
              <select v-model="ruleForm.triggerConfig.roleId" class="w-full bg-background border border-border rounded-lg px-3 py-2 text-foreground">
                <option value="">Any role</option>
                <option v-for="role in roles" :key="role.id" :value="role.id">
                  {{ role.name }}
                </option>
              </select>
            </div>
          </div>
          
          <div>
            <label class="block text-sm font-medium text-foreground mb-2">Action (Do this...)</label>
            <select v-model="ruleForm.actionType" class="w-full bg-background border border-border rounded-lg px-3 py-2 text-foreground" required>
              <option value="">Select an action</option>
              <option v-for="action in availableActions" :key="action.id" :value="action.id">
                {{ action.name }}
              </option>
            </select>
          </div>
          
          <!-- Action Configuration -->
          <div v-if="ruleForm.actionType" class="space-y-4 pl-6 border-l-2 border-primary">
            <div v-if="ruleForm.actionType === 'send_message'">
              <label class="block text-sm font-medium text-foreground mb-2">Channel</label>
              <select v-model="ruleForm.actionConfig.channelId" class="w-full bg-background border border-border rounded-lg px-3 py-2 text-foreground">
                <option value="">Select a channel</option>
                <option v-for="channel in channels" :key="channel.id" :value="channel.id">
                  #{{ channel.name }}
                </option>
              </select>
              
              <label class="block text-sm font-medium text-foreground mb-2 mt-4">Message</label>
              <textarea v-model="ruleForm.actionConfig.message" rows="3" class="w-full bg-background border border-border rounded-lg px-3 py-2 text-foreground"></textarea>
            </div>
            
            <div v-if="ruleForm.actionType === 'assign_role'">
              <label class="block text-sm font-medium text-foreground mb-2">Role to Assign</label>
              <select v-model="ruleForm.actionConfig.roleId" class="w-full bg-background border border-border rounded-lg px-3 py-2 text-foreground">
                <option value="">Select a role</option>
                <option v-for="role in roles" :key="role.id" :value="role.id">
                  {{ role.name }}
                </option>
              </select>
            </div>
            
            <div v-if="ruleForm.actionType === 'timeout_user'">
              <label class="block text-sm font-medium text-foreground mb-2">Timeout Duration</label>
              <div class="flex items-center gap-2">
                <input v-model.number="ruleForm.actionConfig.timeoutMinutes" type="number" min="1" class="w-24 bg-background border border-border rounded-lg px-3 py-2 text-foreground">
                <span class="text-foreground">minutes</span>
              </div>
            </div>
          </div>
          
          <div class="flex items-center space-x-2">
            <input type="checkbox" v-model="ruleForm.enabled" id="enabled" class="rounded border-border text-primary focus:ring-primary">
            <label for="enabled" class="text-sm font-medium text-foreground">Enable rule</label>
          </div>
          
          <div class="flex justify-end space-x-3 pt-4">
            <button type="button" @click="closeModal" class="px-4 py-2 border border-border rounded-lg text-muted-foreground hover:text-foreground">
              Cancel
            </button>
            <button type="submit" class="px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90">
              {{ editingRule ? 'Update' : 'Create' }}
            </button>
          </div>
        </form>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive } from 'vue'
import { useToastStore } from '@/stores/toast'

const toastStore = useToastStore()

interface Rule {
  id: string
  name: string
  description: string
  trigger: string
  triggerType: string
  triggerConfig: any
  action: string
  actionType: string
  actionConfig: any
  enabled: boolean
  triggerCount: number
  lastTriggered?: Date
}

const showCreateModal = ref(false)
const editingRule = ref<Rule | null>(null)

const rules = ref<Rule[]>([
  {
    id: '1',
    name: 'Welcome New Members',
    description: 'Send welcome message when user joins',
    trigger: 'User joins server',
    triggerType: 'member_join',
    triggerConfig: {},
    action: 'Send welcome message',
    actionType: 'send_message',
    actionConfig: {
      channelId: 'welcome',
      message: 'Welcome to the server, {{user}}!'
    },
    enabled: true,
    triggerCount: 234,
    lastTriggered: new Date(Date.now() - 2 * 60 * 60 * 1000)
  },
  {
    id: '2',
    name: 'Auto-Role Assignment',
    description: 'Assign role when user reacts',
    trigger: 'User reacts with 👍',
    triggerType: 'message_reaction_add',
    triggerConfig: {
      emoji: '👍',
      messageId: '123456789'
    },
    action: 'Assign Member role',
    actionType: 'assign_role',
    actionConfig: {
      roleId: 'member'
    },
    enabled: true,
    triggerCount: 89,
    lastTriggered: new Date(Date.now() - 30 * 60 * 1000)
  }
])

const channels = ref([
  { id: 'general', name: 'general' },
  { id: 'welcome', name: 'welcome' },
  { id: 'announcements', name: 'announcements' }
])

const roles = ref([
  { id: 'member', name: 'Member' },
  { id: 'verified', name: 'Verified' },
  { id: 'vip', name: 'VIP' }
])

const availableTriggers = [
  { id: 'member_join', name: 'User Joins Server' },
  { id: 'member_leave', name: 'User Leaves Server' },
  { id: 'message_contains', name: 'Message Contains Keyword' },
  { id: 'message_reaction_add', name: 'User Adds Reaction' },
  { id: 'user_role_added', name: 'User Gets Role' },
  { id: 'user_level_up', name: 'User Levels Up' }
]

const availableActions = [
  { id: 'send_message', name: 'Send Message' },
  { id: 'assign_role', name: 'Assign Role' },
  { id: 'remove_role', name: 'Remove Role' },
  { id: 'timeout_user', name: 'Timeout User' },
  { id: 'create_channel', name: 'Create Channel' },
  { id: 'delete_message', name: 'Delete Message' }
]

const ruleForm = reactive({
  name: '',
  description: '',
  triggerType: '',
  triggerConfig: {} as any,
  actionType: '',
  actionConfig: {} as any,
  enabled: true
})

const formatDate = (date?: Date) => {
  return date ? date.toLocaleString() : 'Never'
}

const toggleRule = (ruleId: string) => {
  const rule = rules.value.find(r => r.id === ruleId)
  if (rule) {
    rule.enabled = !rule.enabled
    toastStore.addToast(`Rule "${rule.name}" ${rule.enabled ? 'enabled' : 'disabled'}`, 'success')
  }
}

const editRule = (rule: Rule) => {
  editingRule.value = rule
  Object.assign(ruleForm, {
    name: rule.name,
    description: rule.description,
    triggerType: rule.triggerType,
    triggerConfig: { ...rule.triggerConfig },
    actionType: rule.actionType,
    actionConfig: { ...rule.actionConfig },
    enabled: rule.enabled
  })
  showCreateModal.value = true
}

const deleteRule = (ruleId: string) => {
  if (confirm('Are you sure you want to delete this rule?')) {
    const index = rules.value.findIndex(r => r.id === ruleId)
    if (index !== -1) {
      const rule = rules.value[index]
      rules.value.splice(index, 1)
      toastStore.addToast(`Rule "${rule.name}" deleted`, 'success')
    }
  }
}

const getTriggerDescription = (triggerType: string, config: any) => {
  switch (triggerType) {
    case 'member_join':
      return 'User joins server'
    case 'member_leave':
      return 'User leaves server'
    case 'message_contains':
      return `Message contains "${config.keywords || 'any keyword'}"`
    case 'message_reaction_add':
      return `User reacts with ${config.emoji || 'any emoji'}`
    case 'user_role_added':
      const role = roles.value.find(r => r.id === config.roleId)
      return `User gets role ${role ? role.name : 'any role'}`
    case 'user_level_up':
      return `User levels up${config.level ? ` to level ${config.level}` : ''}`
    default:
      return 'Unknown trigger'
  }
}

const getActionDescription = (actionType: string, config: any) => {
  switch (actionType) {
    case 'send_message':
      const channel = channels.value.find(c => c.id === config.channelId)
      return `Send message in ${channel ? '#' + channel.name : 'channel'}`
    case 'assign_role':
      const role = roles.value.find(r => r.id === config.roleId)
      return `Assign role ${role ? role.name : 'to user'}`
    case 'remove_role':
      const removeRole = roles.value.find(r => r.id === config.roleId)
      return `Remove role ${removeRole ? removeRole.name : 'from user'}`
    case 'timeout_user':
      return `Timeout user for ${config.timeoutMinutes || 5} minutes`
    case 'create_channel':
      return `Create channel ${config.channelName || ''}`
    case 'delete_message':
      return 'Delete message'
    default:
      return 'Unknown action'
  }
}

const saveRule = () => {
  const triggerDescription = getTriggerDescription(ruleForm.triggerType, ruleForm.triggerConfig)
  const actionDescription = getActionDescription(ruleForm.actionType, ruleForm.actionConfig)

  if (editingRule.value) {
    // Update existing rule
    const index = rules.value.findIndex(r => r.id === editingRule.value!.id)
    if (index !== -1) {
      rules.value[index] = {
        ...rules.value[index],
        name: ruleForm.name,
        description: ruleForm.description,
        trigger: triggerDescription,
        triggerType: ruleForm.triggerType,
        triggerConfig: { ...ruleForm.triggerConfig },
        action: actionDescription,
        actionType: ruleForm.actionType,
        actionConfig: { ...ruleForm.actionConfig },
        enabled: ruleForm.enabled
      }
      toastStore.addToast(`Rule "${ruleForm.name}" updated`, 'success')
    }
  } else {
    // Create new rule
    const newRule: Rule = {
      id: Date.now().toString(),
      name: ruleForm.name,
      description: ruleForm.description,
      trigger: triggerDescription,
      triggerType: ruleForm.triggerType,
      triggerConfig: { ...ruleForm.triggerConfig },
      action: actionDescription,
      actionType: ruleForm.actionType,
      actionConfig: { ...ruleForm.actionConfig },
      enabled: ruleForm.enabled,
      triggerCount: 0
    }
    rules.value.push(newRule)
    toastStore.addToast(`Rule "${ruleForm.name}" created`, 'success')
  }
  
  closeModal()
}

const closeModal = () => {
  showCreateModal.value = false
  editingRule.value = null
  Object.assign(ruleForm, {
    name: '',
    description: '',
    triggerType: '',
    triggerConfig: {},
    actionType: '',
    actionConfig: {},
    enabled: true
  })
}
</script>