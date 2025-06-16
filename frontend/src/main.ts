
import { createApp } from 'vue'
import { createPinia } from 'pinia'
import { createRouter, createWebHistory, type RouteRecordRaw } from 'vue-router'
import App from './App.vue'
import './index.css'
import 'vue3-emoji-picker/css'
import { useAuthStore } from './stores/auth'

// Import views
import Login from './views/Login.vue'
import ServerSelection from './views/ServerSelection.vue'
import Dashboard from './views/Dashboard.vue'
import Moderation from './views/Moderation.vue'
import Appeals from './views/Appeals.vue'
import Tickets from './views/Tickets.vue'
import Autoroles from './views/Autoroles.vue'
import ReactionRoles from './views/ReactionRoles.vue'
import CustomCommands from './views/CustomCommands.vue'
import Leveling from './views/Leveling.vue'
import AuditLog from './views/AuditLog.vue'
import Logging from './views/Logging.vue'
import Settings from './views/Settings.vue'
import Reminders from './views/Reminders.vue'
import Starboard from './views/Starboard.vue'
import Welcome from './views/Welcome.vue'
import DashboardLayout from './layouts/DashboardLayout.vue'

const routes: RouteRecordRaw[] = [
  { path: '/', name: 'ServerSelection', component: ServerSelection },
  { path: '/login', name: 'Login', component: Login },
  {
    path: '/server/:guildId',
    component: DashboardLayout,
    children: [
      { path: 'dashboard', name: 'Dashboard', component: Dashboard },
      { path: 'moderation', name: 'Moderation', component: Moderation },
      { path: 'appeals', name: 'Appeals', component: Appeals },
      { path: 'tickets', name: 'Tickets', component: Tickets },
      { path: 'autoroles', name: 'Autoroles', component: Autoroles },
      { path: 'reaction-roles', name: 'ReactionRoles', component: ReactionRoles },
      { path: 'custom-commands', name: 'CustomCommands', component: CustomCommands },
      { path: 'leveling', name: 'Leveling', component: Leveling },
      { path: 'audit-log', name: 'AuditLog', component: AuditLog },
      { path: 'logging', name: 'Logging', component: Logging },
      { path: 'settings', name: 'Settings', component: Settings },
      { path: 'reminders', name: 'Reminders', component: Reminders },
      { path: 'starboard', name: 'Starboard', component: Starboard },
      { path: 'welcome', name: 'Welcome', component: Welcome },
    ]
  },
   // Redirects for old paths
  { path: '/dashboard/:guildId', redirect: to => ({ path: `/server/${to.params.guildId}/dashboard` }) },
  { path: '/moderation/:guildId', redirect: to => ({ path: `/server/${to.params.guildId}/moderation` }) },
  { path: '/appeals/:guildId', redirect: to => ({ path: `/server/${to.params.guildId}/appeals` }) },
  { path: '/tickets/:guildId', redirect: to => ({ path: `/server/${to.params.guildId}/tickets` }) },
  { path: '/autoroles/:guildId', redirect: to => ({ path: `/server/${to.params.guildId}/autoroles` }) },
  { path: '/reaction-roles/:guildId', redirect: to => ({ path: `/server/${to.params.guildId}/reaction-roles` }) },
  { path: '/custom-commands/:guildId', redirect: to => ({ path: `/server/${to.params.guildId}/custom-commands` }) },
  { path: '/leveling/:guildId', redirect: to => ({ path: `/server/${to.params.guildId}/leveling` }) },
  { path: '/audit-log/:guildId', redirect: to => ({ path: `/server/${to.params.guildId}/audit-log` }) },
  { path: '/logging/:guildId', redirect: to => ({ path: `/server/${to.params.guildId}/logging` }) },
  { path: '/settings/:guildId', redirect: to => ({ path: `/server/${to.params.guildId}/settings` }) },
  { path: '/reminders/:guildId', redirect: to => ({ path: `/server/${to.params.guildId}/reminders` }) },
  { path: '/starboard/:guildId', redirect: to => ({ path: `/server/${to.params.guildId}/starboard` }) },
  { path: '/welcome/:guildId', redirect: to => ({ path: `/server/${to.params.guildId}/welcome` }) },
]

const router = createRouter({
  history: createWebHistory(),
  routes,
})

const pinia = createPinia()

const app = createApp(App)
app.use(pinia)

router.beforeEach(async (to) => {
  const publicPages = ['/login']
  const authRequired = !publicPages.includes(to.path)
  const auth = useAuthStore()

  // Try to check for an existing session if we don't have a user
  if (!auth.isAuthenticated) {
    await auth.checkAuth()
  }

  // Redirect to login if auth is required and user is not authenticated
  if (authRequired && !auth.isAuthenticated) {
    return '/login'
  }

  // Redirect to home if user is authenticated and tries to access login page
  if (auth.isAuthenticated && to.path === '/login') {
    return '/'
  }
})


app.use(router)
app.mount('#app')
