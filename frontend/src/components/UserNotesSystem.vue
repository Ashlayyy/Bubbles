<template>
  <div class="space-y-6">
    <div class="flex justify-between items-center">
      <h2 class="text-xl font-semibold text-foreground">User Notes & Tags</h2>
      <button @click="showCreateModal = true" class="bg-primary hover:bg-primary/90 text-primary-foreground px-4 py-2 rounded-lg transition-colors">
        Add Note
      </button>
    </div>

    <!-- Search and Filter -->
    <div class="flex flex-col sm:flex-row gap-4">
      <div class="flex-1">
        <input
          v-model="searchQuery"
          type="text"
          placeholder="Search by username or note content..."
          class="w-full bg-background border border-border rounded-lg px-3 py-2 text-foreground"
        >
      </div>
      <select v-model="tagFilter" class="bg-background border border-border rounded-lg px-3 py-2 text-foreground">
        <option value="">All Tags</option>
        <option v-for="tag in availableTags" :key="tag" :value="tag">
          {{ tag }}
        </option>
      </select>
    </div>

    <!-- Notes List -->
    <div class="space-y-4">
      <div v-if="filteredNotes.length === 0" class="text-center py-12">
        <div class="text-muted-foreground">
          <svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="mx-auto mb-4 opacity-50">
            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
            <polyline points="14,2 14,8 20,8"/>
            <line x1="16" y1="13" x2="8" y2="13"/>
            <line x1="16" y1="17" x2="8" y2="17"/>
            <polyline points="10,9 9,9 8,9"/>
          </svg>
          <p class="text-lg font-medium">No notes found</p>
          <p class="text-sm">Add your first note to get started</p>
        </div>
      </div>

      <div v-for="note in filteredNotes" :key="note.id" class="bg-card border border-border rounded-lg p-6">
        <div class="flex items-start justify-between mb-4">
          <div class="flex items-center gap-3">
            <div class="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
              <span class="text-primary font-bold">{{ note.username.charAt(0) }}</span>
            </div>
            <div>
              <h3 class="font-semibold text-foreground">{{ note.username }}</h3>
              <p class="text-xs text-muted-foreground">User ID: {{ note.userId }}</p>
            </div>
          </div>
          
          <div class="flex items-center gap-2">
            <button @click="editNote(note)" class="text-muted-foreground hover:text-foreground">
              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <path d="M17 3a2.828 2.828 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5L17 3z"/>
              </svg>
            </button>
            <button @click="deleteNote(note.id)" class="text-muted-foreground hover:text-destructive">
              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <path d="M3 6h18"/>
                <path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"/>
                <path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"/>
              </svg>
            </button>
          </div>
        </div>
        
        <div class="bg-secondary/50 rounded-lg p-4 mb-4">
          <p class="text-foreground whitespace-pre-wrap">{{ note.content }}</p>
        </div>
        
        <div class="flex items-center justify-between text-sm">
          <div class="flex flex-wrap gap-2">
            <span v-for="tag in note.tags" :key="tag" class="px-2 py-1 rounded-full bg-primary/10 text-primary">
              {{ tag }}
            </span>
          </div>
          <div class="text-muted-foreground">
            <span>Added by {{ note.addedBy }}</span>
            <span class="mx-2">•</span>
            <span>{{ formatDate(note.createdAt) }}</span>
          </div>
        </div>
      </div>
    </div>

    <!-- Create/Edit Modal -->
    <div v-if="showCreateModal" class="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div class="bg-card border border-border rounded-lg p-6 w-full max-w-md">
        <h3 class="text-lg font-semibold text-foreground mb-4">
          {{ editingNote ? 'Edit Note' : 'Add Note' }}
        </h3>
        
        <form @submit.prevent="saveNote" class="space-y-4">
          <div v-if="!editingNote">
            <label class="block text-sm font-medium text-foreground mb-2">User</label>
            <input v-model="noteForm.username" type="text" class="w-full bg-background border border-border rounded-lg px-3 py-2 text-foreground" placeholder="Username or ID" required>
          </div>
          
          <div>
            <label class="block text-sm font-medium text-foreground mb-2">Note Content</label>
            <textarea v-model="noteForm.content" rows="4" class="w-full bg-background border border-border rounded-lg px-3 py-2 text-foreground" required></textarea>
          </div>
          
          <div>
            <label class="block text-sm font-medium text-foreground mb-2">Tags</label>
            <div class="flex flex-wrap gap-2 mb-2">
              <span v-for="tag in noteForm.tags" :key="tag" class="px-2 py-1 rounded-full bg-primary/10 text-primary flex items-center gap-1">
                {{ tag }}
                <button @click="removeTag(tag)" class="text-primary hover:text-primary/80">
                  <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                    <path d="m18 6-12 12"/>
                    <path d="m6 6 12 12"/>
                  </svg>
                </button>
              </span>
            </div>
            <div class="flex gap-2">
              <input
                v-model="newTag"
                @keydown.enter.prevent="addTag"
                type="text"
                class="flex-1 bg-background border border-border rounded-lg px-3 py-2 text-foreground"
                placeholder="Add a tag"
              >
              <button type="button" @click="addTag" class="px-3 py-2 bg-secondary text-secondary-foreground rounded-lg hover:bg-secondary/80">
                Add
              </button>
            </div>
          </div>
          
          <div class="flex justify-end space-x-3">
            <button type="button" @click="showCreateModal = false" class="px-4 py-2 border border-border rounded-lg text-muted-foreground hover:text-foreground">
              Cancel
            </button>
            <button type="submit" class="px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90">
              {{ editingNote ? 'Update' : 'Add' }}
            </button>
          </div>
        </form>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, reactive } from 'vue'
