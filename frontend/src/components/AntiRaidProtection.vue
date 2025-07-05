<template>
  <div class="space-y-6">
    <div class="flex justify-between items-center">
      <h2 class="text-xl font-semibold text-foreground">Anti-Raid Protection</h2>
      <div class="flex items-center gap-2">
        <span :class="getProtectionStatusColor(protectionStatus)" class="px-3 py-1 rounded-full text-xs font-medium">
          {{ protectionStatus }}
        </span>
        <button @click="toggleProtection" class="bg-primary hover:bg-primary/90 text-primary-foreground px-4 py-2 rounded-lg transition-colors">
          {{ protectionEnabled ? 'Disable' : 'Enable' }} Protection
        </button>
      </div>
    </div>

    <!-- Protection Settings -->
    <div class="bg-card border border-border rounded-lg p-6">
      <h3 class="font-semibold text-foreground mb-4">Protection Settings</h3>
      
      <div class="space-y-6">
        <!-- Join Rate Limit -->
        <div>
          <div class="flex items-center justify-between mb-2">
            <label class="font-medium text-foreground">Join Rate Limiting</label>
            <label class="relative inline-flex items-center cursor-pointer">
              <input type="checkbox" v-model="settings.joinRateLimit.enabled" class="sr-only peer">
              <div class="w-11 h-6 bg-muted rounded-full peer peer-checked:after:translate-x-full after:content-[''] after:absolute after:top-0.5 after:left-[2px] after:bg-white after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-primary"></div>
            </label>
          </div>
          
          <div v-if="settings.joinRateLimit.enabled" class="grid grid-cols-1 md:grid-cols-2 gap-4 pl-6 border-l-2 border-primary">
            <div>
              <label class="block text-sm font-medium text-foreground mb-2">Max Joins</label>
              <input v-model.number="settings.joinRateLimit.maxJoins" type="number" min="1" class="w-full bg-background border border-border rounded-lg px-3 py-2 text-foreground">
              <p class="text-xs text-muted-foreground mt-1">Maximum number of joins allowed</p>
            </div>
            
            <div>
              <label class="block text-sm font-medium text-foreground mb-2">Time Window (seconds)</label>
              <input v-model.number="settings.joinRateLimit.timeWindow" type="number" min="1" class="w-full bg-background border border-border rounded-lg px-3 py-2 text-foreground">
              <p class="text-xs text-muted-foreground mt-1">Time period to measure joins</p>
            </div>
            
            <div class="md:col-span-2">
              <label class="block text-sm font-medium text-foreground mb-2">Action</label>
              <select v-model="settings.joinRateLimit.action" class="w-full bg-background border border-border rounded-lg px-3 py-2 text-foreground">
                <option value="verification">Enable Verification Mode</option>
                <option value="lockdown">Server Lockdown</option>
                <option value="alert">Alert Staff Only</option>
              </select>
            </div>
          </div>
        </div>
        
        <!-- Account Age Verification -->
        <div>
          <div class="flex items-center justify-between mb-2">
            <label class="font-medium text-foreground">Account Age Verification</label>
            <label class="relative inline-flex items-center cursor-pointer">
              <input type="checkbox" v-model="settings.accountAgeCheck.enabled" class="sr-only peer">
              <div class="w-11 h-6 bg-muted rounded-full peer peer-checked:after:translate-x-full after:content-[''] after:absolute after:top-0.5 after:left-[2px] after:bg-white after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-primary"></div>
            </label>
          </div>
          
          <div v-if="settings.accountAgeCheck.enabled" class="grid grid-cols-1 md:grid-cols-2 gap-4 pl-6 border-l-2 border-primary">
            <div>
              <label class="block text-sm font-medium text-foreground mb-2">Minimum Account Age (days)</label>
              <input v-model.number="settings.accountAgeCheck.minAge" type="number" min="0" class="w-full bg-background border border-border rounded-lg px-3 py-2 text-foreground">
            </div>
            
            <div>
              <label class="block text-sm font-medium text-foreground mb-2">Action</label>
              <select v-model="settings.accountAgeCheck.action" class="w-full bg-background border border-border rounded-lg px-3 py-2 text-foreground">
                <option value="kick">Kick User</option>
                <option value="quarantine">Quarantine User</option>
                <option value="alert">Alert Staff Only</option>
              </select>
            </div>
          </div>
        </div>
        
        <!-- Avatar Verification -->
        <div>
          <div class="flex items-center justify-between mb-2">
            <label class="font-medium text-foreground">Avatar Verification</label>
            <label class="relative inline-flex items-center cursor-pointer">
              <input type="checkbox" v-model="settings.avatarCheck.enabled" class="sr-only peer">
              <div class="w-11 h-6 bg-muted rounded-full peer peer-checked:after:translate-x-full after:content-[''] after:absolute after:top-0.5 after:left-[2px] after:bg-white after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-primary"></div>
            </label>
          </div>
          
          <div v-if="settings.avatarCheck.enabled" class="pl-6 border-l-2 border-primary">
            <p class="text-sm text-muted-foreground mb-2">Require users to have a custom avatar (not the default Discord avatar)</p>
            
            <div>
              <label class="block text-sm font-medium text-foreground mb-2">Action</label>
              <select v-model="settings.avatarCheck.action" class="w-full bg-background border border-border rounded-lg px-3 py-2 text-foreground">
                <option value="kick">Kick User</option>
                <option value="quarantine">Quarantine User</option>
                <option value="alert">Alert Staff Only</option>
              </select>
            </div>
          </div>
        </div>
        
        <!-- Verification Mode -->
        <div>
          <div class="flex items-center justify-between mb-2">
            <label class="font-medium text-foreground">Verification Mode</label>
            <label class="relative inline-flex items-center cursor-pointer">
              <input type="checkbox" v-model="settings.verificationMode.enabled" class="sr-only peer">
              <div class="w-11 h-6 bg-muted rounded-full peer peer-checked:after:translate-x-full after:content-[''] after:absolute after:top-0.5 after:left-[2px] after:bg-white after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-primary"></div>
            </label>
          </div>
          
          <div v-if="settings.verificationMode.enabled" class="grid grid-cols-1 md:grid-cols-2 gap-4 pl-6 border-l-2 border-primary">
            <div>
              <label class="block text-sm font-medium text-foreground mb-2">Verification Type</label>
              <select v-model="settings.verificationMode.type" class="w-full bg-background border border-border rounded-lg px-3 py-2 text-foreground">
                <option value="captcha">CAPTCHA</option>
                <option value="reaction">Reaction</option>
                <option value="command">Command</option>
              </select>
            </div>
            
            <div>
              <label class="block text-sm font-medium text-foreground mb-2">Verification Channel</label>
              <select v-model="settings.verificationMode.channelId" class="w-full bg-background border border-border rounded-lg px-3 py-2 text-foreground">
                <option value="">Select a channel</option>
                <option v-for="channel in channels" :key="channel.id" :value="channel.id">
                  #{{ channel.name }}
                </option>
              </select>
            </div>
            
            <div class="md:col-span-2">
              <label class="block text-sm font-medium text-foreground mb-2">Verification Role</label>
              <select v-model="settings.verificationMode.roleId" class="w-full bg-background border border-border rounded-lg px-3 py-2 text-foreground">
                <option value="">Select a role</option>
                <option v-for="role in roles" :key="role.id" :value="role.id">
                  {{ role.name }}
                </option>
              </select>
              <p class="text-xs text-muted-foreground mt-1">Role to assign after verification</p>
            </div>
          </div>
        </div>
        
        <!-- Auto-Lockdown -->
        <div>
          <div class="flex items-center justify-between mb-2">
            <label class="font-medium text-foreground">Auto-Lockdown</label>
            <label class="relative inline-flex items-center cursor-pointer">
              <input type="checkbox" v-model="settings.autoLockdown.enabled" class="sr-only peer">
              <div class="w-11 h-6 bg-muted rounded-full peer peer-checked:after:translate-x-full after:content-[''] after:absolute after:top-0.5 after:left-[2px] after:bg-white after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-primary"></div>
            </label>
          </div>
          
          <div v-if="settings.autoLockdown.enabled" class="grid grid-cols-1 md:grid-cols-2 gap-4 pl-6 border-l-2 border-primary">
            <div>
              <label class="block text-sm font-medium text-foreground mb-2">Lockdown Duration (minutes)</label>
              <input v-model.number="settings.autoLockdown.duration" type="number" min="1" class="w-full bg-background border border-border rounded-lg px-3 py-2 text-foreground">
              <p class="text-xs text-muted-foreground mt-1">0 for manual unlock only</p>
            </div>
            
            <div>
              <label class="block text-sm font-medium text-foreground mb-2">Alert Channel</label>
              <select v-model="settings.autoLockdown.alertChannelId" class="w-full bg-background border border-border rounded-lg px-3 py-2 text-foreground">
                <option value="">Select a channel</option>
                <option v-for="channel in channels" :key="channel.id" :value="channel.id">
                  #{{ channel.name }}
                </option>
              </select>
            </div>
          </div>
        </div>
      </div>
      
      <div class="flex justify-end mt-6">
        <button @click="saveSettings" class="px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90">
          Save Settings
        </button>
      </div>
    </div>

    <!-- Raid Log -->
    <div class="bg-card border border-border rounded-lg p-6">
      <h3 class="font-semibold text-foreground mb-4">Raid Log</h3>
      
      <div v-if="raidLog.length === 0" class="text-center py-8">
        <p class="text-muted-foreground">No raid attempts detected</p>
      </div>
      
      <div v-else class="space-y-4">
        <div v-for="raid in raidLog" :key="raid.id" class="bg-secondary/50 rounded-lg p-4">
          <div class="flex items-start justify-between">
            <div>
              <h4 class="font-medium text-foreground">{{ raid.type }} Detected</h4>
              <p class="text-sm text-muted-foreground">{{ formatDate(raid.timestamp) }}</p>
            </div>
            <span :class="getRaidSeverityColor(raid.severity)" class="px-3 py-1 rounded-full text-xs font-medium">
              {{ raid.severity }}
            </span>
          </div>
          
          <div class="mt-3 text-sm text-foreground">
            <p>{{ raid.description }}</p>
            <div class="mt-2 grid grid-cols-2 md:grid-cols-4 gap-2 text-muted-foreground">
              <div>
                <span class="font-medium">Accounts:</span>
                <span class="ml-1">{{ raid.accounts }}</span>
              </div>
              <div>
                <span class="font-medium">Action Taken:</span>
                <span class="ml-1">{{ raid.action }}</span>
              </div>
              <div>
                <span class="font-medium">Duration:</span>
                <span class="ml-1">{{ raid.duration }}</span>
              </div>
              <div>
                <span class="font-medium">Handled By:</span>
                <span class="ml-1">{{ raid.handledBy }}</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- Manual Lockdown -->
    <div class="bg-card border border-border rounded-lg p-6">
      <h3 class="font-semibold text-foreground mb-4">Manual Controls</h3>
      
      <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div class="bg-secondary/50 rounded-lg p-4">
          <h4 class="font-medium text-foreground mb-2">Server Lockdown</h4>
          <p class="text-sm text-muted-foreground mb-4">Prevent new users from joining and restrict messaging for non-staff members.</p>
          
          <div class="flex items-center gap-4">
            <button @click="toggleLockdown" :class="[
              'px-4 py-2 rounded-lg text-sm font-medium transition-colors',
              serverLocked ? 'bg-destructive text-destructive-foreground' : 'bg-primary text-primary-foreground'
            ]">
              {{ serverLocked ? 'Unlock Server' : 'Lock Server' }}
            </button>
            
            <div v-if="serverLocked" class="text-sm text-muted-foreground">
              <span>Locked {{ formatTimeAgo(lockdownStartTime) }}</span>
            </div>
          </div>
        </div>
        
        <div class="bg-secondary/50 rounded-lg p-4">
          <h4 class="font-medium text-foreground mb-2">Verification Mode</h4>
          <p class="text-sm text-muted-foreground mb-4">Require all new members to verify before accessing the server.</p>
          
          <div class="flex items-center gap-4">
            <button @click="toggleVerification" :class="[
              'px-4 py-2 rounded-lg text-sm font-medium transition-colors',
              verificationActive ? 'bg-destructive text-destructive-foreground' : 'bg-primary text-primary-foreground'
            ]">
              {{ verificationActive ? 'Disable Verification' : 'Enable Verification' }}
            </button>
            
            <div v-if="verificationActive" class="text-sm text-muted-foreground">
              <span>Active {{ formatTimeAgo(verificationStartTime) }}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, computed, onMounted, nextTick } from 'vue'
