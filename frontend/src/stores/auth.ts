/* eslint-disable react-hooks/rules-of-hooks, react-hooks/exhaustive-deps */
import { defineStore } from 'pinia';
import { ref, computed } from 'vue';
import { apiClient } from '@/lib/apiClient';
import { useWebsocketStore } from '@/stores/ws';

export interface User {
	id: string;
	username: string;
	discriminator: string;
	avatar: string | null;
	email?: string;
}

interface AuthResponse {
	user: User;
	token: string;
	expiresIn: number;
}

export const useAuthStore = defineStore('auth', () => {
	const user = ref<User | null>(null);
	const isAuthenticated = ref(false);
	const loading = ref(false);
	const isDemoUser = ref(false);
	const token = ref<string | null>(null);
	const expiresAt = ref<number | null>(null);

	const avatarUrl = computed(() => {
		if (!user.value) return null;
		if (!user.value.avatar)
			return `https://cdn.discordapp.com/embed/avatars/${
				parseInt(user.value.discriminator) % 5
			}.png`;
		return `https://cdn.discordapp.com/avatars/${user.value.id}/${user.value.avatar}.png?size=128`;
	});

	const login = () => {
		window.location.href = `${apiClient().defaults.baseURL}/auth/discord/login`;
	};

	const loginAsDemoUser = () => {
		loading.value = true;
		user.value = {
			id: 'demo-user',
			username: 'Demo User',
			discriminator: '0000',
			avatar: null,
		};
		isAuthenticated.value = true;
		isDemoUser.value = true;
		loading.value = false;
	};

	const logout = async () => {
		try {
			if (!isDemoUser.value) {
				await apiClient().post('/auth/logout');
			}
		} catch (error) {
			console.error('Logout failed, logging out locally:', error);
		} finally {
			const ws = useWebsocketStore();
			ws.disconnect();
			user.value = null;
			isAuthenticated.value = false;
			isDemoUser.value = false;
			token.value = null;
			expiresAt.value = null;
		}
	};

	const setSession = (payload: AuthResponse) => {
		user.value = payload.user;
		token.value = payload.token;
		expiresAt.value = Math.floor(Date.now() / 1000) + payload.expiresIn;
		isAuthenticated.value = true;
		const ws = useWebsocketStore();
		ws.connect(token.value);
	};

	const refreshToken = async () => {
		// Call refresh endpoint regardless of existing token
		try {
			const { data } = await apiClient().get('/auth/refresh');
			const payload =
				(data as { data?: AuthResponse }).data ?? (data as AuthResponse);
			token.value = payload.token;
			expiresAt.value = Math.floor(Date.now() / 1000) + payload.expiresIn;
			const ws = useWebsocketStore();
			ws.reauth(token.value);
		} catch (err) {
			console.error('Token refresh failed', err);
		}
	};

	const checkAuth = async () => {
		if (isAuthenticated.value) return;

		if (isDemoUser.value) return;

		loading.value = true;
		try {
			const { data } = await apiClient().get('/auth/me');
			const payload =
				(data as { data?: User; user?: User }).data ??
				(data as { user?: User }).user;
			if (!payload) throw new Error('Invalid user data');
			user.value = payload as User;
			isAuthenticated.value = true;
			isDemoUser.value = false;
			const ws = useWebsocketStore();
			if (token.value) ws.connect(token.value);
		} catch (error) {
			if (!isDemoUser.value) {
				user.value = null;
				isAuthenticated.value = false;
			}
		} finally {
			loading.value = false;
		}
	};

	return {
		user,
		isAuthenticated,
		loading,
		isDemoUser,
		token,
		expiresAt,
		avatarUrl,
		login,
		loginAsDemoUser,
		logout,
		refreshToken,
		checkAuth,
		setSession,
	};
});
