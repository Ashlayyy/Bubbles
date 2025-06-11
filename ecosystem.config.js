module.exports = {
  apps: [
    // Shared Package Builder (Build once, then watch for changes)
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

    // API Service
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
      watch: false, // nodemon handles this
      instances: 1,
      exec_mode: 'fork',
      restart_delay: 3000,
      max_restarts: 10,
      min_uptime: '10s',
      // Health check
      health_check_url: 'http://localhost:3001/health',
      health_check_grace_period: 3000
    },

    // Discord Bot Service
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
      watch: false, // nodemon handles this
      instances: 1,
      exec_mode: 'fork',
      restart_delay: 5000,
      max_restarts: 5,
      min_uptime: '30s',
      // Bot needs more time to connect to Discord
      kill_timeout: 10000
    },

    // Frontend Development Server
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
      watch: false, // Vite handles this
      instances: 1,
      exec_mode: 'fork',
      restart_delay: 3000,
      max_restarts: 10,
      min_uptime: '10s'
    }
  ],

  // Deployment configurations
  deploy: {
    // Production environment
    production: {
      // SSH connection details
      user: 'your-username',
      host: ['your-server-ip-or-domain.com'],
      
      // Git repository details
      ref: 'origin/main',
      repo: 'git@github.com:your-username/your-repo.git',
      
      // Server paths
      path: '/var/www/bubbles-prod',
      ssh_options: 'StrictHostKeyChecking=no',
      
      // Specify SSH key (optional)
      // ssh_options: ['StrictHostKeyChecking=no', 'UserKnownHostsFile=/dev/null'],
      // key: '~/.ssh/your-specific-key',
      
      // Pre-deployment (runs locally before deployment)
      'pre-deploy-local': 'echo "Starting PRODUCTION deployment..."',
      
      // Post-deployment (runs on server after code is pulled)
      'post-deploy': [
        'source ~/.nvm/nvm.sh',
        'nvm use 22',
        'npm install',
        'npm run build:all',
        'cp /var/www/bubbles-prod/.env.production /var/www/bubbles-prod/current/.env',
        'pm2 reload ecosystem.config.js --env production --update-env',
        'pm2 save'
      ].join(' && '),
      
      // Pre-setup (runs once during initial setup)
      'pre-setup': [
        'sudo apt update',
        'sudo apt install -y curl',
        'curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.0/install.sh | bash'
      ].join(' && ')
    },

    // Development environment
    development: {
      // SSH connection details (same server, different path)
      user: 'your-username',
      host: ['your-server-ip-or-domain.com'],
      
      // Git repository details
      ref: 'origin/develop',  // Deploy from develop branch
      repo: 'git@github.com:your-username/your-repo.git',
      
      // Server paths (separate directory)
      path: '/var/www/bubbles-dev',
      ssh_options: 'StrictHostKeyChecking=no',
      
      // Specify SSH key (optional)
      // ssh_options: ['StrictHostKeyChecking=no', 'UserKnownHostsFile=/dev/null'],
      // key: '~/.ssh/your-specific-key',
      
      // Pre-deployment (runs locally before deployment)
      'pre-deploy-local': 'echo "Starting DEVELOPMENT deployment..."',
      
      // Post-deployment (runs on server after code is pulled)
      'post-deploy': [
        'source ~/.nvm/nvm.sh',
        'nvm use 22',
        'npm install',
        'npm run build:all',
        'cp /var/www/bubbles-dev/.env.development /var/www/bubbles-dev/current/.env',
        'pm2 reload ecosystem.config.js --env development --update-env',
        'pm2 save'
      ].join(' && '),
      
      // Pre-setup (runs once during initial setup)
      'pre-setup': [
        'sudo apt update',
        'sudo apt install -y curl',
        'curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.0/install.sh | bash'
      ].join(' && ')
    }
  }
} 