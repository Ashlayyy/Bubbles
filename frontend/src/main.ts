/* eslint-disable react-hooks/rules-of-hooks */
import { createApp, watch } from 'vue';
import { createPinia } from 'pinia';
import App from './App.vue';
import './index.css';
import 'vue3-emoji-picker/css';
import router from './router';
import { useUIStore } from './stores/ui';
import { useAuthStore } from './stores/auth';
import { useWebsocketStore } from './stores/ws';

const pinia = createPinia();

const app = createApp(App);
app.use(pinia);
app.use(router);

// Initialize theme before mounting
const uiStore = useUIStore(pinia);
const authStore = useAuthStore(pinia);
const wsStore = useWebsocketStore(pinia);

// run auth check early
authStore.checkAuth();

watch(
	() => authStore.isAuthenticated,
	async (authenticated) => {
		if (authenticated) {
			// Ensure token exists
			if (!authStore.token) {
				try {
					await authStore.refreshToken();
				} catch (e) {
					console.error('Failed to refresh token for WS', e);
				}
			}
			if (authStore.token) {
				wsStore.connect(authStore.token);
			}
		} else {
			wsStore.disconnect();
		}
	},
	{ immediate: true }
);

app.mount('#app');
