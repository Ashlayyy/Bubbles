# 🚀 Production Deployment Guide

This guide explains how to deploy your Bubbles Discord Bot to a production server using PM2's deployment features.

## 📋 Prerequisites

### Local Machine
- **PM2** installed globally: `npm install -g pm2`
- **SSH access** to your server with RSA keys
- **Git repository** with your code

### Production Server
- **Ubuntu/Debian** Linux server
- **SSH access** via RSA keys
- **Node.js 20+** (will be installed automatically)
- **Redis server** running
- **MongoDB** access (local or cloud)

## 🔑 SSH Key Setup

### 1. Generate SSH Key (if you don't have one)

```bash
# Generate RSA key pair
ssh-keygen -t rsa -b 4096 -C "your-email@example.com"

# Default location: ~/.ssh/id_rsa (private) and ~/.ssh/id_rsa.pub (public)
```

### 2. Add Public Key to Server

```bash
# Copy public key to server
ssh-copy-id your-username@your-server-ip

# Or manually add to ~/.ssh/authorized_keys on the server
cat ~/.ssh/id_rsa.pub | ssh your-username@your-server-ip "mkdir -p ~/.ssh && cat >> ~/.ssh/authorized_keys"
```

### 3. Test SSH Connection

```bash
# Test passwordless SSH login
ssh your-username@your-server-ip

# Should log in without password prompt
```

## 🏗️ Server Preparation

### 1. Basic Server Setup

```bash
# SSH into your server
ssh your-username@your-server-ip

# Update system
sudo apt update && sudo apt upgrade -y

# Install basic dependencies
sudo apt install -y curl git build-essential

# Install Redis (if needed locally)
sudo apt install -y redis-server
sudo systemctl enable redis-server
sudo systemctl start redis-server

# Create application directory
sudo mkdir -p /var/www/bubbles
sudo chown $USER:$USER /var/www/bubbles
```

### 2. Environment Variables Setup

You'll need separate environment files for production and development:

```bash
# Create directories for both environments
sudo mkdir -p /var/www/bubbles-prod
sudo mkdir -p /var/www/bubbles-dev
sudo chown $USER:$USER /var/www/bubbles-prod
sudo chown $USER:$USER /var/www/bubbles-dev
```

#### **Production Environment File**

```bash
# Create production .env file
sudo nano /var/www/bubbles-prod/.env.production
```

**Production .env.production file:**
```env
# Discord Bot Configuration
DISCORD_TOKEN=your_production_discord_bot_token
CLIENT_ID=your_production_client_id
TEST_GUILD_ID=your_production_test_guild_id
DEVELOPER_USER_IDS=your_user_id

# Database Configuration
DB_URL=your_production_mongodb_connection_string

# Redis Configuration (local server)
REDIS_HOST=localhost
REDIS_PORT=6379
REDIS_PASSWORD=

# API Configuration
DISCORD_CLIENT_SECRET=your_production_client_secret
JWT_SECRET=your_super_secure_production_jwt_secret
DISCORD_REDIRECT_URI=https://yourdomain.com/auth/callback
JWT_EXPIRES_IN=24h
CORS_ORIGIN=https://yourdomain.com
RATE_LIMIT_WINDOW_MS=900000
RATE_LIMIT_MAX_REQUESTS=100

# Production URLs
API_URL=https://api.yourdomain.com
FRONTEND_URL=https://yourdomain.com
VITE_API_URL=https://api.yourdomain.com

# Server Configuration
PORT=3001
NODE_ENV=production
```

#### **Development Environment File**

```bash
# Create development .env file
sudo nano /var/www/bubbles-dev/.env.development
```

