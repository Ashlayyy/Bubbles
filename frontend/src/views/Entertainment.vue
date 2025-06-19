<template>
  <div>
    <h1 class="text-3xl font-bold text-foreground mb-6">Entertainment & Games</h1>

    <!-- Tabs -->
    <div class="mb-6 border-b border-border">
      <nav class="-mb-px flex space-x-6">
        <button
          @click="activeTab = 'games'"
          :class="[
            'py-3 px-1 border-b-2 font-medium text-sm transition-colors',
            activeTab === 'games'
              ? 'border-primary text-primary'
              : 'border-transparent text-muted-foreground hover:text-foreground hover:border-muted-foreground'
          ]"
        >
          Mini Games
        </button>
        <button
          @click="activeTab = 'events'"
          :class="[
            'py-3 px-1 border-b-2 font-medium text-sm transition-colors',
            activeTab === 'events'
              ? 'border-primary text-primary'
              : 'border-transparent text-muted-foreground hover:text-foreground hover:border-muted-foreground'
          ]"
        >
          Events
        </button>
        <button
          @click="activeTab = 'giveaways'"
          :class="[
            'py-3 px-1 border-b-2 font-medium text-sm transition-colors',
            activeTab === 'giveaways'
              ? 'border-primary text-primary'
              : 'border-transparent text-muted-foreground hover:text-foreground hover:border-muted-foreground'
          ]"
        >
          Giveaways
        </button>
        <button
          @click="activeTab = 'polls'"
          :class="[
            'py-3 px-1 border-b-2 font-medium text-sm transition-colors',
            activeTab === 'polls'
              ? 'border-primary text-primary'
              : 'border-transparent text-muted-foreground hover:text-foreground hover:border-muted-foreground'
          ]"
        >
          Polls
        </button>
      </nav>
    </div>

    <!-- Mini Games -->
    <div v-if="activeTab === 'games'" class="space-y-6">
      <div class="flex justify-between items-center">
        <h2 class="text-xl font-semibold text-foreground">Mini Games</h2>
        <button @click="showGameModal = true" class="bg-primary hover:bg-primary/90 text-primary-foreground px-4 py-2 rounded-lg transition-colors">
          Create Game
        </button>
      </div>

      <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        <div v-for="game in miniGames" :key="game.id" class="bg-card border border-border rounded-lg p-6">
          <div class="flex items-center gap-3 mb-4">
            <div class="text-3xl">{{ game.emoji }}</div>
            <div>
              <h3 class="font-semibold text-foreground">{{ game.name }}</h3>
              <p class="text-sm text-muted-foreground">{{ game.description }}</p>
            </div>
          </div>
          
          <div class="space-y-2 text-sm mb-4">
            <div class="flex justify-between">
              <span class="text-muted-foreground">Players:</span>
              <span class="text-foreground">{{ game.playerCount }}</span>
            </div>
            <div class="flex justify-between">
              <span class="text-muted-foreground">Games Played:</span>
              <span class="text-foreground">{{ game.gamesPlayed }}</span>
            </div>
            <div class="flex justify-between">
              <span class="text-muted-foreground">Status:</span>
              <span :class="game.enabled ? 'text-green-500' : 'text-red-500'">
                {{ game.enabled ? 'Active' : 'Disabled' }}
              </span>
            </div>
          </div>
          
          <div class="flex gap-2">
            <button @click="startGame(game)" class="flex-1 bg-primary hover:bg-primary/90 text-primary-foreground py-2 px-3 rounded text-sm transition-colors">
              Start Game
            </button>
            <button @click="toggleGame(game.id)" class="text-muted-foreground hover:text-foreground p-2">
              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <path d="M12 2v20M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/>
              </svg>
            </button>
          </div>
        </div>
      </div>
    </div>

    <!-- Events -->
    <div v-if="activeTab === 'events'" class="space-y-6">
      <div class="flex justify-between items-center">
        <h2 class="text-xl font-semibold text-foreground">Scheduled Events</h2>
        <button @click="showEventModal = true" class="bg-primary hover:bg-primary/90 text-primary-foreground px-4 py-2 rounded-lg transition-colors">
          Create Event
        </button>
      </div>

      <div class="space-y-4">
        <div v-for="event in scheduledEvents" :key="event.id" class="bg-card border border-border rounded-lg p-6">
          <div class="flex items-start justify-between mb-4">
            <div class="flex items-center gap-4">
              <div class="text-4xl">{{ event.emoji }}</div>
              <div>
                <h3 class="font-semibold text-foreground text-lg">{{ event.title }}</h3>
                <p class="text-muted-foreground">{{ event.description }}</p>
              </div>
            </div>
            <span :class="getEventStatusColor(event.status)" class="px-3 py-1 rounded-full text-xs font-medium">
              {{ event.status }}
            </span>
          </div>
          
          <div class="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm mb-4">
            <div>
              <span class="text-muted-foreground">Date:</span>
              <span class="ml-2 text-foreground">{{ formatEventDate(event.date) }}</span>
            </div>
            <div>
              <span class="text-muted-foreground">Duration:</span>
              <span class="ml-2 text-foreground">{{ event.duration }}</span>
            </div>
            <div>
              <span class="text-muted-foreground">Participants:</span>
              <span class="ml-2 text-foreground">{{ event.participants }}</span>
            </div>
            <div>
              <span class="text-muted-foreground">Channel:</span>
              <span class="ml-2 text-foreground">#{{ event.channel }}</span>
            </div>
          </div>
          
          <div class="flex gap-2">
            <button @click="editEvent(event)" class="text-primary hover:text-primary/80 text-sm">
              Edit
            </button>
            <button @click="cancelEvent(event.id)" class="text-red-500 hover:text-red-600 text-sm">
              Cancel
            </button>
          </div>
        </div>
      </div>
    </div>

    <!-- Giveaways -->
    <div v-if="activeTab === 'giveaways'" class="space-y-6">
      <div class="flex justify-between items-center">
        <h2 class="text-xl font-semibold text-foreground">Giveaways</h2>
        <button @click="showGiveawayModal = true" class="bg-primary hover:bg-primary/90 text-primary-foreground px-4 py-2 rounded-lg transition-colors">
          Create Giveaway
        </button>
      </div>

      <div class="space-y-4">
        <div v-for="giveaway in giveaways" :key="giveaway.id" class="bg-card border border-border rounded-lg p-6">
          <div class="flex items-start justify-between mb-4">
            <div>
              <h3 class="font-semibold text-foreground text-lg">{{ giveaway.prize }}</h3>
              <p class="text-muted-foreground">{{ giveaway.description }}</p>
            </div>
            <span :class="getGiveawayStatusColor(giveaway.status)" class="px-3 py-1 rounded-full text-xs font-medium">
              {{ giveaway.status }}
            </span>
          </div>
          
          <div class="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm mb-4">
            <div>
              <span class="text-muted-foreground">Ends:</span>
              <span class="ml-2 text-foreground">{{ formatDate(giveaway.endsAt) }}</span>
            </div>
            <div>
              <span class="text-muted-foreground">Entries:</span>
              <span class="ml-2 text-foreground">{{ giveaway.entries }}</span>
            </div>
            <div>
              <span class="text-muted-foreground">Winners:</span>
              <span class="ml-2 text-foreground">{{ giveaway.winnerCount }}</span>
            </div>
            <div>
              <span class="text-muted-foreground">Channel:</span>
              <span class="ml-2 text-foreground">#{{ giveaway.channel }}</span>
            </div>
          </div>
          
          <div v-if="giveaway.requirements.length > 0" class="mb-4">
            <p class="text-sm font-medium text-foreground mb-2">Requirements:</p>
            <div class="flex flex-wrap gap-2">
              <span v-for="req in giveaway.requirements" :key="req" class="bg-secondary text-secondary-foreground px-2 py-1 rounded text-xs">
                {{ req }}
              </span>
            </div>
          </div>
          
          <div class="flex gap-2">
            <button v-if="giveaway.status === 'active'" @click="endGiveaway(giveaway.id)" class="bg-green-600 hover:bg-green-700 text-white px-3 py-1 rounded text-sm">
              End Early
            </button>
            <button @click="editGiveaway(giveaway)" class="text-primary hover:text-primary/80 text-sm">
              Edit
            </button>
            <button @click="deleteGiveaway(giveaway.id)" class="text-red-500 hover:text-red-600 text-sm">
              Delete
            </button>
          </div>
        </div>
      </div>
    </div>

    <!-- Polls -->
    <div v-if="activeTab === 'polls'" class="space-y-6">
      <div class="flex justify-between items-center">
        <h2 class="text-xl font-semibold text-foreground">Polls</h2>
        <button @click="showPollModal = true" class="bg-primary hover:bg-primary/90 text-primary-foreground px-4 py-2 rounded-lg transition-colors">
          Create Poll
        </button>
      </div>

      <div class="space-y-4">
        <div v-for="poll in polls" :key="poll.id" class="bg-card border border-border rounded-lg p-6">
          <div class="flex items-start justify-between mb-4">
            <div>
              <h3 class="font-semibold text-foreground text-lg">{{ poll.question }}</h3>
              <p class="text-muted-foreground">{{ poll.description }}</p>
            </div>
            <span :class="poll.active ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300' : 'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-300'" 
                  class="px-3 py-1 rounded-full text-xs font-medium">
              {{ poll.active ? 'Active' : 'Ended' }}
            </span>
          </div>
          
          <div class="space-y-3 mb-4">
            <div v-for="option in poll.options" :key="option.id" class="flex items-center justify-between">
              <div class="flex items-center gap-3 flex-1">
                <span class="text-foreground">{{ option.text }}</span>
                <div class="flex-1 bg-secondary rounded-full h-2 max-w-xs">
                  <div class="bg-primary h-2 rounded-full" :style="{ width: `${(option.votes / poll.totalVotes) * 100}%` }"></div>
                </div>
              </div>
              <span class="text-sm text-muted-foreground ml-3">{{ option.votes }} votes</span>
            </div>
          </div>
          
          <div class="text-sm text-muted-foreground mb-4">
            Total votes: {{ poll.totalVotes }} • 
            <span v-if="poll.active">Ends {{ formatDate(poll.endsAt) }}</span>
            <span v-else>Ended {{ formatDate(poll.endsAt) }}</span>
          </div>
          
          <div class="flex gap-2">
            <button v-if="poll.active" @click="endPoll(poll.id)" class="bg-red-600 hover:bg-red-700 text-white px-3 py-1 rounded text-sm">
              End Poll
            </button>
            <button @click="viewPollResults(poll)" class="text-primary hover:text-primary/80 text-sm">
              View Results
            </button>
            <button @click="deletePoll(poll.id)" class="text-red-500 hover:text-red-600 text-sm">
              Delete
            </button>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { useToastStore } from '@/stores/toast'

