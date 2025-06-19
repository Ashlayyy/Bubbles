<template>
  <div class="space-y-6">
    <div class="flex justify-between items-center">
      <h2 class="text-xl font-semibold text-foreground">Knowledge Base</h2>
      <button @click="showCreateModal = true" class="bg-primary hover:bg-primary/90 text-primary-foreground px-4 py-2 rounded-lg transition-colors">
        Create Article
      </button>
    </div>

    <!-- Search and Categories -->
    <div class="flex flex-col sm:flex-row gap-4">
      <div class="flex-1">
        <div class="relative">
          <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground">
            <circle cx="11" cy="11" r="8"/>
            <path d="m21 21-4.35-4.35"/>
          </svg>
          <input
            v-model="searchQuery"
            type="text"
            placeholder="Search articles..."
            class="w-full pl-10 pr-4 py-2 bg-background border border-border rounded-lg text-foreground"
          >
        </div>
      </div>
      <select v-model="categoryFilter" class="bg-background border border-border rounded-lg px-3 py-2 text-foreground">
        <option value="">All Categories</option>
        <option v-for="category in categories" :key="category.id" :value="category.id">
          {{ category.name }}
        </option>
      </select>
    </div>

    <!-- Articles Grid -->
    <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
      <div v-for="article in filteredArticles" :key="article.id" class="bg-card border border-border rounded-lg overflow-hidden">
        <div class="p-6">
          <div class="flex items-start justify-between mb-4">
            <div>
              <h3 class="font-semibold text-foreground">{{ article.title }}</h3>
              <div class="flex items-center gap-2 mt-1">
                <span class="text-xs px-2 py-1 rounded-full bg-primary/10 text-primary">
                  {{ getCategoryName(article.categoryId) }}
                </span>
                <span class="text-xs text-muted-foreground">
                  {{ formatDate(article.updatedAt) }}
                </span>
              </div>
            </div>
            <div class="flex items-center gap-2">
              <button @click="editArticle(article)" class="text-muted-foreground hover:text-foreground">
                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                  <path d="M17 3a2.828 2.828 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5L17 3z"/>
                </svg>
              </button>
              <button @click="deleteArticle(article.id)" class="text-muted-foreground hover:text-destructive">
                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                  <path d="M3 6h18"/>
                  <path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"/>
                  <path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"/>
                </svg>
              </button>
            </div>
          </div>
          
          <p class="text-sm text-muted-foreground mb-4 line-clamp-3">{{ article.summary }}</p>
          
          <button @click="viewArticle(article)" class="text-primary hover:text-primary/80 text-sm">
            Read More
          </button>
        </div>
      </div>
    </div>

    <!-- Empty State -->
    <div v-if="filteredArticles.length === 0" class="text-center py-12">
      <div class="text-muted-foreground">
        <svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="mx-auto mb-4 opacity-50">
          <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
          <polyline points="14,2 14,8 20,8"/>
          <line x1="16" y1="13" x2="8" y2="13"/>
          <line x1="16" y1="17" x2="8" y2="17"/>
          <polyline points="10,9 9,9 8,9"/>
        </svg>
        <p class="text-lg font-medium">No articles found</p>
        <p class="text-sm">Try adjusting your search or create a new article</p>
      </div>
    </div>

    <!-- Create/Edit Modal -->
    <div v-if="showCreateModal" class="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div class="bg-card border border-border rounded-lg w-full max-w-2xl max-h-[90vh] overflow-y-auto m-4">
        <div class="p-6 border-b border-border">
          <h3 class="text-lg font-semibold text-foreground">
            {{ editingArticle ? 'Edit Article' : 'Create New Article' }}
          </h3>
        </div>
        
        <form @submit.prevent="saveArticle" class="p-6 space-y-4">
          <div>
            <label class="block text-sm font-medium text-foreground mb-2">Title</label>
            <input v-model="articleForm.title" type="text" class="w-full bg-background border border-border rounded-lg px-3 py-2 text-foreground" required>
          </div>
          
          <div>
            <label class="block text-sm font-medium text-foreground mb-2">Category</label>
            <select v-model="articleForm.categoryId" class="w-full bg-background border border-border rounded-lg px-3 py-2 text-foreground" required>
              <option value="">Select a category</option>
              <option v-for="category in categories" :key="category.id" :value="category.id">
                {{ category.name }}
              </option>
            </select>
          </div>
          
          <div>
            <label class="block text-sm font-medium text-foreground mb-2">Summary</label>
            <textarea v-model="articleForm.summary" rows="2" class="w-full bg-background border border-border rounded-lg px-3 py-2 text-foreground" required></textarea>
          </div>
          
          <div>
            <label class="block text-sm font-medium text-foreground mb-2">Content</label>
            <textarea v-model="articleForm.content" rows="10" class="w-full bg-background border border-border rounded-lg px-3 py-2 text-foreground" required></textarea>
            <p class="text-xs text-muted-foreground mt-1">Supports Markdown formatting</p>
          </div>
          
          <div>
            <label class="block text-sm font-medium text-foreground mb-2">Tags (comma separated)</label>
            <input v-model="articleForm.tagsInput" type="text" class="w-full bg-background border border-border rounded-lg px-3 py-2 text-foreground" placeholder="e.g., rules, moderation, setup">
          </div>
          
          <div class="flex justify-end space-x-3 pt-4">
            <button type="button" @click="showCreateModal = false" class="px-4 py-2 border border-border rounded-lg text-muted-foreground hover:text-foreground">
              Cancel
            </button>
            <button type="submit" class="px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90">
              {{ editingArticle ? 'Update' : 'Create' }}
            </button>
          </div>
        </form>
      </div>
    </div>

    <!-- View Article Modal -->
    <div v-if="showViewModal && selectedArticle" class="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div class="bg-card border border-border rounded-lg w-full max-w-3xl max-h-[90vh] overflow-y-auto m-4">
        <div class="p-6 border-b border-border flex justify-between items-center">
          <div>
            <h3 class="text-xl font-semibold text-foreground">{{ selectedArticle.title }}</h3>
            <div class="flex items-center gap-2 mt-1">
              <span class="text-xs px-2 py-1 rounded-full bg-primary/10 text-primary">
                {{ getCategoryName(selectedArticle.categoryId) }}
              </span>
              <span class="text-xs text-muted-foreground">
                Updated {{ formatDate(selectedArticle.updatedAt) }}
              </span>
            </div>
          </div>
          <button @click="showViewModal = false" class="text-muted-foreground hover:text-foreground">
            <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <path d="m18 6-12 12"/>
              <path d="m6 6 12 12"/>
            </svg>
          </button>
        </div>
        
        <div class="p-6">
          <div class="prose dark:prose-invert max-w-none">
            <p class="text-foreground font-medium">{{ selectedArticle.summary }}</p>
            <div class="mt-4 text-foreground whitespace-pre-wrap">{{ selectedArticle.content }}</div>
          </div>
          
          <div class="mt-6 pt-6 border-t border-border">
            <div class="flex flex-wrap gap-2">
              <span v-for="tag in selectedArticle.tags" :key="tag" class="px-2 py-1 rounded-full bg-secondary text-secondary-foreground text-xs">
                {{ tag }}
              </span>
            </div>
          </div>
        </div>
        
        <div class="p-6 border-t border-border flex justify-between items-center">
          <div class="text-sm text-muted-foreground">
            <span>Created by {{ selectedArticle.author }}</span>
            <span class="mx-2">•</span>
            <span>{{ selectedArticle.views }} views</span>
          </div>
          <div class="flex items-center gap-2">
            <button @click="editArticle(selectedArticle)" class="px-3 py-2 rounded-lg text-sm font-medium bg-secondary text-secondary-foreground hover:bg-secondary/80 transition-colors">
              Edit
            </button>
            <button @click="copyArticleLink(selectedArticle)" class="px-3 py-2 rounded-lg text-sm font-medium bg-secondary text-secondary-foreground hover:bg-secondary/80 transition-colors">
              Copy Link
            </button>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, reactive } from 'vue'
