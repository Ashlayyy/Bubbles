
import { defineStore } from 'pinia'
import { ref, computed } from 'vue'

export interface ReasonAlias {
  id: string
  name: string
  reason: string
  enabled: boolean
  usageCount: number
  category: 'moderation' | 'custom'
}

export interface ModerationAction {
  id: string
  name: string
  description: string
  category: 'moderation' | 'utility' | 'fun' | 'admin'
  reasonAliases: ReasonAlias[]
  enabled: boolean
}

export const useAliasesStore = defineStore('aliases', () => {
  const actions = ref<ModerationAction[]>([
    // Moderation Actions
    {
      id: 'ban',
      name: 'ban',
      description: 'Ban a user from the server',
      category: 'moderation',
      enabled: true,
      reasonAliases: [
        { id: 'ban-1', name: 'spam', reason: 'Spamming messages in channels', enabled: true, usageCount: 45, category: 'moderation' },
        { id: 'ban-2', name: 'toxic', reason: 'Toxic behavior towards other members', enabled: true, usageCount: 32, category: 'moderation' },
        { id: 'ban-3', name: 'raid', reason: 'Participating in server raid', enabled: true, usageCount: 12, category: 'moderation' }
      ]
    },
    {
      id: 'kick',
      name: 'kick',
      description: 'Kick a user from the server',
      category: 'moderation',
      enabled: true,
      reasonAliases: [
        { id: 'kick-1', name: 'warn3', reason: 'Third warning - temporary removal', enabled: true, usageCount: 23, category: 'moderation' },
        { id: 'kick-2', name: 'disrupt', reason: 'Disrupting voice channels', enabled: true, usageCount: 15, category: 'moderation' }
      ]
    },
    {
      id: 'mute',
      name: 'mute',
      description: 'Mute a user in the server',
      category: 'moderation',
      enabled: true,
      reasonAliases: [
        { id: 'mute-1', name: 'caps', reason: 'Excessive use of capital letters', enabled: true, usageCount: 67, category: 'moderation' },
        { id: 'mute-2', name: 'flood', reason: 'Message flooding', enabled: true, usageCount: 43, category: 'moderation' },
        { id: 'mute-3', name: 'nsfw', reason: 'Posting NSFW content in non-NSFW channels', enabled: true, usageCount: 28, category: 'moderation' }
      ]
    },
    {
      id: 'timeout',
      name: 'timeout',
      description: 'Timeout a user for a specified duration',
      category: 'moderation',
      enabled: true,
      reasonAliases: [
        { id: 'timeout-1', name: 'argue', reason: 'Arguing with moderators', enabled: true, usageCount: 34, category: 'moderation' },
        { id: 'timeout-2', name: 'offtopic', reason: 'Consistently posting off-topic content', enabled: true, usageCount: 19, category: 'moderation' }
      ]
    },
    {
      id: 'warn',
      name: 'warn',
      description: 'Issue a warning to a user',
      category: 'moderation',
      enabled: true,
      reasonAliases: [
        { id: 'warn-1', name: 'language', reason: 'Inappropriate language', enabled: true, usageCount: 89, category: 'moderation' },
        { id: 'warn-2', name: 'ping', reason: 'Unnecessary pinging of staff/everyone', enabled: true, usageCount: 56, category: 'moderation' },
        { id: 'warn-3', name: 'rules', reason: 'Minor rule violation', enabled: true, usageCount: 72, category: 'moderation' }
      ]
    }
  ])

  const searchQuery = ref('')
  const selectedCategory = ref<string>('all')

  const filteredActions = computed(() => {
    let filtered = actions.value

    if (selectedCategory.value !== 'all') {
      filtered = filtered.filter(action => action.category === selectedCategory.value)
    }

    if (searchQuery.value) {
      const query = searchQuery.value.toLowerCase()
      filtered = filtered.filter(action => 
        action.name.toLowerCase().includes(query) ||
        action.description.toLowerCase().includes(query) ||
        action.reasonAliases.some(alias => 
          alias.name.toLowerCase().includes(query) ||
          alias.reason.toLowerCase().includes(query)
        )
      )
    }

    return filtered
  })

  const categories = computed(() => [
    { value: 'all', label: 'All Actions', count: actions.value.length },
    { value: 'moderation', label: 'Moderation', count: actions.value.filter(a => a.category === 'moderation').length },
    { value: 'utility', label: 'Utility', count: actions.value.filter(a => a.category === 'utility').length },
    { value: 'fun', label: 'Fun', count: actions.value.filter(a => a.category === 'fun').length },
    { value: 'admin', label: 'Admin', count: actions.value.filter(a => a.category === 'admin').length }
  ])

  const getAllReasonAliases = computed(() => {
    return actions.value.flatMap(action => 
      action.reasonAliases.map(alias => ({ ...alias, actionName: action.name }))
    )
  })

  function addReasonAlias(actionId: string, aliasName: string, reason: string) {
    const action = actions.value.find(a => a.id === actionId)
    if (!action) return

    // Check for conflicts
    if (hasReasonAliasConflict(aliasName, actionId)) {
      throw new Error(`Reason alias "${aliasName}" already exists for another action`)
    }

    const newAlias: ReasonAlias = {
      id: `${actionId}-${Date.now()}`,
      name: aliasName.trim(),
      reason: reason.trim(),
      enabled: true,
      usageCount: 0,
      category: 'custom'
    }

    action.reasonAliases.push(newAlias)
  }

  function removeReasonAlias(actionId: string, aliasId: string) {
    const action = actions.value.find(a => a.id === actionId)
    if (!action) return

    const index = action.reasonAliases.findIndex(a => a.id === aliasId)
    if (index > -1) {
      action.reasonAliases.splice(index, 1)
    }
  }

  function updateReasonAlias(actionId: string, aliasId: string, updates: Partial<ReasonAlias>) {
    const action = actions.value.find(a => a.id === actionId)
    if (!action) return

    const alias = action.reasonAliases.find(a => a.id === aliasId)
    if (!alias) return

    // Check for conflicts if name is being updated
    if (updates.name && updates.name !== alias.name) {
      if (hasReasonAliasConflict(updates.name, actionId)) {
        throw new Error(`Reason alias "${updates.name}" already exists for another action`)
      }
    }

    Object.assign(alias, updates)
  }

  function toggleAction(actionId: string) {
    const action = actions.value.find(a => a.id === actionId)
    if (action) {
      action.enabled = !action.enabled
    }
  }

  function toggleReasonAlias(actionId: string, aliasId: string) {
    const action = actions.value.find(a => a.id === actionId)
    if (!action) return

    const alias = action.reasonAliases.find(a => a.id === aliasId)
    if (alias) {
      alias.enabled = !alias.enabled
    }
  }

  function hasReasonAliasConflict(aliasName: string, excludeActionId?: string): boolean {
    return actions.value.some(action => {
      if (excludeActionId && action.id === excludeActionId) return false
      return action.reasonAliases.some(alias => 
        alias.name.toLowerCase() === aliasName.toLowerCase()
      )
    })
  }

  function exportReasonAliases() {
    const exportData = {
      version: '1.0',
      timestamp: new Date().toISOString(),
      actions: actions.value.map(action => ({
        id: action.id,
        enabled: action.enabled,
        reasonAliases: action.reasonAliases
      }))
    }
    return JSON.stringify(exportData, null, 2)
  }

  function importReasonAliases(data: string) {
    try {
      const importData = JSON.parse(data)
      
      importData.actions.forEach((importAction: any) => {
        const action = actions.value.find(a => a.id === importAction.id)
        if (action) {
          action.enabled = importAction.enabled
          action.reasonAliases = importAction.reasonAliases
        }
      })
    } catch (error) {
      throw new Error('Invalid import data format')
    }
  }

  return {
    actions,
    searchQuery,
    selectedCategory,
    filteredActions,
    categories,
    getAllReasonAliases,
    addReasonAlias,
    removeReasonAlias,
    updateReasonAlias,
    toggleAction,
    toggleReasonAlias,
    hasReasonAliasConflict,
    exportReasonAliases,
    importReasonAliases
  }
})