const toastStore = useToastStore()

const activeTab = ref('games')
const showGameModal = ref(false)
const showEventModal = ref(false)
const showGiveawayModal = ref(false)
const showPollModal = ref(false)

const miniGames = ref([
  {
    id: '1',
    name: 'Trivia Quiz',
    description: 'Test your knowledge with random questions',
    emoji: '🧠',
    enabled: true,
    playerCount: 156,
    gamesPlayed: 89
  },
  {
    id: '2',
    name: 'Word Chain',
    description: 'Create words that start with the last letter',
    emoji: '🔤',
    enabled: true,
    playerCount: 78,
    gamesPlayed: 45
  },
  {
    id: '3',
    name: 'Number Guessing',
    description: 'Guess the random number between 1-100',
    emoji: '🔢',
    enabled: false,
    playerCount: 23,
    gamesPlayed: 12
  }
])

const scheduledEvents = ref([
  {
    id: '1',
    title: 'Gaming Tournament',
    description: 'Weekly gaming competition with prizes',
    emoji: '🎮',
    date: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000),
    duration: '2 hours',
    participants: 45,
    channel: 'events',
    status: 'upcoming'
  },
  {
    id: '2',
    title: 'Movie Night',
    description: 'Community movie watching session',
    emoji: '🎬',
    date: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
    duration: '3 hours',
    participants: 23,
    channel: 'movie-night',
    status: 'upcoming'
  }
])

