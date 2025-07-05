<template>
  <div class="space-y-6">
    <div class="flex justify-between items-center">
      <h2 class="text-xl font-semibold text-foreground">Application Form Builder</h2>
      <button @click="showCreateModal = true" class="bg-primary hover:bg-primary/90 text-primary-foreground px-4 py-2 rounded-lg transition-colors">
        Create Form
      </button>
    </div>

    <!-- Forms List -->
    <div class="grid grid-cols-1 lg:grid-cols-2 gap-6">
      <div v-for="form in forms" :key="form.id" class="bg-card border border-border rounded-lg p-6">
        <div class="flex items-start justify-between mb-4">
          <div>
            <h3 class="font-semibold text-foreground">{{ form.title }}</h3>
            <p class="text-sm text-muted-foreground">{{ form.description }}</p>
          </div>
          <div class="flex items-center gap-2">
            <span :class="form.enabled ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300' : 'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-300'" 
                  class="px-2 py-1 rounded-full text-xs font-medium">
              {{ form.enabled ? 'Active' : 'Inactive' }}
            </span>
            <button @click="editForm(form)" class="text-muted-foreground hover:text-foreground">
              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <path d="M17 3a2.828 2.828 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5L17 3z"/>
              </svg>
            </button>
          </div>
        </div>
        
        <div class="space-y-2 text-sm mb-4">
          <div class="flex justify-between">
            <span class="text-muted-foreground">Questions:</span>
            <span class="text-foreground">{{ form.questions.length }}</span>
          </div>
          <div class="flex justify-between">
            <span class="text-muted-foreground">Submissions:</span>
            <span class="text-foreground">{{ form.submissionCount }}</span>
          </div>
          <div class="flex justify-between">
            <span class="text-muted-foreground">Target Role:</span>
            <span class="text-foreground">{{ form.targetRole }}</span>
          </div>
        </div>

        <div class="flex gap-2">
          <button @click="previewForm(form)" class="text-primary hover:text-primary/80 text-sm">
            Preview
          </button>
          <button @click="duplicateForm(form)" class="text-muted-foreground hover:text-foreground text-sm">
            Duplicate
          </button>
        </div>
      </div>
    </div>

    <!-- Form Builder Modal -->
    <div v-if="showCreateModal" class="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div class="bg-card border border-border rounded-lg w-full max-w-4xl max-h-[90vh] overflow-y-auto m-4">
        <div class="p-6 border-b border-border">
          <div class="flex justify-between items-center">
            <h3 class="text-lg font-semibold text-foreground">
              {{ editingForm ? 'Edit Form' : 'Create Application Form' }}
            </h3>
            <button @click="closeModal" class="text-muted-foreground hover:text-foreground">
              <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <path d="m18 6-12 12"/>
                <path d="m6 6 12 12"/>
              </svg>
            </button>
          </div>
        </div>
        
        <div class="p-6 space-y-6">
          <!-- Form Settings -->
          <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label class="block text-sm font-medium text-foreground mb-2">Form Title</label>
              <input v-model="formBuilder.title" type="text" class="w-full bg-background border border-border rounded-lg px-3 py-2 text-foreground" required>
            </div>
            <div>
              <label class="block text-sm font-medium text-foreground mb-2">Target Role</label>
              <input v-model="formBuilder.targetRole" type="text" class="w-full bg-background border border-border rounded-lg px-3 py-2 text-foreground" required>
            </div>
          </div>
          
          <div>
            <label class="block text-sm font-medium text-foreground mb-2">Description</label>
            <textarea v-model="formBuilder.description" rows="2" class="w-full bg-background border border-border rounded-lg px-3 py-2 text-foreground"></textarea>
          </div>
          
          <!-- Questions Builder -->
          <div>
            <div class="flex justify-between items-center mb-4">
              <h4 class="font-medium text-foreground">Questions</h4>
              <button @click="addQuestion" class="text-primary hover:text-primary/80 text-sm">
                + Add Question
              </button>
            </div>
            
            <div class="space-y-4">
              <div v-for="(question, index) in formBuilder.questions" :key="question.id" class="bg-secondary/50 rounded-lg p-4">
                <div class="flex items-start justify-between mb-3">
                  <div class="flex-1 space-y-3">
                    <input
                      v-model="question.text"
                      type="text"
                      placeholder="Question text"
                      class="w-full bg-background border border-border rounded-lg px-3 py-2 text-foreground"
                    >
                    
                    <div class="grid grid-cols-2 gap-3">
                      <select v-model="question.type" class="bg-background border border-border rounded-lg px-3 py-2 text-foreground">
                        <option value="text">Short Text</option>
                        <option value="textarea">Long Text</option>
                        <option value="select">Multiple Choice</option>
                        <option value="checkbox">Checkbox</option>
                        <option value="file">File Upload</option>
                      </select>
                      
                      <div class="flex items-center space-x-4">
                        <label class="flex items-center space-x-2">
                          <input type="checkbox" v-model="question.required" class="rounded border-border text-primary focus:ring-primary">
                          <span class="text-sm text-foreground">Required</span>
                        </label>
                      </div>
                    </div>
                    
                    <!-- Options for select type -->
                    <div v-if="question.type === 'select'" class="space-y-2">
                      <label class="text-sm font-medium text-foreground">Options</label>
                      <div v-for="(option, optIndex) in question.options" :key="optIndex" class="flex items-center gap-2">
                        <input
                          v-model="question.options[optIndex]"
                          type="text"
                          placeholder="Option text"
                          class="flex-1 bg-background border border-border rounded-lg px-3 py-1 text-foreground"
                        >
                        <button @click="removeOption(question, optIndex)" class="text-destructive hover:text-destructive/80">
                          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                            <path d="M3 6h18"/>
                            <path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"/>
                          </svg>
                        </button>
                      </div>
                      <button @click="addOption(question)" class="text-primary hover:text-primary/80 text-sm">
                        + Add Option
                      </button>
                    </div>
                    
                    <!-- Character limit for text fields -->
                    <div v-if="question.type === 'text' || question.type === 'textarea'">
                      <label class="block text-sm font-medium text-foreground mb-1">Character Limit (optional)</label>
                      <input
                        v-model.number="question.maxLength"
                        type="number"
                        min="1"
                        class="w-32 bg-background border border-border rounded-lg px-3 py-1 text-foreground"
                      >
                    </div>
                  </div>
                  
                  <button @click="removeQuestion(index)" class="text-destructive hover:text-destructive/80 ml-4">
                    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                      <path d="M3 6h18"/>
                      <path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"/>
                    </svg>
                  </button>
                </div>
              </div>
            </div>
          </div>
          
          <!-- Requirements -->
          <div>
            <label class="block text-sm font-medium text-foreground mb-2">Requirements</label>
            <div class="space-y-2">
              <div v-for="(req, index) in formBuilder.requirements" :key="index" class="flex items-center gap-2">
                <input
                  v-model="formBuilder.requirements[index]"
                  type="text"
                  placeholder="e.g., Account age 30+ days"
                  class="flex-1 bg-background border border-border rounded-lg px-3 py-2 text-foreground"
                >
                <button @click="removeRequirement(index)" class="text-destructive hover:text-destructive/80">
                  <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                    <path d="M3 6h18"/>
                    <path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"/>
                  </svg>
                </button>
              </div>
              <button @click="addRequirement" class="text-primary hover:text-primary/80 text-sm">
                + Add Requirement
              </button>
            </div>
          </div>
        </div>
        
        <div class="p-6 border-t border-border flex justify-end space-x-3">
          <button @click="closeModal" class="px-4 py-2 border border-border rounded-lg text-muted-foreground hover:text-foreground">
            Cancel
          </button>
          <button @click="saveForm" class="px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90">
            {{ editingForm ? 'Update Form' : 'Create Form' }}
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

