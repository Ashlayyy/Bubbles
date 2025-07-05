<template>
  <div>
    <h1 class="text-3xl font-bold text-foreground mb-6">Applications</h1>

    <!-- Tabs -->
    <div class="mb-6 border-b border-border">
      <nav class="-mb-px flex space-x-6">
        <button
          @click="activeTab = 'forms'"
          :class="[
            'py-3 px-1 border-b-2 font-medium text-sm transition-colors',
            activeTab === 'forms'
              ? 'border-primary text-primary'
              : 'border-transparent text-muted-foreground hover:text-foreground hover:border-muted-foreground'
          ]"
        >
          Application Forms
        </button>
        <button
          @click="activeTab = 'submissions'"
          :class="[
            'py-3 px-1 border-b-2 font-medium text-sm transition-colors',
            activeTab === 'submissions'
              ? 'border-primary text-primary'
              : 'border-transparent text-muted-foreground hover:text-foreground hover:border-muted-foreground'
          ]"
        >
          Submissions ({{ pendingApplications.length }})
        </button>
        <button
          @click="activeTab = 'history'"
          :class="[
            'py-3 px-1 border-b-2 font-medium text-sm transition-colors',
            activeTab === 'history'
              ? 'border-primary text-primary'
              : 'border-transparent text-muted-foreground hover:text-foreground hover:border-muted-foreground'
          ]"
        >
          History
        </button>
        <button
          @click="activeTab = 'analytics'"
          :class="[
            'py-3 px-1 border-b-2 font-medium text-sm transition-colors',
            activeTab === 'analytics'
              ? 'border-primary text-primary'
              : 'border-transparent text-muted-foreground hover:text-foreground hover:border-muted-foreground'
          ]"
        >
          Analytics
        </button>
      </nav>
    </div>

    <!-- Application Forms -->
    <div v-if="activeTab === 'forms'" class="space-y-6">
      <div class="flex justify-between items-center">
        <h2 class="text-xl font-semibold text-foreground">Application Forms</h2>
        <button @click="showFormModal = true" class="bg-primary hover:bg-primary/90 text-primary-foreground px-4 py-2 rounded-lg transition-colors">
          Create Form
        </button>
      </div>

      <div class="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div v-for="form in applicationForms" :key="form.id" class="bg-card border border-border rounded-lg p-6">
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
              <button @click="toggleForm(form.id)" class="text-muted-foreground hover:text-foreground">
                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                  <path d="M12 2v20M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/>
                </svg>
              </button>
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
              <span class="text-muted-foreground">Target Role:</span>
              <span class="text-foreground">{{ form.targetRole }}</span>
            </div>
            <div class="flex justify-between">
              <span class="text-muted-foreground">Submissions:</span>
              <span class="text-foreground">{{ form.submissionCount }}</span>
            </div>
            <div class="flex justify-between">
              <span class="text-muted-foreground">Approval Rate:</span>
              <span class="text-foreground">{{ form.approvalRate }}%</span>
            </div>
          </div>

          <div class="space-y-2">
            <div class="flex justify-between text-xs">
              <span class="text-muted-foreground">Requirements:</span>
            </div>
            <div class="flex flex-wrap gap-1">
              <span v-for="req in form.requirements" :key="req" class="bg-secondary text-secondary-foreground px-2 py-1 rounded text-xs">
                {{ req }}
              </span>
            </div>
          </div>

          <div class="mt-4 pt-4 border-t border-border flex gap-2">
            <button @click="previewForm(form)" class="text-primary hover:text-primary/80 text-sm font-medium">
              Preview Form
            </button>
            <button @click="duplicateForm(form)" class="text-muted-foreground hover:text-foreground text-sm">
              Duplicate
            </button>
          </div>
        </div>
      </div>
    </div>

    <!-- Submissions -->
    <div v-if="activeTab === 'submissions'" class="space-y-6">
      <div class="flex justify-between items-center">
        <h2 class="text-xl font-semibold text-foreground">Pending Applications</h2>
        <div class="flex gap-2">
          <select v-model="selectedFormFilter" class="bg-input border border-border rounded-lg px-3 py-2 text-foreground">
            <option value="">All Forms</option>
            <option v-for="form in applicationForms" :key="form.id" :value="form.id">
              {{ form.title }}
            </option>
          </select>
          <select v-model="selectedPriorityFilter" class="bg-input border border-border rounded-lg px-3 py-2 text-foreground">
            <option value="">All Priorities</option>
            <option value="high">High Priority</option>
            <option value="medium">Medium Priority</option>
            <option value="low">Low Priority</option>
          </select>
          <button @click="showBulkReviewModal = true" class="bg-secondary hover:bg-secondary/80 text-secondary-foreground px-4 py-2 rounded-lg transition-colors">
            Bulk Actions
          </button>
        </div>
      </div>

      <div class="space-y-4">
        <div v-for="application in filteredApplications" :key="application.id" class="bg-card border border-border rounded-lg p-6">
          <div class="flex items-start justify-between mb-4">
            <div class="flex items-center gap-3">
              <div class="w-10 h-10 bg-gradient-to-br from-blue-500 to-purple-600 rounded-full flex items-center justify-center">
                <span class="text-white font-bold text-sm">{{ application.applicant.charAt(0) }}</span>
              </div>
              <div>
                <h3 class="font-semibold text-foreground">{{ application.applicant }}</h3>
                <p class="text-sm text-muted-foreground">Applied for {{ application.formTitle }}</p>
                <div class="flex items-center gap-2 mt-1">
                  <span :class="getPriorityColor(application.priority)" class="px-2 py-1 rounded-full text-xs font-medium">
                    {{ application.priority }} priority
                  </span>
                  <span v-if="application.previousApplications > 0" class="bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-300 px-2 py-1 rounded-full text-xs">
                    {{ application.previousApplications }} previous apps
                  </span>
                </div>
              </div>
            </div>
            <div class="flex items-center gap-2">
              <span class="text-xs text-muted-foreground">{{ formatDate(application.submittedAt) }}</span>
              <button @click="reviewApplication(application)" class="bg-primary hover:bg-primary/90 text-primary-foreground px-3 py-1 rounded text-sm">
                Review
              </button>
            </div>
          </div>
          
          <div class="space-y-3">
            <div v-for="(answer, index) in application.answers.slice(0, 2)" :key="index" class="bg-secondary/50 rounded-lg p-3">
              <p class="text-sm font-medium text-foreground mb-1">{{ answer.question }}</p>
              <p class="text-sm text-muted-foreground">{{ answer.answer.length > 100 ? answer.answer.substring(0, 100) + '...' : answer.answer }}</p>
            </div>
            <div v-if="application.answers.length > 2" class="text-sm text-muted-foreground">
              +{{ application.answers.length - 2 }} more answers
            </div>
          </div>

          <div v-if="application.attachments && application.attachments.length > 0" class="mt-4">
            <p class="text-sm font-medium text-foreground mb-2">Attachments:</p>
            <div class="flex gap-2">
              <span v-for="attachment in application.attachments" :key="attachment" class="bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300 px-2 py-1 rounded text-xs">
                {{ attachment }}
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- History -->
    <div v-if="activeTab === 'history'" class="space-y-6">
      <div class="flex justify-between items-center">
        <h2 class="text-xl font-semibold text-foreground">Application History</h2>
        <div class="flex gap-2">
          <select v-model="selectedStatusFilter" class="bg-input border border-border rounded-lg px-3 py-2 text-foreground">
            <option value="">All Statuses</option>
            <option value="approved">Approved</option>
            <option value="rejected">Rejected</option>
            <option value="withdrawn">Withdrawn</option>
          </select>
          <input v-model="historySearchQuery" type="text" placeholder="Search applicants..." class="bg-input border border-border rounded-lg px-3 py-2 text-foreground">
        </div>
      </div>

      <div class="space-y-4">
        <div v-for="application in filteredHistory" :key="application.id" class="bg-card border border-border rounded-lg p-6">
          <div class="flex items-start justify-between">
            <div class="flex items-center gap-3">
              <div class="w-10 h-10 bg-gradient-to-br from-blue-500 to-purple-600 rounded-full flex items-center justify-center">
                <span class="text-white font-bold text-sm">{{ application.applicant.charAt(0) }}</span>
              </div>
              <div>
                <h3 class="font-semibold text-foreground">{{ application.applicant }}</h3>
                <p class="text-sm text-muted-foreground">{{ application.formTitle }}</p>
                <p class="text-xs text-muted-foreground">Reviewed by {{ application.reviewedBy }}</p>
              </div>
            </div>
            <div class="text-right">
              <span :class="getStatusColor(application.status)" class="px-2 py-1 rounded-full text-xs font-medium">
                {{ application.status.charAt(0).toUpperCase() + application.status.slice(1) }}
              </span>
              <p class="text-xs text-muted-foreground mt-1">{{ formatDate(application.processedAt) }}</p>
            </div>
          </div>
          
          <div v-if="application.reviewNote" class="mt-4 bg-secondary/50 rounded-lg p-3">
            <p class="text-sm text-foreground">{{ application.reviewNote }}</p>
          </div>
        </div>
      </div>
    </div>

    <!-- Analytics -->
    <div v-if="activeTab === 'analytics'" class="space-y-6">
      <h2 class="text-xl font-semibold text-foreground">Application Analytics</h2>
      
      <div class="grid grid-cols-1 md:grid-cols-4 gap-6">
        <div class="bg-card border border-border rounded-lg p-6">
          <h3 class="text-lg font-semibold text-card-foreground mb-2">Total Applications</h3>
          <p class="text-3xl font-bold text-primary">{{ analytics.totalApplications }}</p>
          <p class="text-sm text-green-500">+12% this month</p>
        </div>
        <div class="bg-card border border-border rounded-lg p-6">
          <h3 class="text-lg font-semibold text-card-foreground mb-2">Approval Rate</h3>
          <p class="text-3xl font-bold text-green-600">{{ analytics.approvalRate }}%</p>
          <p class="text-sm text-green-500">+5% this month</p>
        </div>
        <div class="bg-card border border-border rounded-lg p-6">
          <h3 class="text-lg font-semibold text-card-foreground mb-2">Avg Review Time</h3>
          <p class="text-3xl font-bold text-blue-600">{{ analytics.avgReviewTime }}h</p>
          <p class="text-sm text-red-500">+2h this month</p>
        </div>
        <div class="bg-card border border-border rounded-lg p-6">
          <h3 class="text-lg font-semibold text-card-foreground mb-2">Active Forms</h3>
          <p class="text-3xl font-bold text-purple-600">{{ analytics.activeForms }}</p>
          <p class="text-sm text-muted-foreground">{{ analytics.totalForms }} total</p>
        </div>
      </div>

      <div class="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div class="bg-card border border-border rounded-lg p-6">
          <h3 class="text-lg font-semibold text-card-foreground mb-4">Applications by Form</h3>
          <div class="space-y-3">
            <div v-for="form in analytics.formStats" :key="form.name" class="flex items-center justify-between">
              <span class="text-foreground">{{ form.name }}</span>
              <div class="flex items-center gap-2">
                <div class="w-24 bg-secondary rounded-full h-2">
                  <div class="bg-primary h-2 rounded-full" :style="{ width: `${(form.applications / analytics.totalApplications) * 100}%` }"></div>
                </div>
                <span class="text-sm text-muted-foreground">{{ form.applications }}</span>
              </div>
            </div>
          </div>
        </div>

        <div class="bg-card border border-border rounded-lg p-6">
          <h3 class="text-lg font-semibold text-card-foreground mb-4">Review Performance</h3>
          <div class="space-y-3">
            <div v-for="reviewer in analytics.reviewerStats" :key="reviewer.name" class="flex items-center justify-between">
              <span class="text-foreground">{{ reviewer.name }}</span>
              <div class="text-right">
                <p class="text-sm font-medium text-foreground">{{ reviewer.reviewed }} reviewed</p>
                <p class="text-xs text-muted-foreground">{{ reviewer.avgTime }}h avg</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- Application Review Modal -->
    <div v-if="showReviewModal && selectedApplication" class="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div class="bg-card border border-border rounded-lg w-full max-w-4xl max-h-[90vh] overflow-y-auto">
        <div class="p-6 border-b border-border">
          <div class="flex justify-between items-center">
            <h2 class="text-xl font-semibold text-foreground">Review Application</h2>
            <button @click="showReviewModal = false" class="text-muted-foreground hover:text-foreground">
              <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <path d="m18 6-12 12"/>
                <path d="m6 6 12 12"/>
              </svg>
            </button>
          </div>
        </div>
        
        <div class="p-6 space-y-6">
          <div class="flex items-center gap-3">
            <div class="w-12 h-12 bg-gradient-to-br from-blue-500 to-purple-600 rounded-full flex items-center justify-center">
              <span class="text-white font-bold">{{ selectedApplication.applicant.charAt(0) }}</span>
            </div>
            <div>
              <h3 class="font-semibold text-foreground">{{ selectedApplication.applicant }}</h3>
              <p class="text-sm text-muted-foreground">Applied for {{ selectedApplication.formTitle }}</p>
              <p class="text-xs text-muted-foreground">{{ formatDate(selectedApplication.submittedAt) }}</p>
            </div>
          </div>
          
          <div class="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div class="space-y-4">
              <h4 class="font-semibold text-foreground">Application Answers</h4>
              <div v-for="(answer, index) in selectedApplication.answers" :key="index" class="bg-secondary/50 rounded-lg p-4">
                <p class="font-medium text-foreground mb-2">{{ answer.question }}</p>
                <p class="text-foreground">{{ answer.answer }}</p>
              </div>
            </div>
            
            <div class="space-y-4">
              <h4 class="font-semibold text-foreground">Review Decision</h4>
              <div>
                <label class="block text-sm font-medium text-foreground mb-2">Decision</label>
                <select v-model="reviewDecision" class="w-full bg-background border border-border rounded-lg px-3 py-2 text-foreground">
                  <option value="">Select decision...</option>
                  <option value="approved">Approve</option>
                  <option value="rejected">Reject</option>
                  <option value="pending">Request More Info</option>
                </select>
              </div>
              <div>
                <label class="block text-sm font-medium text-foreground mb-2">Review Notes</label>
                <textarea v-model="reviewNote" class="w-full bg-background border border-border rounded-lg px-3 py-2 text-foreground" rows="4" placeholder="Add your review notes..."></textarea>
              </div>
              <div v-if="reviewDecision === 'approved'">
                <label class="block text-sm font-medium text-foreground mb-2">Auto-assign Role</label>
                <div class="flex items-center space-x-2">
                  <input type="checkbox" v-model="autoAssignRole" class="rounded border-border text-primary focus:ring-primary">
                  <span class="text-sm text-foreground">Automatically assign target role</span>
                </div>
              </div>
            </div>
          </div>
        </div>
        
        <div class="p-6 border-t border-border flex justify-end gap-3">
          <button @click="showReviewModal = false" class="px-4 py-2 border border-border rounded-lg text-muted-foreground hover:text-foreground">
            Cancel
          </button>
          <button @click="processApplication" :disabled="!reviewDecision" class="px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 disabled:opacity-50">
            Submit Review
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'
import { useToastStore } from '@/stores/toast'