import { useToastStore } from '@/stores/toast'

const toastStore = useToastStore()

interface Category {
  id: string
  name: string
}

interface Article {
  id: string
  title: string
  categoryId: string
  summary: string
  content: string
  tags: string[]
  author: string
  createdAt: Date
  updatedAt: Date
  views: number
}

// Modals
const showCreateModal = ref(false)
const showViewModal = ref(false)

// Form data
const articleForm = reactive({
  title: '',
  categoryId: '',
  summary: '',
  content: '',
  tagsInput: ''
})

// Editing state
const editingArticle = ref<Article | null>(null)
const selectedArticle = ref<Article | null>(null)

// Filters
const searchQuery = ref('')
const categoryFilter = ref('')

// Sample data
const categories = ref<Category[]>([
  { id: 'rules', name: 'Server Rules' },
  { id: 'guides', name: 'Guides' },
  { id: 'faq', name: 'FAQ' },
  { id: 'commands', name: 'Bot Commands' }
])

const articles = ref<Article[]>([
  {
    id: '1',
    title: 'Server Rules',
    categoryId: 'rules',
    summary: 'A comprehensive guide to our server rules and guidelines.',
    content: `# Server Rules

1. **Be respectful to all members**
   - No harassment, hate speech, or bullying
   - Treat others how you want to be treated

2. **No spam or excessive caps**
   - Don't send repeated messages
   - Avoid using ALL CAPS excessively

3. **Keep discussions in appropriate channels**
   - Use channels for their intended purpose
   - Check channel descriptions for guidance

4. **No NSFW content**
   - Keep all content PG-13
   - This includes text, images, and links

5. **Follow Discord Terms of Service**
   - [Discord ToS](https://discord.com/terms)
   - [Discord Community Guidelines](https://discord.com/guidelines)`,
    tags: ['rules', 'guidelines', 'moderation'],
    author: 'ServerAdmin',
    createdAt: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
    updatedAt: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000),
    views: 1245
  },
  {
    id: '2',
    title: 'How to Use Bot Commands',
    categoryId: 'guides',
    summary: 'Learn how to use the various commands available in our server.',
    content: `# Bot Commands Guide

## Basic Commands

- \`!help\` - Shows a list of available commands
- \`!ping\` - Checks the bot's response time
- \`!info\` - Displays information about the server

## Moderation Commands

- \`!warn @user [reason]\` - Warns a user
- \`!mute @user [duration] [reason]\` - Temporarily mutes a user
- \`!kick @user [reason]\` - Kicks a user from the server
- \`!ban @user [reason]\` - Bans a user from the server

## Fun Commands

- \`!roll\` - Rolls a random number
- \`!8ball [question]\` - Ask the magic 8-ball a question
- \`!quote\` - Shows a random quote

## Music Commands

- \`!play [song]\` - Plays a song
- \`!skip\` - Skips the current song
- \`!queue\` - Shows the current queue
- \`!stop\` - Stops playing and clears the queue`,
    tags: ['commands', 'bot', 'help'],
    author: 'BotMaster',
    createdAt: new Date(Date.now() - 14 * 24 * 60 * 60 * 1000),
    updatedAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000),
    views: 876
  },
  {
    id: '3',
    title: 'Frequently Asked Questions',
    categoryId: 'faq',
    summary: 'Answers to common questions about our server and community.',
    content: `# Frequently Asked Questions

## How do I get roles?

You can get roles by reacting to messages in the #roles channel or by leveling up in the server.

## How do I report someone?

If you need to report a user for breaking the rules, please use the \`!report @user [reason]\` command or contact a moderator directly.

## How do I level up?

You gain XP by chatting in the server. Each message gives you a small amount of XP, with a cooldown to prevent spam.

## Can I advertise my server/content?

Advertising is only allowed in the #self-promotion channel and only if you have the "Active Member" role.

## How do I become a moderator?

We occasionally open applications for new moderators. Keep an eye on the #announcements channel for opportunities.`,
    tags: ['faq', 'help', 'questions'],
    author: 'HelpfulUser',
    createdAt: new Date(Date.now() - 21 * 24 * 60 * 60 * 1000),
    updatedAt: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000),
    views: 1032
  }
])