interface Question {
  id: string
  text: string
  type: 'text' | 'textarea' | 'select' | 'checkbox' | 'file'
  required: boolean
  maxLength?: number
  options?: string[]
}

interface ApplicationForm {
  id: string
  title: string
  description: string
  targetRole: string
  enabled: boolean
  questions: Question[]
  requirements: string[]
  submissionCount: number
}

const showCreateModal = ref(false)
const editingForm = ref<ApplicationForm | null>(null)

const forms = ref<ApplicationForm[]>([
  {
    id: '1',
    title: 'Staff Application',
    description: 'Application to become a server moderator',
    targetRole: 'Moderator',
    enabled: true,
    submissionCount: 23,
    requirements: ['Account age 30+ days', 'Level 10+', 'No recent warnings'],
    questions: [
      { id: '1', text: 'Why do you want to become a moderator?', type: 'textarea', required: true, maxLength: 500 },
      { id: '2', text: 'How many hours per day can you dedicate to moderation?', type: 'text', required: true },
      { id: '3', text: 'Have you had any previous moderation experience?', type: 'textarea', required: false, maxLength: 300 }
    ]
  }
])

const formBuilder = reactive({
  title: '',
  description: '',
  targetRole: '',
  questions: [] as Question[],
  requirements: [] as string[]
})