import { useToastStore } from '@/stores/toast'

const toastStore = useToastStore()

// Protection status
const protectionEnabled = ref(true)
const protectionStatus = computed(() => {
  if (!protectionEnabled.value) return 'Disabled'
  if (serverLocked.value) return 'Lockdown'
  if (verificationActive.value) return 'Verification Mode'
  return 'Active'
})

// Server status
const serverLocked = ref(false)
const lockdownStartTime = ref(new Date())
const verificationActive = ref(false)
const verificationStartTime = ref(new Date())

// Settings
const settings = reactive({
  joinRateLimit: {
    enabled: true,
    maxJoins: 10,
    timeWindow: 60,
    action: 'verification'
  },
  accountAgeCheck: {
    enabled: true,
    minAge: 7,
    action: 'quarantine'
  },
  avatarCheck: {
    enabled: false,
    action: 'alert'
  },
  verificationMode: {
    enabled: true,
    type: 'captcha',
    channelId: 'verification',
    roleId: 'verified'
  },
  autoLockdown: {
    enabled: true,
    duration: 30,
    alertChannelId: 'mod-alerts'
  }
})

// Channels and roles
const channels = ref([
  { id: 'general', name: 'general' },
  { id: 'verification', name: 'verification' },
  { id: 'mod-alerts', name: 'mod-alerts' },
  { id: 'staff-chat', name: 'staff-chat' }
])

