<template>
  <div class="space-y-6">
    <div class="flex justify-between items-center">
      <h2 class="text-xl font-semibold text-foreground">Embed Builder</h2>
      <div class="flex items-center gap-2">
        <button @click="resetEmbed" class="px-3 py-2 rounded-lg text-sm font-medium bg-secondary text-secondary-foreground hover:bg-secondary/80 transition-colors">
          Reset
        </button>
        <button @click="saveEmbed" class="px-3 py-2 rounded-lg text-sm font-medium bg-primary text-primary-foreground hover:bg-primary/90 transition-colors">
          Save Template
        </button>
        <button @click="copyEmbedCode" class="px-3 py-2 rounded-lg text-sm font-medium bg-secondary text-secondary-foreground hover:bg-secondary/80 transition-colors">
          Copy Code
        </button>
      </div>
    </div>

    <div class="grid grid-cols-1 lg:grid-cols-2 gap-6">
      <!-- Embed Editor -->
      <div class="space-y-4">
        <div class="bg-card border border-border rounded-lg p-6">
          <h3 class="font-semibold text-foreground mb-4">Embed Settings</h3>
          
          <div class="space-y-4">
            <div>
              <label class="block text-sm font-medium text-foreground mb-2">Author</label>
              <input v-model="embed.author.name" type="text" class="w-full bg-background border border-border rounded-lg px-3 py-2 text-foreground" placeholder="Author name">
            </div>
            
            <div>
              <label class="block text-sm font-medium text-foreground mb-2">Author Icon URL</label>
              <input v-model="embed.author.iconUrl" type="url" class="w-full bg-background border border-border rounded-lg px-3 py-2 text-foreground" placeholder="https://example.com/icon.png">
            </div>
            
            <div>
              <label class="block text-sm font-medium text-foreground mb-2">Title</label>
              <input v-model="embed.title" type="text" class="w-full bg-background border border-border rounded-lg px-3 py-2 text-foreground" placeholder="Embed title">
            </div>
            
            <div>
              <label class="block text-sm font-medium text-foreground mb-2">URL</label>
              <input v-model="embed.url" type="url" class="w-full bg-background border border-border rounded-lg px-3 py-2 text-foreground" placeholder="https://example.com">
            </div>
            
            <div>
              <label class="block text-sm font-medium text-foreground mb-2">Description</label>
              <textarea v-model="embed.description" rows="3" class="w-full bg-background border border-border rounded-lg px-3 py-2 text-foreground" placeholder="Embed description"></textarea>
            </div>
            
            <div>
              <label class="block text-sm font-medium text-foreground mb-2">Color</label>
              <input v-model="embed.color" type="color" class="w-full h-10 bg-background border border-border rounded-lg">
            </div>
          </div>
        </div>
        
        <div class="bg-card border border-border rounded-lg p-6">
          <h3 class="font-semibold text-foreground mb-4">Fields</h3>
          
          <div class="space-y-4">
            <div v-for="(field, index) in embed.fields" :key="index" class="bg-secondary/50 rounded-lg p-4">
              <div class="flex items-start justify-between mb-3">
                <div class="flex-1 space-y-3">
                  <input
                    v-model="field.name"
                    type="text"
                    placeholder="Field name"
                    class="w-full bg-background border border-border rounded-lg px-3 py-2 text-foreground"
                  >
                  
                  <textarea
                    v-model="field.value"
                    rows="2"
                    placeholder="Field value"
                    class="w-full bg-background border border-border rounded-lg px-3 py-2 text-foreground"
                  ></textarea>
                  
                  <div class="flex items-center space-x-2">
                    <input type="checkbox" v-model="field.inline" id="inline" class="rounded border-border text-primary focus:ring-primary">
                    <label for="inline" class="text-sm text-foreground">Inline field</label>
                  </div>
                </div>
                
                <button @click="removeField(index)" class="text-destructive hover:text-destructive/80 ml-4">
                  <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                    <path d="M3 6h18"/>
                    <path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"/>
                  </svg>
                </button>
              </div>
            </div>
            
            <button @click="addField" class="text-primary hover:text-primary/80 text-sm">
              + Add Field
            </button>
          </div>
        </div>
        
        <div class="bg-card border border-border rounded-lg p-6">
          <h3 class="font-semibold text-foreground mb-4">Images & Footer</h3>
          
          <div class="space-y-4">
            <div>
              <label class="block text-sm font-medium text-foreground mb-2">Thumbnail URL</label>
              <input v-model="embed.thumbnail" type="url" class="w-full bg-background border border-border rounded-lg px-3 py-2 text-foreground" placeholder="https://example.com/thumbnail.png">
            </div>
            
            <div>
              <label class="block text-sm font-medium text-foreground mb-2">Image URL</label>
              <input v-model="embed.image" type="url" class="w-full bg-background border border-border rounded-lg px-3 py-2 text-foreground" placeholder="https://example.com/image.png">
            </div>
            
            <div>
              <label class="block text-sm font-medium text-foreground mb-2">Footer Text</label>
              <input v-model="embed.footer.text" type="text" class="w-full bg-background border border-border rounded-lg px-3 py-2 text-foreground" placeholder="Footer text">
            </div>
            
            <div>
              <label class="block text-sm font-medium text-foreground mb-2">Footer Icon URL</label>
              <input v-model="embed.footer.iconUrl" type="url" class="w-full bg-background border border-border rounded-lg px-3 py-2 text-foreground" placeholder="https://example.com/footer-icon.png">
            </div>
            
            <div>
              <label class="block text-sm font-medium text-foreground mb-2">Timestamp</label>
              <input v-model="embed.timestamp" type="datetime-local" class="w-full bg-background border border-border rounded-lg px-3 py-2 text-foreground">
            </div>
          </div>
        </div>
      </div>
      
      <!-- Embed Preview -->
      <div class="space-y-4">
        <div class="bg-card border border-border rounded-lg p-6">
          <h3 class="font-semibold text-foreground mb-4">Preview</h3>
          
          <div class="bg-[#36393f] rounded-lg p-4 text-white">
            <!-- Author -->
            <div v-if="embed.author.name" class="flex items-center gap-2 mb-2">
              <img v-if="embed.author.iconUrl" :src="embed.author.iconUrl" alt="Author Icon" class="w-6 h-6 rounded-full">
              <span class="text-sm font-medium">{{ embed.author.name }}</span>
            </div>
            
            <!-- Title -->
            <div v-if="embed.title" class="mb-2">
              <a :href="embed.url" class="text-[#00aff4] font-semibold hover:underline">{{ embed.title }}</a>
            </div>
            
            <!-- Description -->
            <div v-if="embed.description" class="mb-4 whitespace-pre-wrap text-sm">{{ embed.description }}</div>
            
            <!-- Fields -->
            <div v-if="embed.fields.length > 0" class="grid grid-cols-1 gap-2 mb-4">
              <div v-for="(field, index) in embed.fields" :key="index" :class="[
                'mb-2',
                field.inline ? 'inline-block w-1/2' : 'block w-full'
              ]">
                <div class="font-semibold text-sm">{{ field.name }}</div>
                <div class="text-sm">{{ field.value }}</div>
              </div>
            </div>
            
            <!-- Image -->
            <div v-if="embed.image" class="mb-4">
              <img :src="embed.image" alt="Embed Image" class="max-w-full rounded">
            </div>
            
            <!-- Footer -->
            <div v-if="embed.footer.text || embed.timestamp" class="flex items-center gap-2 text-xs text-gray-400">
              <img v-if="embed.footer.iconUrl" :src="embed.footer.iconUrl" alt="Footer Icon" class="w-5 h-5 rounded-full">
              <span v-if="embed.footer.text">{{ embed.footer.text }}</span>
              <span v-if="embed.timestamp">{{ formatTimestamp(embed.timestamp) }}</span>
            </div>
          </div>
          
          <div class="mt-4 text-sm text-muted-foreground">
            <p>This is a preview of how your embed will appear in Discord. Some elements may look slightly different in the actual Discord client.</p>
          </div>
        </div>
        
        <div class="bg-card border border-border rounded-lg p-6">
          <h3 class="font-semibold text-foreground mb-4">Saved Templates</h3>
          
          <div v-if="savedTemplates.length === 0" class="text-center py-4">
            <p class="text-muted-foreground">No saved templates</p>
          </div>
          
          <div v-else class="space-y-3">
            <div v-for="template in savedTemplates" :key="template.id" class="flex items-center justify-between">
              <div>
                <p class="font-medium text-foreground">{{ template.name }}</p>
                <p class="text-xs text-muted-foreground">{{ formatDate(template.createdAt) }}</p>
              </div>
              <div class="flex items-center gap-2">
                <button @click="loadTemplate(template)" class="text-primary hover:text-primary/80 text-sm">
                  Load
                </button>
                <button @click="deleteTemplate(template.id)" class="text-destructive hover:text-destructive/80 text-sm">
                  Delete
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive } from 'vue'
import { useToastStore } from '@/stores/toast'

