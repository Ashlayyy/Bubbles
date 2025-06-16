
import { defineStore } from 'pinia'
import { ref } from 'vue'

export interface AppealQuestion {
  id: number
  text: string
}

export const useAppealsStore = defineStore('appeals', () => {
  const questions = ref<AppealQuestion[]>([
    { id: Date.now(), text: 'Why should your punishment be appealed?' },
    { id: Date.now() + 1, text: 'What will you do to avoid this in the future?' }
  ])

  function addQuestion() {
    if (questions.value.length >= 5) {
      // Limit to 5 questions
      return false
    }
    questions.value.push({ id: Date.now(), text: '' })
    return true
  }

  function removeQuestion(id: number) {
    questions.value = questions.value.filter(q => q.id !== id)
  }

  return { questions, addQuestion, removeQuestion }
})