const toastStore = useToastStore()

const activeTab = ref('forms')
const showFormModal = ref(false)
const showReviewModal = ref(false)
const showBulkReviewModal = ref(false)
const selectedApplication = ref(null)
const selectedFormFilter = ref('')
const selectedStatusFilter = ref('')
const selectedPriorityFilter = ref('')
const historySearchQuery = ref('')
const reviewDecision = ref('')
const reviewNote = ref('')
const autoAssignRole = ref(true)

const applicationForms = ref([
  {
    id: '1',
    title: 'Staff Application',
    description: 'Application to become a server moderator',
    enabled: true,
    targetRole: 'Moderator',
    submissionCount: 23,
    approvalRate: 65,
    requirements: ['Account age 30+ days', 'Level 10+', 'No recent warnings'],
    questions: [
      { id: '1', text: 'Why do you want to become a moderator?', type: 'textarea', required: true, maxLength: 500 },
      { id: '2', text: 'How many hours per day can you dedicate to moderation?', type: 'text', required: true },
      { id: '3', text: 'Have you had any previous moderation experience?', type: 'textarea', required: false, maxLength: 300 },
      { id: '4', text: 'What timezone are you in?', type: 'select', required: true, options: ['UTC', 'EST', 'PST', 'GMT'] },
      { id: '5', text: 'Upload your resume (optional)', type: 'file', required: false }
    ]
  },
  {
    id: '2',
    title: 'Event Organizer',
    description: 'Application to organize community events',
    enabled: true,
    targetRole: 'Event Organizer',
    submissionCount: 8,
    approvalRate: 75,
    requirements: ['Member for 60+ days', 'Active in community'],
    questions: [
      { id: '1', text: 'What type of events would you like to organize?', type: 'textarea', required: true },
      { id: '2', text: 'Describe your event planning experience', type: 'textarea', required: true }
    ]
  }
])

