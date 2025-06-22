import axios, {
	AxiosError,
	AxiosInstance,
	AxiosResponse,
	InternalAxiosRequestConfig,
	AxiosRequestHeaders,
	AxiosRequestConfig,
} from 'axios';
import { useAuthStore } from '@/stores/auth';
import { useToastStore } from '@/stores/toast';

// Lazy singleton so stores are available after Pinia initialises
let api: AxiosInstance | null = null;

function createApiClient(): AxiosInstance {
	const instance = axios.create({
		baseURL: import.meta.env.VITE_API_URL || '/api',
		headers: {
			'Content-Type': 'application/json',
		},
	});

	// Request interceptor – attach JWT
	instance.interceptors.request.use((config: InternalAxiosRequestConfig) => {
		const auth = useAuthStore();
		if (auth.token) {
			// Axios 1.x uses AxiosHeaders – cast for mutation convenience
			(
				config.headers as AxiosRequestHeaders
			).Authorization = `Bearer ${auth.token}`;
		}
		return config;
	});

	// Response interceptor – global error & token refresh
	instance.interceptors.response.use(
		(res: AxiosResponse) => res,
		async (error: AxiosError) => {
			const toast = useToastStore();
			const auth = useAuthStore();

			const originalRequest = error.config as AxiosRequestConfig & {
				_retry?: boolean;
			};

			if (
				error.response?.status === 401 &&
				originalRequest.url !== '/auth/me'
			) {
				if (!originalRequest._retry) {
					originalRequest._retry = true;
					try {
						await auth.refreshToken();
						return instance(originalRequest);
					} catch (e) {
						// Refresh failed ⇒ logout
						await auth.logout();
						toast.addToast('Session expired, please login again', 'error');
					}
				}
			} else if (error.response) {
				const apiError =
					(error.response.data as unknown as { error?: string })?.error ||
					error.response.statusText;
				toast.addToast(apiError, 'error');
			} else {
				toast.addToast('Network error, please try again', 'error');
			}

			return Promise.reject(error);
		}
	);

	return instance;
}

export const apiClient = (): AxiosInstance => {
	if (!api) api = createApiClient();
	return api;
};