const toastStore = useToastStore()

interface EmbedField {
  name: string
  value: string
  inline: boolean
}

interface EmbedTemplate {
  id: string
  name: string
  createdAt: Date
  embed: any
}

const embed = reactive({
  author: {
    name: '',
    iconUrl: ''
  },
  title: 'Welcome to our server!',
  url: '',
  description: 'This is a sample embed description. You can customize this text to display information about your server, event, or announcement.',
  color: '#5865F2',
  fields: [] as EmbedField[],
  thumbnail: '',
  image: '',
  footer: {
    text: 'Powered by Bubbles Bot',
    iconUrl: ''
  },
  timestamp: ''
})

const savedTemplates = ref<EmbedTemplate[]>([
  {
    id: '1',
    name: 'Welcome Embed',
    createdAt: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000),
    embed: {
      author: {
        name: 'Server Admin',
        iconUrl: ''
      },
      title: 'Welcome to our server!',
      url: '',
      description: 'We\'re glad to have you here. Please read the rules and enjoy your stay!',
      color: '#5865F2',
      fields: [
        {
          name: 'Rules',
          value: 'Check out #rules for our server guidelines',
          inline: true
        },
        {
          name: 'Roles',
          value: 'Get roles in #role-assignment',
          inline: true
        }
      ],
      thumbnail: '',
      image: '',
      footer: {
        text: 'Join date',
        iconUrl: ''
      },
      timestamp: new Date().toISOString()
    }
  }
])