import { useToastStore } from '@/stores/toast'

const toastStore = useToastStore()

interface UserNote {
  id: string
  userId: string
  username: string
  content: string
  tags: string[]
  addedBy: string
  createdAt: Date
}

const notes = ref<UserNote[]>([
  {
    id: '1',
    userId: '123456789',
    username: 'TroubleUser',
    content: 'User has been warned multiple times about spamming in general chat. Consider a temporary mute if behavior continues.',
    tags: ['Warning', 'Spam'],
    addedBy: 'Moderator1',
    createdAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000)
  },
  {
    id: '2',
    userId: '987654321',
    username: 'HelpfulUser',
    content: 'Very helpful in the support channels. Potential candidate for the helper role.',
    tags: ['Positive', 'Helper'],
    addedBy: 'Admin',
    createdAt: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)
  }
])

const showCreateModal = ref(false)
const editingNote = ref<UserNote | null>(null)
const searchQuery = ref('')
const tagFilter = ref('')
const newTag = ref('')

const noteForm = reactive({
  username: '',
  userId: '',
  content: '',
  tags: [] as string[]
})

const availableTags = computed(() => {
  const tags = new Set<string>()
  notes.value.forEach(note => {
    note.tags.forEach(tag => tags.add(tag))
  })
  return Array.from(tags).sort()
})

const filteredNotes = computed(() => {
  let filtered = notes.value
  
  if (searchQuery.value) {
    const search = searchQuery.value.toLowerCase()
    filtered = filtered.filter(note => 
      note.username.toLowerCase().includes(search) ||
      note.content.toLowerCase().includes(search) ||
      note.userId.includes(search)
    )
  }
  
  if (tagFilter.value) {
    filtered = filtered.filter(note => note.tags.includes(tagFilter.value))
  }
  
  return filtered.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
})

const formatDate = (date: Date) => {
  return date.toLocaleString()
}

const addTag = () => {
  if (!newTag.value.trim()) return
  
  if (!noteForm.tags.includes(newTag.value.trim())) {
    noteForm.tags.push(newTag.value.trim())
  }
  
  newTag.value = ''
}

const removeTag = (tag: string) => {
  const index = noteForm.tags.indexOf(tag)
  if (index !== -1) {
    noteForm.tags.splice(index, 1)
  }
}

const editNote = (note: UserNote) => {
  editingNote.value = note
  Object.assign(noteForm, {
    username: note.username,
    userId: note.userId,
    content: note.content,
    tags: [...note.tags]
  })
  showCreateModal.value = true
}

const deleteNote = (noteId: string) => {
  if (confirm('Are you sure you want to delete this note?')) {
    const index = notes.value.findIndex(n => n.id === noteId)
    if (index !== -1) {
      notes.value.splice(index, 1)
      toastStore.addToast('Note deleted successfully!', 'success')
    }
  }
}

const saveNote = () => {
  if (editingNote.value) {
    // Update existing note
    const index = notes.value.findIndex(n => n.id === editingNote.value!.id)
    if (index !== -1) {
      notes.value[index] = {
        ...notes.value[index],
        content: noteForm.content,
        tags: [...noteForm.tags]
      }
      toastStore.addToast('Note updated successfully!', 'success')
    }
  } else {
    // Create new note
    const newNote: UserNote = {
      id: Date.now().toString(),
      userId: noteForm.username.includes('@') ? noteForm.username.substring(1) : noteForm.username,
      username: noteForm.username,
      content: noteForm.content,
      tags: [...noteForm.tags],
      addedBy: 'CurrentUser',
      createdAt: new Date()
    }
    notes.value.push(newNote)
    toastStore.addToast('Note added successfully!', 'success')
  }
  
  showCreateModal.value = false
  editingNote.value = null
  
  // Reset form
  Object.assign(noteForm, {
    username: '',
    userId: '',
    content: '',
    tags: []
  })
}
</script>