**Development .env.development file:**
```env
# Discord Bot Configuration (separate dev bot)
DISCORD_TOKEN=your_development_discord_bot_token
CLIENT_ID=your_development_client_id
TEST_GUILD_ID=your_development_test_guild_id
DEVELOPER_USER_IDS=your_user_id

# Database Configuration (separate dev database)
DB_URL=your_development_mongodb_connection_string

# Redis Configuration (same server, different DB)
REDIS_HOST=localhost
REDIS_PORT=6379
REDIS_PASSWORD=
REDIS_DB=1

# API Configuration
DISCORD_CLIENT_SECRET=your_development_client_secret
JWT_SECRET=your_development_jwt_secret
DISCORD_REDIRECT_URI=https://dev.yourdomain.com/auth/callback
JWT_EXPIRES_IN=24h
CORS_ORIGIN=https://dev.yourdomain.com
RATE_LIMIT_WINDOW_MS=900000
RATE_LIMIT_MAX_REQUESTS=100

# Development URLs (different ports)
API_URL=https://dev-api.yourdomain.com
FRONTEND_URL=https://dev.yourdomain.com
VITE_API_URL=https://dev-api.yourdomain.com

# Server Configuration (different port)
PORT=3002
NODE_ENV=development
```

## ⚙️ Ecosystem Configuration

### 1. Update Your ecosystem.config.js

```javascript
// Update these values in your ecosystem.config.js
deploy: {
  production: {
    // SSH connection details
    user: 'your-actual-username',              // Your server username
    host: ['123.456.789.123'],                 // Your server IP or domain
    
    // Git repository details  
    ref: 'origin/main',                        // Branch to deploy
    repo: 'git@github.com:yourusername/yourrepo.git', // Your actual repo
    
    // Server paths
    path: '/var/www/bubbles',
    ssh_options: 'StrictHostKeyChecking=no',
    
    // Deployment commands...
  }
}
```

### 2. Add Your Server's SSH Key to GitHub

```bash
# On your server, generate a deploy key
ssh-keygen -t rsa -b 4096 -C "deploy@your-server.com"

# Add the public key to your GitHub repo
# Go to: GitHub Repo > Settings > Deploy Keys > Add Deploy Key
cat ~/.ssh/id_rsa.pub
```

## 🚀 Deployment Process

### 1. Initial Setup (First Time Only)

```bash
# Setup PRODUCTION environment
pm2 deploy ecosystem.config.js production setup

# Setup DEVELOPMENT environment
pm2 deploy ecosystem.config.js development setup

# This will:
# - Connect to your server via SSH
# - Clone your repository to separate directories
# - Install Node.js via NVM
# - Create necessary directories
```

### 2. Deploy Applications

#### **Deploy to Production**
```bash
# Deploy production (from main branch)
pm2 deploy ecosystem.config.js production

# This will:
# - Pull latest code from main branch
# - Install dependencies (npm install)
# - Build all services (npm run build:all)
# - Copy production environment file
# - Start/reload PM2 processes with production config
# - Save PM2 configuration
```

#### **Deploy to Development**
```bash
# Deploy development (from develop branch)
pm2 deploy ecosystem.config.js development

# This will:
# - Pull latest code from develop branch
# - Install dependencies (npm install)
# - Build all services (npm run build:all)
# - Copy development environment file
# - Start/reload PM2 processes with development config
# - Save PM2 configuration
```

### 3. Verify Deployments

```bash
# SSH into your server to check
ssh your-username@your-server-ip

# Check PM2 processes (both environments)
pm2 status

# View logs for specific environment
pm2 logs bubbles-api --env production
pm2 logs bubbles-bot --env development

# Check if services are running
curl http://localhost:3001/health  # Production API health check
curl http://localhost:3002/health  # Development API health check
```

## 🔄 Multi-Environment Workflow

### Development Workflow

```bash
# 1. Make changes on feature branch
git checkout -b feature/new-feature
# ... make changes ...
git add .
git commit -m "Add new feature"
git push origin feature/new-feature

# 2. Merge to develop branch
git checkout develop
git merge feature/new-feature
git push origin develop

# 3. Deploy to development environment
pm2 deploy ecosystem.config.js development

# 4. Test on development server
curl http://localhost:3002/health
pm2 logs bubbles-bot --env development
```

### Production Workflow

```bash
# 1. After testing on dev, merge to main
git checkout main
git merge develop
git push origin main

# 2. Deploy to production
pm2 deploy ecosystem.config.js production

# 3. Monitor production deployment
pm2 logs bubbles-api --env production
```