const addField = () => {
  embed.fields.push({
    name: '',
    value: '',
    inline: false
  })
}

const removeField = (index: number) => {
  embed.fields.splice(index, 1)
}

const resetEmbed = () => {
  if (confirm('Are you sure you want to reset the embed? All changes will be lost.')) {
    Object.assign(embed, {
      author: {
        name: '',
        iconUrl: ''
      },
      title: 'Welcome to our server!',
      url: '',
      description: 'This is a sample embed description. You can customize this text to display information about your server, event, or announcement.',
      color: '#5865F2',
      fields: [],
      thumbnail: '',
      image: '',
      footer: {
        text: 'Powered by Bubbles Bot',
        iconUrl: ''
      },
      timestamp: ''
    })
    toastStore.addToast('Embed reset to default', 'info')
  }
}

const saveEmbed = () => {
  const templateName = prompt('Enter a name for this template:')
  if (templateName) {
    const newTemplate: EmbedTemplate = {
      id: Date.now().toString(),
      name: templateName,
      createdAt: new Date(),
      embed: JSON.parse(JSON.stringify(embed))
    }
    savedTemplates.value.push(newTemplate)
    toastStore.addToast(`Template "${templateName}" saved successfully!`, 'success')
  }
}

const loadTemplate = (template: EmbedTemplate) => {
  if (confirm('Loading this template will replace your current embed. Continue?')) {
    Object.assign(embed, JSON.parse(JSON.stringify(template.embed)))
    toastStore.addToast(`Template "${template.name}" loaded`, 'success')
  }
}

const deleteTemplate = (templateId: string) => {
  if (confirm('Are you sure you want to delete this template?')) {
    const index = savedTemplates.value.findIndex(t => t.id === templateId)
    if (index !== -1) {
      const templateName = savedTemplates.value[index].name
      savedTemplates.value.splice(index, 1)
      toastStore.addToast(`Template "${templateName}" deleted`, 'success')
    }
  }
}

const copyEmbedCode = () => {
  const code = JSON.stringify(embed, null, 2)
  navigator.clipboard.writeText(code)
  toastStore.addToast('Embed code copied to clipboard', 'success')
}

const formatTimestamp = (timestamp: string) => {
  if (!timestamp) return ''
  return new Date(timestamp).toLocaleString()
}

const formatDate = (date: Date) => {
  return date.toLocaleDateString()
}
</script>