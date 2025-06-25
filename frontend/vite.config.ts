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
		port: 8080,
	},
	plugins: [vue(), mode === 'development' && componentTagger()].filter(Boolean),
	resolve: {
		alias: {
			'@': path.resolve(__dirname, './src'),
		},
	},
}));
