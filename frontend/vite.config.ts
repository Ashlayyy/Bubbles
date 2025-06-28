import { config as loadEnv } from 'dotenv';
import { existsSync } from 'fs';
import { resolve } from 'path';
import { defineConfig } from 'vite';
import vue from '@vitejs/plugin-vue';
import path from 'path';
import { componentTagger } from 'lovable-tagger';

// Fallback: load root /.env for Vite process (override = false ensures local env.* wins)
const rootEnvPath = resolve(__dirname, '../.env');
if (existsSync(rootEnvPath)) {
	loadEnv({ path: rootEnvPath, override: false });
}

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => ({
	server: {
		host: '::',
		port: parseInt(process.env.FRONTEND_PORT || '8080'),
		proxy: {
			// Proxy API requests to the backend server
			'/api': {
				target: process.env.API_BASE_URL || 'http://localhost:3001',
				changeOrigin: true,
				secure: false,
			},
		},
	},
	plugins: [vue(), mode === 'development' && componentTagger()].filter(Boolean),
	resolve: {
		alias: {
			'@': path.resolve(__dirname, './src'),
			'@shared': path.resolve(__dirname, '../shared/src'),
		},
	},
	define: {
		// Make sure environment variables are available at build time
		__APP_VERSION__: JSON.stringify(process.env.npm_package_version || '1.0.0'),
	},
}));