const pendingApplications = ref([
  {
    id: '1',
    applicant: 'JohnDoe',
    formId: '1',
    formTitle: 'Staff Application',
    submittedAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000),
    priority: 'high',
    previousApplications: 0,
    answers: [
      { question: 'Why do you want to become a moderator?', answer: 'I have been an active member of this community for over a year and I want to help maintain a positive environment for everyone.' },
      { question: 'How many hours per day can you dedicate to moderation?', answer: '3-4 hours on weekdays, 6-8 hours on weekends' },
      { question: 'Have you had any previous moderation experience?', answer: 'Yes, I was a moderator on two other Discord servers for about 6 months each.' }
    ],
    attachments: ['resume.pdf', 'references.txt']
  }
])

const processedApplications = ref([
  {
    id: '3',
    applicant: 'ApprovedUser',
    formTitle: 'Staff Application',
    status: 'approved',
    processedAt: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000),
    reviewNote: 'Great experience and dedication shown',
    reviewedBy: 'AdminUser'
  }
])

const analytics = ref({
  totalApplications: 156,
  approvalRate: 68,
  avgReviewTime: 24,
  activeForms: 2,
  totalForms: 3,
  formStats: [
    { name: 'Staff Application', applications: 89 },
    { name: 'Event Organizer', applications: 45 },
    { name: 'Content Creator', applications: 22 }
  ],
  reviewerStats: [
    { name: 'AdminUser', reviewed: 45, avgTime: 18 },
    { name: 'ModeratorA', reviewed: 32, avgTime: 28 },
    { name: 'ModeratorB', reviewed: 28, avgTime: 22 }
  ]
})