const roles = ref([
  { id: 'verified', name: 'Verified' },
  { id: 'member', name: 'Member' },
  { id: 'moderator', name: 'Moderator' },
  { id: 'admin', name: 'Admin' }
])

// Raid log
const raidLog = ref([
  {
    id: '1',
    type: 'Mass Join',
    description: '15 accounts joined within 30 seconds, all with similar usernames and creation dates.',
    severity: 'High',
    timestamp: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000),
    accounts: 15,
    action: 'Server Lockdown',
    duration: '30 minutes',
    handledBy: 'Auto-Protection'
  },
  {
    id: '2',
    type: 'New Account Spam',
    description: '5 accounts less than 1 day old attempted to join.',
    severity: 'Medium',
    timestamp: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000),
    accounts: 5,
    action: 'Quarantined',
    duration: 'N/A',
    handledBy: 'Auto-Protection'
  }
])

const getProtectionStatusColor = (status: string) => {
  switch (status) {
    case 'Active': return 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300'
    case 'Verification Mode': return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-300'
    case 'Lockdown': return 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-300'
    case 'Disabled': return 'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-300'
    default: return 'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-300'
  }
}

const getRaidSeverityColor = (severity: string) => {
  switch (severity) {
    case 'Critical': return 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-300'
    case 'High': return 'bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-300'
    case 'Medium': return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-300'
    case 'Low': return 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300'
    default: return 'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-300'
  }
}

