
<template>
  <div class="space-y-6">
    <div class="bg-card p-6 rounded-lg border border-border">
      <h2 class="text-xl font-semibold text-foreground mb-4">Appeal Form Preview</h2>
      <p class="text-muted-foreground mb-4">This is how the appeal form will look to your users. The questions below are based on your current setup.</p>
      <div class="border border-dashed border-border rounded-lg p-8 bg-background/50">
        <div class="max-w-md mx-auto">
          <h3 class="text-lg font-bold text-center text-foreground">Submit an Appeal</h3>
          <p class="text-sm text-muted-foreground text-center mt-1 mb-6">Please fill out the form below to submit your appeal. Be honest and provide as much detail as possible.</p>
          <form class="space-y-4">
            <div>
              <label for="user-id" class="block text-sm font-medium text-foreground mb-1">Your Discord User ID</label>
              <input type="text" id="user-id" class="w-full bg-input border border-border rounded-md px-3 py-2 text-foreground placeholder-muted-foreground focus:ring-2 focus:ring-primary outline-none" placeholder="e.g., 123456789012345678" disabled value="123456789012345678">
            </div>
            
            <div v-for="(question, index) in appealsStore.questions" :key="question.id">
              <label :for="`question-${question.id}`" class="block text-sm font-medium text-foreground mb-1">{{ question.text }}</label>
              <textarea :id="`question-${question.id}`" rows="3" class="w-full bg-input border border-border rounded-md px-3 py-2 text-foreground placeholder-muted-foreground focus:ring-2 focus:ring-primary outline-none" :placeholder="`Your answer...`"></textarea>
            </div>

             <div>
              <label for="evidence" class="block text-sm font-medium text-foreground mb-1">Evidence (optional)</label>
              <p class="text-xs text-muted-foreground mb-2">You can provide links to screenshots or videos.</p>
              <input type="text" id="evidence" class="w-full bg-input border border-border rounded-md px-3 py-2 text-foreground placeholder-muted-foreground focus:ring-2 focus:ring-primary outline-none" placeholder="https://imgur.com/your-image">
            </div>
            <button type="button" class="w-full bg-primary text-primary-foreground font-semibold py-2 px-4 rounded-md hover:bg-primary/90 transition-colors">
              Submit Appeal
            </button>
          </form>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { useAppealsStore } from '@/stores/appeals';

const appealsStore = useAppealsStore();
</script>
