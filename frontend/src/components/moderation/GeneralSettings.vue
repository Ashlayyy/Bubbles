
<template>
  <div class="bg-card border border-border rounded-xl">
    <div class="p-6 border-b border-border">
      <h2 class="text-xl font-semibold text-card-foreground">General Settings</h2>
      <p class="text-muted-foreground mt-1">Configure general moderation settings.</p>
    </div>
    <div class="p-6 space-y-6">
      <div>
        <label for="max-messages-cleared" class="block text-sm font-medium text-muted-foreground mb-2">Max Messages Cleared</label>
        <input type="number" id="max-messages-cleared" :value="modelValue" @input="$emit('update:modelValue', Number(($event.target as HTMLInputElement).value))" class="w-full bg-input border border-input rounded-lg px-4 py-2 text-foreground focus:ring-ring focus:border-ring" placeholder="100">
        <p class="mt-2 text-xs text-muted-foreground/80">The maximum amount of messages that can be cleared at once with the clear command.</p>
      </div>
    </div>
    <div class="p-6 bg-secondary/50 border-t border-border rounded-b-xl flex justify-end">
      <button @click="$emit('save')" class="bg-primary hover:bg-primary/90 text-primary-foreground font-semibold px-4 py-2 rounded-lg transition-colors">Save Changes</button>
    </div>
  </div>
</template>

<script setup lang="ts">
defineProps<{
  modelValue: number;
}>();

defineEmits<{
  (e: 'update:modelValue', value: number): void;
  (e: 'save'): void;
}>();
</script>
