<template>
  <div class="mb-6">
    <nav class="flex" aria-label="Breadcrumb">
      <ol class="flex items-center space-x-2">
        <li>
          <router-link :to="`/server/${guildId}/dashboard`" class="text-muted-foreground hover:text-foreground transition-colors">
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="mr-1 inline-block">
              <path d="m3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>
              <polyline points="9 22 9 12 15 12 15 22"/>
            </svg>
            Home
          </router-link>
        </li>
        
        <li v-for="(crumb, index) in breadcrumbs" :key="index" class="flex items-center">
          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="text-muted-foreground mx-1">
            <polyline points="9 18 15 12 9 6"/>
          </svg>
          
          <router-link 
            v-if="index < breadcrumbs.length - 1" 
            :to="crumb.path" 
            class="text-muted-foreground hover:text-foreground transition-colors"
          >
            {{ crumb.name }}
          </router-link>
          
          <span v-else class="text-foreground font-medium">
            {{ crumb.name }}
          </span>
        </li>
      </ol>
    </nav>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useRoute } from 'vue-router'

const route = useRoute()

const guildId = computed(() => route.params.guildId as string)

const breadcrumbs = computed(() => {
  const pathSegments = route.path.split('/').filter(Boolean)
  const result = []
  
  // Skip 'server' and guildId
  if (pathSegments.length > 2) {
    let path = ''
    
    for (let i = 2; i < pathSegments.length; i++) {
      path += `/${pathSegments[i]}`
      
      // Format the name (capitalize, replace hyphens with spaces)
      const name = pathSegments[i]
        .split('-')
        .map(word => word.charAt(0).toUpperCase() + word.slice(1))
        .join(' ')
      
      result.push({
        name,
        path: `/server/${guildId.value}${path}`
      })
    }
  }
  
  return result
})
</script>