// Computed properties
const filteredArticles = computed(() => {
  let filtered = articles.value
  
  if (searchQuery.value) {
    const search = searchQuery.value.toLowerCase()
    filtered = filtered.filter(article => 
      article.title.toLowerCase().includes(search) ||
      article.summary.toLowerCase().includes(search) ||
      article.content.toLowerCase().includes(search) ||
      article.tags.some(tag => tag.toLowerCase().includes(search))
    )
  }
  
  if (categoryFilter.value) {
    filtered = filtered.filter(article => article.categoryId === categoryFilter.value)
  }
  
  return filtered.sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime())
})

// Methods
const formatDate = (date: Date) => {
  return date.toLocaleDateString()
}

const getCategoryName = (categoryId: string) => {
  const category = categories.value.find(c => c.id === categoryId)
  return category ? category.name : 'Uncategorized'
}

const viewArticle = (article: Article) => {
  selectedArticle.value = article
  showViewModal.value = true
  
  // Increment view count
  const index = articles.value.findIndex(a => a.id === article.id)
  if (index !== -1) {
    articles.value[index].views++
  }
}

const editArticle = (article: Article) => {
  editingArticle.value = article
  Object.assign(articleForm, {
    title: article.title,
    categoryId: article.categoryId,
    summary: article.summary,
    content: article.content,
    tagsInput: article.tags.join(', ')
  })
  showCreateModal.value = true
  showViewModal.value = false
}

