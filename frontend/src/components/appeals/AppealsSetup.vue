
<template>
  <div class="space-y-6">
    <div class="bg-card p-6 rounded-lg border border-border">
      <div class="flex justify-between items-start">
        <div>
          <h2 class="text-xl font-semibold text-foreground mb-2">Appeal Questions</h2>
          <p class="text-muted-foreground">Add custom questions for your appeal form. Users will be required to answer these.</p>
        </div>
        <button
          @click="saveSettings"
          class="bg-primary text-primary-foreground font-semibold py-2 px-4 rounded-md hover:bg-primary/90 transition-colors"
        >
          Save Changes
        </button>
      </div>

      <div class="space-y-3 mt-6">
        <div v-for="(question, index) in appealsStore.questions" :key="question.id" class="flex items-center space-x-3">
          <span class="text-muted-foreground font-medium">#{{ index + 1 }}</span>
          <input
            type="text"
            v-model="question.text"
            class="w-full bg-input border border-border rounded-md px-3 py-2 text-foreground placeholder-muted-foreground focus:ring-2 focus:ring-primary outline-none"
            placeholder="Enter your question"
          >
          <button @click="appealsStore.removeQuestion(question.id)" class="p-2 rounded-md text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors" aria-label="Remove question">
            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 6h18"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/><line x1="10" x2="10" y1="11" y2="17"/><line x1="14" x2="14" y1="11" y2="17"/></svg>
          </button>
        </div>
      </div>

      <button
        @click="handleAddQuestion"
        class="mt-4 bg-secondary text-secondary-foreground font-medium py-2 px-3 rounded-md hover:bg-secondary/80 transition-colors text-sm"
      >
        + Add Question
      </button>
    </div>

    <div class="bg-card p-6 rounded-lg border border-border">
      <h2 class="text-xl font-semibold text-foreground mb-4">Available Variables</h2>
      <p class="text-muted-foreground mb-4">You can use these variables in your questions. They will be replaced with the actual values for the user.</p>
      <div class="space-y-2 text-sm">
        <div class="flex items-center">
          <code class="bg-muted text-muted-foreground font-mono rounded px-1.5 py-0.5 mr-2">[[.USER]]</code>
          <span>- The user's Discord username and discriminator (e.g., ExampleUser#1234).</span>
        </div>
        <div class="flex items-center">
          <code class="bg-muted text-muted-foreground font-mono rounded px-1.5 py-0.5 mr-2">[[.USER.ID]]</code>
          <span>- The user's Discord ID.</span>
        </div>
        <div class="flex items-center">
          <code class="bg-muted text-muted-foreground font-mono rounded px-1.5 py-0.5 mr-2">[[.USER.NAME]]</code>
          <span>- The user's Discord username.</span>
        </div>
        <div class="flex items-center">
          <code class="bg-muted text-muted-foreground font-mono rounded px-1.5 py-0.5 mr-2">[[.SERVER.NAME]]</code>
          <span>- The name of this server.</span>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { useAppealsStore } from '@/stores/appeals';
import { useToastStore } from '@/stores/toast';

const appealsStore = useAppealsStore();
const toastStore = useToastStore();

const handleAddQuestion = () => {
  const success = appealsStore.addQuestion();
  if (!success) {
    toastStore.addToast({ message: "You can add a maximum of 5 questions.", type: 'error' });
  }
};

const saveSettings = () => {
  // In a real app, this would make an API call to save the settings.
  console.log("Saving appeal settings:", appealsStore.questions);
  toastStore.addToast({ message: "Appeal settings saved successfully!", type: 'success' });
};
</script>
