// Load environment variables from .env files
require('dotenv').config();

module.exports = {
	apps: [
		// === API (cluster) ===
		{
			name: 'bubbles-api',
			cwd: './api',
			script: 'dist/index.js',
			node_args: '--enable-source-maps',
			env_file: '../.env.production',
			env: {
				NODE_ENV: 'production',
				PORT: process.env.PORT || 3001,
			},
			exec_mode: 'cluster',
			instances: 'max',
			merge_logs: true,
			error_file: '~/.pm2/logs/bubbles.err.log',
			out_file: '~/.pm2/logs/bubbles.out.log',
			log_date_format: 'YYYY-MM-DD HH:mm:ss',
			wait_ready: true,
			listen_timeout: 8000,
			max_memory_restart: '750M',
		},

		// === Frontend (cluster) ===
		{
			name: 'bubbles-frontend',
			cwd: './frontend',
			script: 'npm',
			args: 'run preview',
			interpreter: 'none',
			env_file: '../.env.production',
			env: {
				NODE_ENV: 'production',
			},
			exec_mode: 'cluster',
			instances: 2,
			merge_logs: true,
			error_file: '~/.pm2/logs/bubbles.err.log',
			out_file: '~/.pm2/logs/bubbles.out.log',
			log_date_format: 'YYYY-MM-DD HH:mm:ss',
			wait_ready: true,
			listen_timeout: 8000,
			max_memory_restart: '750M',
		},

		// === Bot (single) ===
		{
			name: 'bubbles-bot',
			cwd: './bot',
			script: 'dist/index.js',
			node_args: '--enable-source-maps',
			env_file: '../.env.production',
			env: {
				NODE_ENV: 'production',
			},
			exec_mode: 'fork',
			instances: 1,
			merge_logs: true,
			error_file: '~/.pm2/logs/bubbles.err.log',
			out_file: '~/.pm2/logs/bubbles.out.log',
			log_date_format: 'YYYY-MM-DD HH:mm:ss',
			wait_ready: true,
			listen_timeout: 8000,
			max_memory_restart: '750M',
		},

		// === Bot Sharded (single) ===
		{
			name: 'bubbles-bot-sharded',
			cwd: './bot',
			script: 'dist/shard.js',
			node_args: '--enable-source-maps',
			env_file: '../.env.production',
			env: {
				NODE_ENV: 'production',
				TOTAL_SHARDS: process.env.TOTAL_SHARDS || 'auto',
				SHARDS_PER_CLUSTER: process.env.SHARDS_PER_CLUSTER || '4',
			},
			exec_mode: 'fork',
			instances: 1,
			merge_logs: true,
			error_file: '~/.pm2/logs/bubbles.err.log',
			out_file: '~/.pm2/logs/bubbles.out.log',
			log_date_format: 'YYYY-MM-DD HH:mm:ss',
			wait_ready: true,
			listen_timeout: 8000,
			max_memory_restart: '750M',
		},
	],

	deploy: {
		production: {
			user: 'your-username',
			host: ['your-server-ip-or-domain.com'],
			ref: 'origin/main',
			repo: 'git@github.com:your-username/your-repo.git',
			path: '/var/www/bubbles-prod',
			ssh_options: 'StrictHostKeyChecking=no',
			'pre-deploy-local': 'echo "Starting PRODUCTION deployment..."',
			'post-deploy': [
				'source ~/.nvm/nvm.sh',
				'nvm install 22',
				'npm ci --workspaces --include-workspace-root',
				'npm run build',
				'cp /var/www/bubbles-prod/.env.production /var/www/bubbles-prod/current/.env',
				'pm2 reload ecosystem.config.js --env production --only bubbles-api,bubbles-frontend,bubbles-bot,bubbles-bot-sharded',
				'pm2 save',
			].join(' && '),
			'pre-setup': [
				'sudo apt update',
				'sudo apt install -y curl git',
				'curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.0/install.sh | bash',
			].join(' && '),
		},
	},
};