const filteredApplications = computed(() => {
  let apps = pendingApplications.value
  if (selectedFormFilter.value) {
    apps = apps.filter(app => app.formId === selectedFormFilter.value)
  }
  if (selectedPriorityFilter.value) {
    apps = apps.filter(app => app.priority === selectedPriorityFilter.value)
  }
  return apps
})

const filteredHistory = computed(() => {
  let history = processedApplications.value
  if (selectedStatusFilter.value) {
    history = history.filter(app => app.status === selectedStatusFilter.value)
  }
  if (historySearchQuery.value) {
    history = history.filter(app => 
      app.applicant.toLowerCase().includes(historySearchQuery.value.toLowerCase())
    )
  }
  return history
})

const getPriorityColor = (priority: string) => {
  switch (priority) {
    case 'high': return 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-300'
    case 'medium': return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-300'
    case 'low': return 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300'
    default: return 'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-300'
  }
}

const getStatusColor = (status: string) => {
  switch (status) {
    case 'approved': return 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300'
    case 'rejected': return 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-300'
    case 'withdrawn': return 'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-300'
    default: return 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300'
  }
}

const formatDate = (date: Date) => {
  return date.toLocaleDateString() + ' ' + date.toLocaleTimeString()
}

const toggleForm = (id: string) => {
  const form = applicationForms.value.find(f => f.id === id)
  if (form) {
    form.enabled = !form.enabled
    toastStore.addToast(`Form "${form.title}" ${form.enabled ? 'enabled' : 'disabled'} successfully!`, 'success')
  }
}