const deleteArticle = (articleId: string) => {
  if (confirm('Are you sure you want to delete this article?')) {
    const index = articles.value.findIndex(a => a.id === articleId)
    if (index !== -1) {
      articles.value.splice(index, 1)
      toastStore.addToast('Article deleted successfully!', 'success')
    }
  }
}

const saveArticle = () => {
  const tags = articleForm.tagsInput
    .split(',')
    .map(tag => tag.trim())
    .filter(tag => tag.length > 0)
  
  if (editingArticle.value) {
    // Update existing article
    const index = articles.value.findIndex(a => a.id === editingArticle.value!.id)
    if (index !== -1) {
      articles.value[index] = {
        ...articles.value[index],
        title: articleForm.title,
        categoryId: articleForm.categoryId,
        summary: articleForm.summary,
        content: articleForm.content,
        tags,
        updatedAt: new Date()
      }
      toastStore.addToast('Article updated successfully!', 'success')
    }
  } else {
    // Create new article
    const newArticle: Article = {
      id: Date.now().toString(),
      title: articleForm.title,
      categoryId: articleForm.categoryId,
      summary: articleForm.summary,
      content: articleForm.content,
      tags,
      author: 'CurrentUser',
      createdAt: new Date(),
      updatedAt: new Date(),
      views: 0
    }
    articles.value.push(newArticle)
    toastStore.addToast('Article created successfully!', 'success')
  }
  
  showCreateModal.value = false
  editingArticle.value = null
  
  // Reset form
  Object.assign(articleForm, {
    title: '',
    categoryId: '',
    summary: '',
    content: '',
    tagsInput: ''
  })
}

const copyArticleLink = (article: Article) => {
  // In a real app, this would copy a link to the article
  navigator.clipboard.writeText(`https://example.com/kb/article/${article.id}`)
  toastStore.addToast('Article link copied to clipboard', 'success')
}
</script>