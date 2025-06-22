import { defineStore } from 'pinia';
import { ref, computed } from 'vue';
import { apiClient } from '@/lib/apiClient';

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
		window.location.href = `${apiClient().defaults.baseURL}/auth/discord`;
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
			// Only try to call logout API if not a demo user
			if (!isDemoUser.value) {
				await apiClient().post('/auth/logout');
			}
		} catch (error) {
			console.error('Logout failed, logging out locally:', error);
		} finally {
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
	};

	const refreshToken = async () => {
		if (!token.value) throw new Error('No token');
		const { data } = await apiClient().get('/auth/refresh');
		const res = data as AuthResponse;
		token.value = res.token;
		expiresAt.value = Math.floor(Date.now() / 1000) + res.expiresIn;
	};

	const checkAuth = async () => {
		if (isAuthenticated.value) return;

		// If we're already a demo user, don't make API calls
		if (isDemoUser.value) return;

		loading.value = true;
		try {
			const { data } = await apiClient().get('/auth/me');
			const payload = data as { user: User };
			user.value = payload.user;
			isAuthenticated.value = true;
			isDemoUser.value = false;
		} catch (error) {
			// Only reset auth state if we're not a demo user
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