### Environment-Specific Commands

```bash
# Deploy specific environment
pm2 deploy ecosystem.config.js production
pm2 deploy ecosystem.config.js development

# View logs for specific environment
pm2 logs --env production
pm2 logs --env development

# Restart specific environment
pm2 restart ecosystem.config.js --env production
pm2 restart ecosystem.config.js --env development

# Rollback specific environment
pm2 deploy ecosystem.config.js production revert 1
pm2 deploy ecosystem.config.js development revert 1
```

### Managing Both Environments

```bash
# Check status of all processes
pm2 status

# You'll see processes like:
# bubbles-shared (shared)
# bubbles-api (production)
# bubbles-bot (production) 
# bubbles-frontend (production)
# bubbles-api (development)
# bubbles-bot (development)
# bubbles-frontend (development)

# View logs for specific service and environment
pm2 logs bubbles-api --env production
pm2 logs bubbles-bot --env development
```

## 🔍 Troubleshooting

### Common Issues

**1. SSH Permission Denied**
```bash
# Check SSH key permissions
chmod 600 ~/.ssh/id_rsa
chmod 644 ~/.ssh/id_rsa.pub

# Test SSH connection
ssh -v your-username@your-server-ip
```

**2. Git Clone Issues**
```bash
# Add GitHub to known hosts on server
ssh your-username@your-server-ip
ssh-keyscan github.com >> ~/.ssh/known_hosts
```

**3. Node.js Not Found**
```bash
# SSH into server and manually install Node.js
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.0/install.sh | bash
source ~/.bashrc
nvm install 20
nvm use 20
nvm alias default 20
```

**4. PM2 Processes Not Starting**
```bash
# SSH into server
ssh your-username@your-server-ip

# Check environment variables
cd /var/www/bubbles/current
cat .env

# Manually start PM2
pm2 start ecosystem.config.js --env production
pm2 logs
```

**5. Environment File Not Found**
```bash
# Ensure .env exists in the right location
ls -la /var/www/bubbles/.env

# If missing, create it with production values
nano /var/www/bubbles/.env
```

### Debug Deployment

```bash
# Verbose deployment
pm2 deploy ecosystem.config.js production --force

# Check deployment logs
pm2 deploy ecosystem.config.js production exec "pm2 logs"

# SSH into server manually
ssh your-username@your-server-ip
cd /var/www/bubbles/current
npm run status
```

## 🔒 Security Considerations

### 1. Firewall Setup

```bash
# On your server
sudo ufw allow ssh
sudo ufw allow 3001/tcp  # API port (if exposing publicly)
sudo ufw enable
```

### 2. Environment Security

- **Never commit** `.env` files to Git
- **Use strong passwords** for all services
- **Regularly rotate** JWT secrets and API keys
- **Use HTTPS** in production with SSL certificates

### 3. Server Hardening

```bash
# Disable password authentication (SSH keys only)
sudo nano /etc/ssh/sshd_config
# Set: PasswordAuthentication no
sudo systemctl restart sshd

# Setup automatic security updates
sudo apt install unattended-upgrades
sudo dpkg-reconfigure unattended-upgrades
```

## 📊 Monitoring

### PM2 Monitoring

```bash
# Real-time monitoring
pm2 monit

# Process status
pm2 status

# Detailed process info
pm2 show bubbles-api
```

### Log Management

```bash
# View logs
pm2 logs

# Clear logs
pm2 flush

# Rotate logs (setup logrotate)
pm2 install pm2-logrotate
```

## 🎉 Success Checklist

- [ ] SSH key authentication working
- [ ] Repository accessible from server
- [ ] Environment variables configured
- [ ] Initial setup completed successfully
- [ ] Deployment successful
- [ ] All PM2 processes online
- [ ] API health check returns 200
- [ ] Bot connects to Discord
- [ ] Frontend accessible (if applicable)

Your deployment is complete when all services show as `online` in `pm2 status` and your applications are accessible via their respective URLs! 