const giveaways = ref([
  {
    id: '1',
    prize: 'Discord Nitro (1 Month)',
    description: 'Free Discord Nitro for one lucky winner',
    status: 'active',
    endsAt: new Date(Date.now() + 5 * 24 * 60 * 60 * 1000),
    entries: 234,
    winnerCount: 1,
    channel: 'giveaways',
    requirements: ['Member for 7+ days', 'Level 5+']
  },
  {
    id: '2',
    prize: 'Steam Game Key',
    description: '$50 Steam game of your choice',
    status: 'ended',
    endsAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000),
    entries: 156,
    winnerCount: 1,
    channel: 'giveaways',
    requirements: ['Boost the server']
  }
])

const polls = ref([
  {
    id: '1',
    question: 'What game should we play next?',
    description: 'Vote for the next community game night',
    active: true,
    endsAt: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000),
    totalVotes: 89,
    options: [
      { id: '1', text: 'Among Us', votes: 34 },
      { id: '2', text: 'Minecraft', votes: 28 },
      { id: '3', text: 'Fall Guys', votes: 15 },
      { id: '4', text: 'Valorant', votes: 12 }
    ]
  },
  {
    id: '2',
    question: 'Best time for events?',
    description: 'Help us schedule events at the best time',
    active: false,
    endsAt: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000),
    totalVotes: 67,
    options: [
      { id: '1', text: 'Morning (9-12 PM)', votes: 12 },
      { id: '2', text: 'Afternoon (12-6 PM)', votes: 23 },
      { id: '3', text: 'Evening (6-9 PM)', votes: 32 }
    ]
  }
])

