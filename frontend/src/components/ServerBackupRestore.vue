<template>
  <div class="space-y-6">
    <div class="flex justify-between items-center">
      <h2 class="text-xl font-semibold text-foreground">Server Backup & Restore</h2>
      <button @click="createBackup" class="bg-primary hover:bg-primary/90 text-primary-foreground px-4 py-2 rounded-lg transition-colors">
        Create Backup
      </button>
    </div>

    <!-- Backup Info -->
    <div class="bg-card border border-border rounded-lg p-6">
      <div class="flex items-center justify-between mb-4">
        <h3 class="font-semibold text-foreground">Backup Information</h3>
        <div class="flex items-center gap-2">
          <button @click="toggleAutomaticBackups" class="text-sm text-primary hover:text-primary/80">
            {{ automaticBackupsEnabled ? 'Disable' : 'Enable' }} Automatic Backups
          </button>
        </div>
      </div>
      
      <div class="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
        <div>
          <span class="text-muted-foreground">Last Backup:</span>
          <span class="ml-2 text-foreground">{{ lastBackup ? formatDate(lastBackup) : 'Never' }}</span>
        </div>
        <div>
          <span class="text-muted-foreground">Automatic Backups:</span>
          <span class="ml-2 text-foreground">{{ automaticBackupsEnabled ? 'Enabled' : 'Disabled' }}</span>
        </div>
        <div>
          <span class="text-muted-foreground">Backup Frequency:</span>
          <span class="ml-2 text-foreground">{{ backupFrequency }}</span>
        </div>
        <div>
          <span class="text-muted-foreground">Retention Policy:</span>
          <span class="ml-2 text-foreground">{{ retentionPolicy }}</span>
        </div>
      </div>
      
      <div v-if="automaticBackupsEnabled" class="mt-4 pt-4 border-t border-border">
        <h4 class="font-medium text-foreground mb-2">Automatic Backup Settings</h4>
        <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label class="block text-sm font-medium text-foreground mb-2">Frequency</label>
            <select v-model="backupFrequency" class="w-full bg-background border border-border rounded-lg px-3 py-2 text-foreground">
              <option value="Daily">Daily</option>
              <option value="Weekly">Weekly</option>
              <option value="Monthly">Monthly</option>
            </select>
          </div>
          <div>
            <label class="block text-sm font-medium text-foreground mb-2">Retention Policy</label>
            <select v-model="retentionPolicy" class="w-full bg-background border border-border rounded-lg px-3 py-2 text-foreground">
              <option value="Keep last 3 backups">Keep last 3 backups</option>
              <option value="Keep last 5 backups">Keep last 5 backups</option>
              <option value="Keep all backups">Keep all backups</option>
            </select>
          </div>
        </div>
      </div>
    </div>

    <!-- Backup List -->
    <div class="bg-card border border-border rounded-lg p-6">
      <h3 class="font-semibold text-foreground mb-4">Available Backups</h3>
      
      <div v-if="backups.length === 0" class="text-center py-8">
        <div class="text-muted-foreground">
          <svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="mx-auto mb-4 opacity-50">
            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
            <polyline points="17 8 12 3 7 8"/>
            <line x1="12" y1="3" x2="12" y2="15"/>
          </svg>
          <p class="text-lg font-medium">No backups available</p>
          <p class="text-sm">Create your first backup to protect your server configuration</p>
        </div>
      </div>
      
      <div v-else class="space-y-4">
        <div v-for="backup in backups" :key="backup.id" class="bg-secondary/50 rounded-lg p-4">
          <div class="flex items-start justify-between">
            <div>
              <h4 class="font-medium text-foreground">{{ backup.name }}</h4>
              <p class="text-sm text-muted-foreground">Created: {{ formatDate(backup.createdAt) }}</p>
              <div class="flex items-center gap-4 mt-2 text-sm">
                <div>
                  <span class="text-muted-foreground">Size:</span>
                  <span class="ml-1 text-foreground">{{ formatSize(backup.size) }}</span>
                </div>
                <div>
                  <span class="text-muted-foreground">Type:</span>
                  <span class="ml-1 text-foreground">{{ backup.type }}</span>
                </div>
              </div>
            </div>
            
            <div class="flex items-center gap-2">
              <button @click="restoreBackup(backup)" class="px-3 py-1 rounded-lg text-xs font-medium bg-primary text-primary-foreground hover:bg-primary/90 transition-colors">
                Restore
              </button>
              <button @click="downloadBackup(backup)" class="px-3 py-1 rounded-lg text-xs font-medium bg-secondary text-secondary-foreground hover:bg-secondary/80 transition-colors">
                Download
              </button>
              <button @click="deleteBackup(backup.id)" class="text-destructive hover:text-destructive/80">
                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                  <path d="M3 6h18"/>
                  <path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"/>
                  <path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"/>
                </svg>
              </button>
            </div>
          </div>
          
          <div class="mt-3 pt-3 border-t border-border">
            <div class="text-sm">
              <span class="text-muted-foreground">Includes:</span>
              <div class="flex flex-wrap gap-2 mt-1">
                <span v-for="item in backup.includes" :key="item" class="px-2 py-1 rounded-full text-xs bg-secondary text-secondary-foreground">
                  {{ item }}
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- Restore from File -->
    <div class="bg-card border border-border rounded-lg p-6">
      <h3 class="font-semibold text-foreground mb-4">Restore from File</h3>
      
      <div class="space-y-4">
        <div class="border-2 border-dashed border-border rounded-lg p-8 text-center">
          <svg xmlns="http://www.w3.org/2000/svg" width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="mx-auto mb-4 text-muted-foreground">
            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
            <polyline points="17 8 12 3 7 8"/>
            <line x1="12" y1="3" x2="12" y2="15"/>
          </svg>
          <p class="text-foreground font-medium mb-2">Drag and drop backup file here</p>
          <p class="text-sm text-muted-foreground mb-4">or</p>
          <label class="px-4 py-2 rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 transition-colors cursor-pointer">
            <span>Select File</span>
            <input type="file" class="hidden" @change="handleFileUpload">
          </label>
        </div>
        
        <div class="text-sm text-muted-foreground">
          <p>Supported file types: .json, .zip</p>
          <p>Maximum file size: 50MB</p>
        </div>
      </div>
    </div>

    <!-- Restore Confirmation Modal -->
    <div v-if="showRestoreModal" class="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div class="bg-card border border-border rounded-lg p-6 w-full max-w-md">
        <h3 class="text-lg font-semibold text-foreground mb-4">Confirm Restore</h3>
        
        <p class="text-muted-foreground mb-6">
          Are you sure you want to restore from the backup "{{ selectedBackup?.name }}"? This will overwrite your current server configuration.
        </p>
        
        <div class="space-y-4">
          <div class="flex items-center space-x-2">
            <input type="checkbox" v-model="restoreOptions.roles" id="restore-roles" class="rounded border-border text-primary focus:ring-primary">
            <label for="restore-roles" class="text-sm text-foreground">Restore roles</label>
          </div>
          
          <div class="flex items-center space-x-2">
            <input type="checkbox" v-model="restoreOptions.channels" id="restore-channels" class="rounded border-border text-primary focus:ring-primary">
            <label for="restore-channels" class="text-sm text-foreground">Restore channels</label>
          </div>
          
          <div class="flex items-center space-x-2">
            <input type="checkbox" v-model="restoreOptions.settings" id="restore-settings" class="rounded border-border text-primary focus:ring-primary">
            <label for="restore-settings" class="text-sm text-foreground">Restore bot settings</label>
          </div>
          
          <div class="flex items-center space-x-2">
            <input type="checkbox" v-model="restoreOptions.permissions" id="restore-permissions" class="rounded border-border text-primary focus:ring-primary">
            <label for="restore-permissions" class="text-sm text-foreground">Restore permissions</label>
          </div>
        </div>
        
        <div class="flex justify-end space-x-3 mt-6">
          <button @click="showRestoreModal = false" class="px-4 py-2 border border-border rounded-lg text-muted-foreground hover:text-foreground">
            Cancel
          </button>
          <button @click="confirmRestore" class="px-4 py-2 bg-destructive text-destructive-foreground rounded-lg hover:bg-destructive/90">
            Restore
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive } from 'vue'
import { useToastStore } from '@/stores/toast'

