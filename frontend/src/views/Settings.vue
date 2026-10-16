<template>
  <div>
    <h1 class="text-3xl font-bold text-foreground mb-8">Settings</h1>

    <div class="space-y-8 max-w-4xl">
      <div class="bg-card border border-border rounded-xl">
        <div class="p-6 border-b border-border">
          <h2 class="text-xl font-semibold text-card-foreground">General Settings</h2>
          <p class="text-muted-foreground mt-1">Configure basic settings for your server.</p>
        </div>
        <div class="p-6 space-y-6">
          <p v-if="loading" class="text-muted-foreground">Loading settings…</p>
          <div>
            <label for="language" class="block text-sm font-medium text-muted-foreground mb-2">Language</label>
            <select id="language" v-model="language" class="w-full bg-input border border-input rounded-lg px-4 py-2 text-foreground">
              <option value="en">English</option>
              <option value="es">Español</option>
              <option value="fr">Français</option>
              <option value="de">Deutsch</option>
            </select>
          </div>
        </div>
        <div class="p-6 bg-secondary/50 border-t border-border rounded-b-xl flex justify-end">
          <button @click="saveGeneralSettings" class="bg-primary hover:bg-primary/90 text-primary-foreground font-semibold px-4 py-2 rounded-lg">Save Changes</button>
        </div>
      </div>

      <div class="bg-card border border-border rounded-xl">
        <div class="p-6 border-b border-border">
          <h2 class="text-xl font-semibold text-card-foreground">Welcome & Goodbye</h2>
          <p class="text-muted-foreground mt-1">Configure messages for new and leaving members.</p>
        </div>
        <div class="p-6 space-y-6">
          <div class="flex items-start justify-between">
            <div>
              <label for="welcomeEnabled" class="font-medium text-foreground">Enable Welcome Messages</label>
            </div>
            <input type="checkbox" id="welcomeEnabled" v-model="welcomeEnabled" class="h-4 w-4">
          </div>
          <div>
            <label class="block text-sm font-medium text-muted-foreground mb-2">Welcome Channel ID</label>
            <input v-model="welcomeChannelId" class="w-full bg-input border border-input rounded-lg px-4 py-2 text-foreground" placeholder="Channel ID">
          </div>
          <div class="flex items-start justify-between">
            <div>
              <label for="goodbyeEnabled" class="font-medium text-foreground">Enable Goodbye Messages</label>
            </div>
            <input type="checkbox" id="goodbyeEnabled" v-model="goodbyeEnabled" class="h-4 w-4">
          </div>
          <div>
            <label class="block text-sm font-medium text-muted-foreground mb-2">Goodbye Channel ID</label>
            <input v-model="goodbyeChannelId" class="w-full bg-input border border-input rounded-lg px-4 py-2 text-foreground" placeholder="Channel ID">
          </div>
        </div>
        <div class="p-6 bg-secondary/50 border-t border-border rounded-b-xl flex justify-end">
          <button @click="saveGeneralSettings" class="bg-primary hover:bg-primary/90 text-primary-foreground font-semibold px-4 py-2 rounded-lg">Save Changes</button>
        </div>
      </div>

      <div class="bg-card border border-destructive/50 rounded-xl">
        <div class="p-6 border-b border-destructive/50">
          <h2 class="text-xl font-semibold text-destructive">Danger Zone</h2>
        </div>
        <div class="p-6 space-y-4">
          <div class="flex items-center justify-between">
            <div>
              <p class="font-medium text-foreground">Reset all settings</p>
              <p class="text-sm text-muted-foreground">Reset bot settings on this server to defaults.</p>
            </div>
            <button @click="resetAllSettings" class="bg-destructive hover:bg-destructive/90 text-destructive-foreground font-semibold px-4 py-2 rounded-lg">Reset Settings</button>
          </div>
          <div class="flex items-center justify-between pt-4 border-t border-border">
            <div>
              <p class="font-medium text-foreground">Leave Server</p>
              <p class="text-sm text-muted-foreground">The bot will leave this server.</p>
            </div>
            <button @click="leaveServer" class="bg-destructive hover:bg-destructive/90 text-destructive-foreground font-semibold px-4 py-2 rounded-lg">Leave Server</button>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { onMounted, ref } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { useToastStore } from '@/stores/toast';
import { guildsApi } from '@/lib/endpoints';

const { addToast } = useToastStore();
const route = useRoute();
const router = useRouter();
const guildId = () => route.params.guildId as string;

const loading = ref(false);
const language = ref('en');
const welcomeEnabled = ref(false);
const welcomeChannelId = ref('');
const goodbyeEnabled = ref(false);
const goodbyeChannelId = ref('');

async function loadSettings() {
  loading.value = true;
  try {
    const settings = (await guildsApi.getGuildSettings(guildId())) as {
      config?: {
        preferredLanguage?: string;
        welcomeEnabled?: boolean;
        welcomeChannelId?: string | null;
        goodbyeEnabled?: boolean;
        goodbyeChannelId?: string | null;
      };
    };
    const config = settings.config ?? {};
    language.value = config.preferredLanguage || 'en';
    welcomeEnabled.value = Boolean(config.welcomeEnabled);
    welcomeChannelId.value = config.welcomeChannelId || '';
    goodbyeEnabled.value = Boolean(config.goodbyeEnabled);
    goodbyeChannelId.value = config.goodbyeChannelId || '';
  } catch {
    addToast('Failed to load settings', 'error');
  } finally {
    loading.value = false;
  }
}

async function saveGeneralSettings() {
  try {
    await guildsApi.updateGuildSettings(guildId(), {
      config: {
        preferredLanguage: language.value,
        welcomeEnabled: welcomeEnabled.value,
        welcomeChannelId: welcomeChannelId.value || null,
        goodbyeEnabled: goodbyeEnabled.value,
        goodbyeChannelId: goodbyeChannelId.value || null,
      },
    });
    addToast('Settings saved', 'success');
  } catch {
    addToast('Failed to save settings', 'error');
  }
}

async function resetAllSettings() {
  if (!confirm('Reset ALL settings for this server?')) return;
  try {
    await guildsApi.updateGuildSettings(guildId(), {
      config: {
        preferredLanguage: 'en',
        welcomeEnabled: false,
        welcomeChannelId: null,
        goodbyeEnabled: false,
        goodbyeChannelId: null,
      },
    });
    await loadSettings();
    addToast('Settings reset', 'success');
  } catch {
    addToast('Failed to reset settings', 'error');
  }
}

async function leaveServer() {
  if (!confirm('Make the bot leave this server?')) return;
  try {
    await guildsApi.leaveGuild(guildId());
    addToast('Leave command sent to the bot', 'success');
    router.push('/');
  } catch {
    addToast('Failed to leave server', 'error');
  }
}

onMounted(loadSettings);
</script>