const editForm = (form: any) => {
  console.log('Edit form:', form)
  toastStore.addToast('Edit form functionality would open here', 'info')
}

const previewForm = (form: any) => {
  console.log('Preview form:', form)
  toastStore.addToast('Form preview would open here', 'info')
}

const duplicateForm = (form: any) => {
  const duplicatedForm = {
    ...form,
    id: Date.now().toString(),
    title: `${form.title} (Copy)`,
    submissionCount: 0,
    approvalRate: 0
  }
  applicationForms.value.push(duplicatedForm)
  
  toastStore.addToast(`Form "${form.title}" duplicated successfully!`, 'success')
}

const reviewApplication = (application: any) => {
  selectedApplication.value = application
  showReviewModal.value = true
  reviewDecision.value = ''
  reviewNote.value = ''
}

const processApplication = () => {
  if (selectedApplication.value && reviewDecision.value) {
    // Move from pending to processed
    const application = selectedApplication.value
    const processedApp = {
      ...application,
      status: reviewDecision.value,
      processedAt: new Date(),
      reviewNote: reviewNote.value,
      reviewedBy: 'Current User'
    }
    
    processedApplications.value.unshift(processedApp)
    
    // Remove from pending
    const index = pendingApplications.value.findIndex(app => app.id === application.id)
    if (index !== -1) {
      pendingApplications.value.splice(index, 1)
    }
    
    toastStore.addToast(`Application ${reviewDecision.value} successfully!`, 'success')
    
    showReviewModal.value = false
  }
}
</script>