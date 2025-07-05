
<template>
  <div>
    <h1 class="text-3xl font-bold text-foreground mb-8">Settings</h1>

    <div class="space-y-8 max-w-4xl">
      <!-- General Settings -->
      <div class="bg-card border border-border rounded-xl">
        <div class="p-6 border-b border-border">
          <h2 class="text-xl font-semibold text-card-foreground">General Settings</h2>
          <p class="text-muted-foreground mt-1">Configure basic settings for your server.</p>
        </div>
        <div class="p-6 space-y-6">
          <div>
            <label for="language" class="block text-sm font-medium text-muted-foreground mb-2">Language</label>
            <select id="language" v-model="language" class="w-full bg-input border border-input rounded-lg px-4 py-2 text-foreground focus:ring-ring focus:border-ring">
              <option value="en">English</option>
              <option value="es">Español</option>
              <option value="fr">Français</option>
              <option value="de">Deutsch</option>
            </select>
          </div>
        </div>
        <div class="p-6 bg-secondary/50 border-t border-border rounded-b-xl flex justify-end">
          <button @click="saveGeneralSettings" class="bg-primary hover:bg-primary/90 text-primary-foreground font-semibold px-4 py-2 rounded-lg transition-colors">Save Changes</button>
        </div>
      </div>

      <!-- Welcome & Goodbye Messages -->
      <div class="bg-card border border-border rounded-xl">
        <div class="p-6 border-b border-border">
          <h2 class="text-xl font-semibold text-card-foreground">Welcome & Goodbye</h2>
          <p class="text-muted-foreground mt-1">Configure messages for new and leaving members.</p>
        </div>
        <div class="p-6 space-y-6">
          <!-- Welcome Messages -->
          <div class="flex items-start justify-between">
            <div>
              <label for="welcomeEnabled" class="font-medium text-foreground">Enable Welcome Messages</label>
              <p class="text-sm text-muted-foreground mt-1">Post a message when a new member joins.</p>
            </div>
            <label class="relative inline-flex items-center cursor-pointer">
              <input type="checkbox" id="welcomeEnabled" v-model="welcomeEnabled" class="sr-only peer">
              <div class="w-11 h-6 bg-input rounded-full peer peer-checked:after:translate-x-full after:content-[''] after:absolute after:top-0.5 after:left-[2px] after:bg-white dark:after:bg-slate-800 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-primary"></div>
            </label>
          </div>
          <div :class="{ 'opacity-50 pointer-events-none': !welcomeEnabled }">
            <label for="welcomeChannel" class="block text-sm font-medium text-muted-foreground mb-2">Welcome Channel</label>
            <input type="text" id="welcomeChannel" v-model="welcomeChannelId" :disabled="!welcomeEnabled" class="w-full bg-input border border-input rounded-lg px-4 py-2 text-foreground focus:ring-ring focus:border-ring" placeholder="Enter Channel ID or select channel">
            <p class="mt-2 text-xs text-muted-foreground/80">This will be replaced with a channel selector.</p>
          </div>
          
          <div class="border-t border-border !my-6"></div>

          <!-- Goodbye Messages -->
          <div class="flex items-start justify-between">
            <div>
              <label for="goodbyeEnabled" class="font-medium text-foreground">Enable Goodbye Messages</label>
              <p class="text-sm text-muted-foreground mt-1">Post a message when a member leaves.</p>
            </div>
            <label class="relative inline-flex items-center cursor-pointer">
              <input type="checkbox" id="goodbyeEnabled" v-model="goodbyeEnabled" class="sr-only peer">
              <div class="w-11 h-6 bg-input rounded-full peer peer-checked:after:translate-x-full after:content-[''] after:absolute after:top-0.5 after:left-[2px] after:bg-white dark:after:bg-slate-800 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-primary"></div>
            </label>
          </div>
          <div :class="{ 'opacity-50 pointer-events-none': !goodbyeEnabled }">
            <label for="goodbyeChannel" class="block text-sm font-medium text-muted-foreground mb-2">Goodbye Channel</label>
            <input type="text" id="goodbyeChannel" v-model="goodbyeChannelId" :disabled="!goodbyeEnabled" class="w-full bg-input border border-input rounded-lg px-4 py-2 text-foreground focus:ring-ring focus:border-ring" placeholder="Enter Channel ID or select channel">
            <p class="mt-2 text-xs text-muted-foreground/80">This will be replaced with a channel selector.</p>
          </div>
        </div>
        <div class="p-6 bg-secondary/50 border-t border-border rounded-b-xl flex justify-end">
          <button @click="saveGeneralSettings" class="bg-primary hover:bg-primary/90 text-primary-foreground font-semibold px-4 py-2 rounded-lg transition-colors">Save Changes</button>
        </div>
      </div>


      <!-- Danger Zone -->
      <div class="bg-card border border-destructive/50 rounded-xl">
        <div class="p-6 border-b border-destructive/50">
          <h2 class="text-xl font-semibold text-destructive">Danger Zone</h2>
          <p class="text-muted-foreground mt-1">These actions are irreversible. Please be certain.</p>
        </div>
        <div class="p-6 space-y-4">
          <div class="flex items-center justify-between">
            <div>
              <p class="font-medium text-foreground">Reset all settings</p>
              <p class="text-sm text-muted-foreground">This will reset all bot settings on this server to their defaults.</p>
            </div>
            <button class="bg-destructive hover:bg-destructive/90 text-destructive-foreground font-semibold px-4 py-2 rounded-lg transition-colors">Reset Settings</button>
          </div>
           <div class="flex items-center justify-between pt-4 border-t border-border">
            <div>
              <p class="font-medium text-foreground">Leave Server</p>
              <p class="text-sm text-muted-foreground">The bot will leave your server. You will have to re-invite it to use it again.</p>
            </div>
            <button class="bg-destructive hover:bg-destructive/90 text-destructive-foreground font-semibold px-4 py-2 rounded-lg transition-colors">Leave Server</button>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { useToastStore } from '@/stores/toast'

const { addToast } = useToastStore()

const language = ref('en');
const welcomeEnabled = ref(true);
const welcomeChannelId = ref('');
const goodbyeEnabled = ref(true);
const goodbyeChannelId = ref('');

const saveGeneralSettings = () => {
  // Save general settings
  addToast('General settings saved successfully!', 'success')
}

const saveWelcomeSettings = () => {
  // Save welcome/goodbye settings
  addToast('Welcome & goodbye settings saved successfully!', 'success')
}

const resetAllSettings = () => {
  if (confirm('Are you sure you want to reset ALL settings? This action cannot be undone.')) {
    // Reset all settings to defaults
    language.value = 'en'
    welcomeEnabled.value = false
    welcomeChannelId.value = ''
    goodbyeEnabled.value = false
    goodbyeChannelId.value = ''
    
    addToast('All settings have been reset to defaults!', 'success')
  }
}

const leaveServer = () => {
  if (confirm('Are you sure you want the bot to leave this server? You will need to re-invite it to use it again.')) {
    addToast('Bot will leave the server...', 'info')
    // In a real app, this would trigger the bot to leave
  }
}
</script>