const formatDate = (date: Date) => {
  return date.toLocaleDateString() + ' ' + date.toLocaleTimeString()
}

const formatEventDate = (date: Date) => {
  return date.toLocaleDateString()
}

const getEventStatusColor = (status: string) => {
  switch (status) {
    case 'upcoming': return 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300'
    case 'active': return 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300'
    case 'ended': return 'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-300'
    default: return 'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-300'
  }
}

const getGiveawayStatusColor = (status: string) => {
  switch (status) {
    case 'active': return 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300'
    case 'ended': return 'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-300'
    default: return 'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-300'
  }
}

const toggleGame = (id: string) => {
  const game = miniGames.value.find(g => g.id === id)
  if (game) {
    game.enabled = !game.enabled
    toastStore.addToast(`Game "${game.name}" ${game.enabled ? 'enabled' : 'disabled'}!`, 'success')
  }
}

const startGame = (game: any) => {
  console.log('Starting game:', game.name)
  toastStore.addToast(`Starting ${game.name}...`, 'info')
}

const editEvent = (event: any) => {
  console.log('Edit event:', event)
  toastStore.addToast('Edit event functionality would open here', 'info')
}

const cancelEvent = (id: string) => {
  if (confirm('Are you sure you want to cancel this event?')) {
    const eventIndex = scheduledEvents.value.findIndex(e => e.id === id)
    if (eventIndex !== -1) {
      const eventName = scheduledEvents.value[eventIndex].title
      scheduledEvents.value.splice(eventIndex, 1)
      
      toastStore.addToast(`Event "${eventName}" cancelled successfully!`, 'success')
    }
  }
}

const endGiveaway = (id: string) => {
  const giveaway = giveaways.value.find(g => g.id === id)
  if (giveaway) {
    giveaway.status = 'ended'
    toastStore.addToast(`Giveaway "${giveaway.prize}" ended successfully!`, 'success')
  }
}

const editGiveaway = (giveaway: any) => {
  console.log('Edit giveaway:', giveaway)
  toastStore.addToast('Edit giveaway functionality would open here', 'info')
}

const deleteGiveaway = (id: string) => {
  if (confirm('Are you sure you want to delete this giveaway?')) {
    const index = giveaways.value.findIndex(g => g.id === id)
    if (index !== -1) {
      const giveawayName = giveaways.value[index].prize
      giveaways.value.splice(index, 1)
      
      toastStore.addToast(`Giveaway "${giveawayName}" deleted successfully!`, 'success')
    }
  }
}

const endPoll = (id: string) => {
  const poll = polls.value.find(p => p.id === id)
  if (poll) {
    poll.active = false
    toastStore.addToast(`Poll "${poll.question}" ended successfully!`, 'success')
  }
}

const viewPollResults = (poll: any) => {
  console.log('View poll results:', poll)
  toastStore.addToast('Poll results would open here', 'info')
}

const deletePoll = (id: string) => {
  if (confirm('Are you sure you want to delete this poll?')) {
    const index = polls.value.findIndex(p => p.id === id)
    if (index !== -1) {
      const pollQuestion = polls.value[index].question
      polls.value.splice(index, 1)
      
      toastStore.addToast(`Poll "${pollQuestion}" deleted successfully!`, 'success')
    }
  }
}
</script>