const toastStore = useToastStore()

interface Backup {
  id: string
  name: string
  createdAt: Date
  size: number
  type: 'Full' | 'Partial'
  includes: string[]
}

const backups = ref<Backup[]>([
  {
    id: '1',
    name: 'Weekly Backup - 2024-01-15',
    createdAt: new Date(2024, 0, 15),
    size: 1024 * 1024 * 2.5, // 2.5 MB
    type: 'Full',
    includes: ['Roles', 'Channels', 'Settings', 'Permissions', 'Commands']
  },
  {
    id: '2',
    name: 'Pre-Update Backup',
    createdAt: new Date(2024, 0, 10),
    size: 1024 * 1024 * 1.8, // 1.8 MB
    type: 'Partial',
    includes: ['Settings', 'Commands']
  }
])

const lastBackup = ref<Date | null>(new Date(2024, 0, 15))
const automaticBackupsEnabled = ref(true)
const backupFrequency = ref('Weekly')
const retentionPolicy = ref('Keep last 5 backups')

const showRestoreModal = ref(false)
const selectedBackup = ref<Backup | null>(null)
const restoreOptions = reactive({
  roles: true,
  channels: true,
  settings: true,
  permissions: true
})

const formatDate = (date: Date) => {
  return date.toLocaleString()
}