const addQuestion = () => {
  formBuilder.questions.push({
    id: Date.now().toString(),
    text: '',
    type: 'text',
    required: false,
    options: []
  })
}

const removeQuestion = (index: number) => {
  formBuilder.questions.splice(index, 1)
}

const addOption = (question: Question) => {
  if (!question.options) question.options = []
  question.options.push('')
}

const removeOption = (question: Question, index: number) => {
  if (question.options) {
    question.options.splice(index, 1)
  }
}

const addRequirement = () => {
  formBuilder.requirements.push('')
}

const removeRequirement = (index: number) => {
  formBuilder.requirements.splice(index, 1)
}

const editForm = (form: ApplicationForm) => {
  editingForm.value = form
  Object.assign(formBuilder, {
    title: form.title,
    description: form.description,
    targetRole: form.targetRole,
    questions: JSON.parse(JSON.stringify(form.questions)),
    requirements: [...form.requirements]
  })
  showCreateModal.value = true
}

const duplicateForm = (form: ApplicationForm) => {
  const newForm: ApplicationForm = {
    ...JSON.parse(JSON.stringify(form)),
    id: Date.now().toString(),
    title: `${form.title} (Copy)`,
    submissionCount: 0
  }
  forms.value.push(newForm)
  toastStore.addToast(`Form "${form.title}" duplicated successfully!`, 'success')
}

const previewForm = (form: ApplicationForm) => {
  toastStore.addToast('Form preview would open here', 'info')
}

const saveForm = () => {
  if (editingForm.value) {
    // Update existing form
    const index = forms.value.findIndex(f => f.id === editingForm.value!.id)
    if (index !== -1) {
      forms.value[index] = {
        ...forms.value[index],
        title: formBuilder.title,
        description: formBuilder.description,
        targetRole: formBuilder.targetRole,
        questions: JSON.parse(JSON.stringify(formBuilder.questions)),
        requirements: [...formBuilder.requirements]
      }
      toastStore.addToast(`Form "${formBuilder.title}" updated successfully!`, 'success')
    }
  } else {
    // Create new form
    const newForm: ApplicationForm = {
      id: Date.now().toString(),
      title: formBuilder.title,
      description: formBuilder.description,
      targetRole: formBuilder.targetRole,
      enabled: true,
      submissionCount: 0,
      questions: JSON.parse(JSON.stringify(formBuilder.questions)),
      requirements: [...formBuilder.requirements]
    }
    forms.value.push(newForm)
    toastStore.addToast(`Form "${formBuilder.title}" created successfully!`, 'success')
  }
  
  closeModal()
}

const closeModal = () => {
  showCreateModal.value = false
  editingForm.value = null
  Object.assign(formBuilder, {
    title: '',
    description: '',
    targetRole: '',
    questions: [],
    requirements: []
  })
}
</script>