const formatDate = (date: Date) => {
  return date.toLocaleString()
}

const formatTimeAgo = (date: Date) => {
  const now = new Date()
  const diff = now.getTime() - date.getTime()
  const minutes = Math.floor(diff / 60000)
  
  if (minutes < 1) return 'just now'
  if (minutes < 60) return `${minutes}m ago`
  if (minutes < 1440) return `${Math.floor(minutes / 60)}h ago`
  return `${Math.floor(minutes / 1440)}d ago`
}

const toggleProtection = () => {
  protectionEnabled.value = !protectionEnabled.value
  toastStore.addToast(`Anti-raid protection ${protectionEnabled.value ? 'enabled' : 'disabled'}`, 'success')
}

const toggleLockdown = () => {
  serverLocked.value = !serverLocked.value
  if (serverLocked.value) {
    lockdownStartTime.value = new Date()
    toastStore.addToast('Server lockdown enabled', 'success')
  } else {
    toastStore.addToast('Server lockdown disabled', 'success')
  }
}

const toggleVerification = () => {
  verificationActive.value = !verificationActive.value
  if (verificationActive.value) {
    verificationStartTime.value = new Date()
    toastStore.addToast('Verification mode enabled', 'success')
  } else {
    toastStore.addToast('Verification mode disabled', 'success')
  }
}

const saveSettings = () => {
  toastStore.addToast('Anti-raid settings saved successfully!', 'success')
}
</script>