const formatSize = (bytes: number) => {
  if (bytes < 1024) return bytes + ' B'
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(2) + ' KB'
  if (bytes < 1024 * 1024 * 1024) return (bytes / (1024 * 1024)).toFixed(2) + ' MB'
  return (bytes / (1024 * 1024 * 1024)).toFixed(2) + ' GB'
}

const toggleAutomaticBackups = () => {
  automaticBackupsEnabled.value = !automaticBackupsEnabled.value
  toastStore.addToast(`Automatic backups ${automaticBackupsEnabled.value ? 'enabled' : 'disabled'}`, 'success')
}

const createBackup = () => {
  const backupName = prompt('Enter a name for this backup:', `Backup - ${new Date().toLocaleDateString()}`)
  if (backupName) {
    const newBackup: Backup = {
      id: Date.now().toString(),
      name: backupName,
      createdAt: new Date(),
      size: 1024 * 1024 * Math.random() * 3, // Random size between 0-3 MB
      type: 'Full',
      includes: ['Roles', 'Channels', 'Settings', 'Permissions', 'Commands']
    }
    backups.value.unshift(newBackup)
    lastBackup.value = new Date()
    toastStore.addToast('Backup created successfully!', 'success')
  }
}

const restoreBackup = (backup: Backup) => {
  selectedBackup.value = backup
  showRestoreModal.value = true
}

const confirmRestore = () => {
  if (!selectedBackup.value) return
  
  // Simulate restore process
  toastStore.addToast(`Restoring from backup "${selectedBackup.value.name}"...`, 'info')
  
  setTimeout(() => {
    toastStore.addToast('Backup restored successfully!', 'success')
    showRestoreModal.value = false
    selectedBackup.value = null
  }, 2000)
}

const downloadBackup = (backup: Backup) => {
  toastStore.addToast(`Downloading backup "${backup.name}"...`, 'info')
  
  // Simulate download
  setTimeout(() => {
    toastStore.addToast('Backup downloaded successfully!', 'success')
  }, 1500)
}

const deleteBackup = (backupId: string) => {
  if (confirm('Are you sure you want to delete this backup? This action cannot be undone.')) {
    const index = backups.value.findIndex(b => b.id === backupId)
    if (index !== -1) {
      const backup = backups.value[index]
      backups.value.splice(index, 1)
      toastStore.addToast(`Backup "${backup.name}" deleted`, 'success')
    }
  }
}

const handleFileUpload = (event: Event) => {
  const input = event.target as HTMLInputElement
  if (!input.files || input.files.length === 0) return
  
  const file = input.files[0]
  
  // Check file type
  if (!file.name.endsWith('.json') && !file.name.endsWith('.zip')) {
    toastStore.addToast('Invalid file type. Please upload a .json or .zip file.', 'error')
    return
  }
  
  // Check file size
  if (file.size > 50 * 1024 * 1024) { // 50MB
    toastStore.addToast('File is too large. Maximum size is 50MB.', 'error')
    return
  }
  
  // Simulate upload and restore
  toastStore.addToast(`Uploading backup file "${file.name}"...`, 'info')
  
  setTimeout(() => {
    toastStore.addToast('Backup file uploaded successfully!', 'success')
    
    // Show restore modal
    selectedBackup.value = {
      id: 'upload',
      name: file.name,
      createdAt: new Date(),
      size: file.size,
      type: 'Full',
      includes: ['Roles', 'Channels', 'Settings', 'Permissions', 'Commands']
    }
    showRestoreModal.value = true
  }, 1500)
}
</script>