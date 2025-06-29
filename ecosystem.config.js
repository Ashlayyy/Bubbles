module.exports = {
  apps: [
    {
      name: 'bubbles-shared',
      cwd: './shared',
      script: 'npm',
      args: 'run dev',
      interpreter: 'none',
      env: {
        NODE_ENV: 'development'
      },
      env_production: {
        NODE_ENV: 'production'
      },
      watch: ['src'],
      ignore_watch: ['node_modules', 'dist'],
      instances: 1,
      exec_mode: 'fork',
      restart_delay: 2000,
      max_restarts: 10,
      min_uptime: '10s'
    },
    {
      name: 'bubbles-api',
      cwd: './api',
      script: 'npm',
      args: 'run dev',
      interpreter: 'none',
      env: {
        NODE_ENV: 'development',
        PORT: process.env.PORT || 3001,
        REDIS_HOST: process.env.REDIS_HOST,
        REDIS_PORT: process.env.REDIS_PORT,
        REDIS_PASSWORD: process.env.REDIS_PASSWORD,
        DB_URL: process.env.DB_URL,
        DISCORD_CLIENT_ID: process.env.DISCORD_CLIENT_ID,
        DISCORD_CLIENT_SECRET: process.env.DISCORD_CLIENT_SECRET,
        DISCORD_REDIRECT_URI: process.env.DISCORD_REDIRECT_URI,
        JWT_SECRET: process.env.JWT_SECRET,
        JWT_EXPIRES_IN: process.env.JWT_EXPIRES_IN,
        CORS_ORIGIN: process.env.CORS_ORIGIN,
        RATE_LIMIT_WINDOW_MS: process.env.RATE_LIMIT_WINDOW_MS,
        RATE_LIMIT_MAX_REQUESTS: process.env.RATE_LIMIT_MAX_REQUESTS
      },
      env_production: {
        NODE_ENV: 'production',
        PORT: process.env.PORT || 3001,
        REDIS_HOST: process.env.REDIS_HOST,
        REDIS_PORT: process.env.REDIS_PORT,
        REDIS_PASSWORD: process.env.REDIS_PASSWORD,
        DB_URL: process.env.DB_URL,
        DISCORD_CLIENT_ID: process.env.DISCORD_CLIENT_ID,
        DISCORD_CLIENT_SECRET: process.env.DISCORD_CLIENT_SECRET,
        DISCORD_REDIRECT_URI: process.env.DISCORD_REDIRECT_URI,
        JWT_SECRET: process.env.JWT_SECRET,
        JWT_EXPIRES_IN: process.env.JWT_EXPIRES_IN,
        CORS_ORIGIN: process.env.CORS_ORIGIN,
        RATE_LIMIT_WINDOW_MS: process.env.RATE_LIMIT_WINDOW_MS,
        RATE_LIMIT_MAX_REQUESTS: process.env.RATE_LIMIT_MAX_REQUESTS
      },
      watch: false,
      instances: 1,
      exec_mode: 'fork',
      restart_delay: 3000,
      max_restarts: 10,
      min_uptime: '10s',
      health_check_url: 'http://localhost:3001/health',
      health_check_grace_period: 3000
    },
    {
      name: 'bubbles-bot',
      cwd: './bot',
      script: 'npm',
      args: 'run dev',
      interpreter: 'none',
      env: {
        NODE_ENV: 'development',
        REDIS_HOST: process.env.REDIS_HOST,
        REDIS_PORT: process.env.REDIS_PORT,
        REDIS_PASSWORD: process.env.REDIS_PASSWORD,
        DISCORD_TOKEN: process.env.DISCORD_TOKEN,
        CLIENT_ID: process.env.CLIENT_ID,
        TEST_GUILD_ID: process.env.TEST_GUILD_ID,
        DEVELOPER_USER_IDS: process.env.DEVELOPER_USER_IDS,
        DB_URL: process.env.DB_URL
      },
      env_production: {
        NODE_ENV: 'production',
        REDIS_HOST: process.env.REDIS_HOST,
        REDIS_PORT: process.env.REDIS_PORT,
        REDIS_PASSWORD: process.env.REDIS_PASSWORD,
        DISCORD_TOKEN: process.env.DISCORD_TOKEN,
        CLIENT_ID: process.env.CLIENT_ID,
        TEST_GUILD_ID: process.env.TEST_GUILD_ID,
        DEVELOPER_USER_IDS: process.env.DEVELOPER_USER_IDS,
        DB_URL: process.env.DB_URL
      },
      watch: false,
      instances: 1,
      exec_mode: 'fork',
      restart_delay: 5000,
      max_restarts: 5,
      min_uptime: '30s',
      kill_timeout: 10000
    },
    {
      name: 'bubbles-frontend',
      cwd: './frontend',
      script: 'npm',
      args: 'run dev',
      interpreter: 'none',
      env: {
        NODE_ENV: 'development',
        VITE_API_URL: process.env.VITE_API_URL
      },
      env_production: {
        NODE_ENV: 'production',
        VITE_API_URL: process.env.VITE_API_URL
      },
      watch: false,
      instances: 1,
      exec_mode: 'fork',
      restart_delay: 3000,
      max_restarts: 10,
      min_uptime: '10s'
    }
  ],

  deploy: {
    production: {
      user: 'your-username',
      host: ['your-server-ip-or-domain.com'],
      ref: 'origin/main',
      repo: 'git@github.com:your-username/your-repo.git',
      path: '/var/www/bubbles-prod',
      ssh_options: 'StrictHostKeyChecking=no',
      // Specify SSH key (optional)
      // ssh_options: ['StrictHostKeyChecking=no', 'UserKnownHostsFile=/dev/null'],
      // key: '~/.ssh/your-specific-key',
      'pre-deploy-local': 'echo "Starting PRODUCTION deployment..."',
      'post-deploy': [
        'source ~/.nvm/nvm.sh',
        'nvm use 22',
        'npm install',
        'npm run build:all',
        'cp /var/www/bubbles-prod/.env.production /var/www/bubbles-prod/current/.env',
        'pm2 reload ecosystem.config.js --env production --update-env',
        'pm2 save'
      ].join(' && '),
      'pre-setup': [
        'sudo apt update',
        'sudo apt install -y curl',
        'curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.0/install.sh | bash'
      ].join(' && ')
    },

    development: {
      user: 'your-username',
      host: ['your-server-ip-or-domain.com'],
      ref: 'origin/develop',
      repo: 'git@github.com:your-username/your-repo.git',
      path: '/var/www/bubbles-dev',
      ssh_options: 'StrictHostKeyChecking=no',
      
      // Specify SSH key (optional)
      // ssh_options: ['StrictHostKeyChecking=no', 'UserKnownHostsFile=/dev/null'],
      // key: '~/.ssh/your-specific-key',
      'pre-deploy-local': 'echo "Starting DEVELOPMENT deployment..."',
      'post-deploy': [
        'source ~/.nvm/nvm.sh',
        'nvm use 22',
        'npm install',
        'npm run build:all',
        'cp /var/www/bubbles-dev/.env.development /var/www/bubbles-dev/current/.env',
        'pm2 reload ecosystem.config.js --env development --update-env',
        'pm2 save'
      ].join(' && '),
      'pre-setup': [
        'sudo apt update',
        'sudo apt install -y curl',
        'curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.0/install.sh | bash'
      ].join(' && ')
    }
  }
} 