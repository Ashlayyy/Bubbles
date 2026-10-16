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

const TOKEN_KEY = 'bubbles.auth.token';
const USER_KEY = 'bubbles.auth.user';
const EXPIRES_KEY = 'bubbles.auth.expiresAt';

function readStoredSession(): { token: string; user: User; expiresAt: number } | null {
	try {
		const storedToken = localStorage.getItem(TOKEN_KEY);
		const storedUser = localStorage.getItem(USER_KEY);
		const storedExpires = localStorage.getItem(EXPIRES_KEY);
		if (!storedToken || !storedUser || !storedExpires) {
			return null;
		}
		const expiresAt = Number(storedExpires);
		if (!Number.isFinite(expiresAt) || expiresAt * 1000 < Date.now()) {
			localStorage.removeItem(TOKEN_KEY);
			localStorage.removeItem(USER_KEY);
			localStorage.removeItem(EXPIRES_KEY);
			return null;
		}
		return { token: storedToken, user: JSON.parse(storedUser) as User, expiresAt };
	} catch {
		return null;
	}
}

function persistSession(token: string, user: User, expiresAt: number) {
	localStorage.setItem(TOKEN_KEY, token);
	localStorage.setItem(USER_KEY, JSON.stringify(user));
	localStorage.setItem(EXPIRES_KEY, String(expiresAt));
}

function clearSession() {
	localStorage.removeItem(TOKEN_KEY);
	localStorage.removeItem(USER_KEY);
	localStorage.removeItem(EXPIRES_KEY);
}

export const useAuthStore = defineStore('auth', () => {
	const stored = typeof window !== 'undefined' ? readStoredSession() : null;
	const user = ref<User | null>(stored?.user ?? null);
	const isAuthenticated = ref(Boolean(stored?.token));
	const loading = ref(false);
	const token = ref<string | null>(stored?.token ?? null);
	const expiresAt = ref<number | null>(stored?.expiresAt ?? null);

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

	const logout = async () => {
		try {
			await apiClient().post('/auth/logout');
		} catch (error) {
			console.error('Logout failed, logging out locally:', error);
		} finally {
			const ws = useWebsocketStore();
			ws.disconnect();
			user.value = null;
			isAuthenticated.value = false;
			token.value = null;
			expiresAt.value = null;
			clearSession();
		}
	};

	const setSession = (payload: AuthResponse) => {
		user.value = payload.user;
		token.value = payload.token;
		expiresAt.value = Math.floor(Date.now() / 1000) + payload.expiresIn;
		isAuthenticated.value = true;
		persistSession(payload.token, payload.user, expiresAt.value);
		const ws = useWebsocketStore();
		ws.connect(token.value);
	};

	const completeWithToken = async (jwt: string, expiresIn = 86400) => {
		token.value = jwt;
		expiresAt.value = Math.floor(Date.now() / 1000) + expiresIn;
		const { data } = await apiClient().get('/auth/me');
		const payload =
			(data as { data?: User; user?: User }).data ??
			(data as { user?: User }).user;
		if (!payload) {
			throw new Error('Invalid user data');
		}
		user.value = payload as User;
		isAuthenticated.value = true;
		persistSession(jwt, payload as User, expiresAt.value);
		const ws = useWebsocketStore();
		ws.connect(jwt);
	};

	const refreshToken = async () => {
		try {
			const { data } = await apiClient().get('/auth/refresh');
			const payload =
				(data as { data?: AuthResponse }).data ?? (data as AuthResponse);
			token.value = payload.token;
			expiresAt.value = Math.floor(Date.now() / 1000) + payload.expiresIn;
			if (user.value && token.value && expiresAt.value) {
				persistSession(token.value, user.value, expiresAt.value);
			}
			const ws = useWebsocketStore();
			ws.reauth(token.value);
		} catch (err) {
			console.error('Token refresh failed', err);
		}
	};

	const checkAuth = async () => {
		if (isAuthenticated.value && user.value && token.value) {
			return;
		}

		const existing = readStoredSession();
		if (existing) {
			token.value = existing.token;
			user.value = existing.user;
			expiresAt.value = existing.expiresAt;
		}

		if (!token.value) {
			isAuthenticated.value = false;
			return;
		}

		loading.value = true;
		try {
			const { data } = await apiClient().get('/auth/me');
			const payload =
				(data as { data?: User; user?: User }).data ??
				(data as { user?: User }).user;
			if (!payload) throw new Error('Invalid user data');
			user.value = payload as User;
			isAuthenticated.value = true;
			if (token.value && expiresAt.value) {
				persistSession(token.value, payload as User, expiresAt.value);
			}
			const ws = useWebsocketStore();
			ws.connect(token.value);
		} catch (error) {
			user.value = null;
			isAuthenticated.value = false;
			token.value = null;
			clearSession();
		} finally {
			loading.value = false;
		}
	};

	return {
		user,
		isAuthenticated,
		loading,
		token,
		expiresAt,
		avatarUrl,
		login,
		logout,
		refreshToken,
		checkAuth,
		setSession,
		completeWithToken,
	};
});
