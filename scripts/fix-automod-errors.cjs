#!/usr/bin/env node

/**
 * Quick fix script for automod errors
 * This script helps diagnose and fix common issues with the automod system
 */

const fs = require('fs');
const path = require('path');

console.log('🔧 Automod Error Fix Script');
console.log('==========================\n');

// Check if we're in the right directory
const botDir = path.join(__dirname, '../bot');
const apiDir = path.join(__dirname, '../api');

console.log('📁 Checking project structure...');
console.log(`Bot directory: ${fs.existsSync(botDir) ? '✅' : '❌'} ${botDir}`);
console.log(`API directory: ${fs.existsSync(apiDir) ? '✅' : '❌'} ${apiDir}`);

// Check for .env files
console.log('\n🔍 Checking environment files...');
const envFiles = ['.env', '.env.local', '.env.development', '.env.production'];

envFiles.forEach((file) => {
	const envPath = path.join(__dirname, '..', file);
	if (fs.existsSync(envPath)) {
		console.log(`✅ ${file}: Found`);

		// Read and check for key variables
		const content = fs.readFileSync(envPath, 'utf8');
		const lines = content.split('\n');

		const keyVars = [
			'DISCORD_TOKEN',
			'DISCORD_CLIENT_ID',
			'DATABASE_URL',
			'REDIS_URL',
			'WS_URL',
			'JWT_SECRET',
		];
		keyVars.forEach((varName) => {
			const hasVar = lines.some((line) =>
				line.trim().startsWith(varName + '=')
			);
			console.log(`  ${hasVar ? '✅' : '❌'} ${varName}`);
		});
	} else {
		console.log(`❌ ${file}: Not found`);
	}
});

// Check if Redis is likely running (simple port check)
console.log('\n🔍 Checking Redis availability...');
const net = require('net');

function checkPort(host, port) {
	return new Promise((resolve) => {
		const socket = new net.Socket();
		socket.setTimeout(2000);

		socket.on('connect', () => {
			socket.destroy();
			resolve(true);
		});

		socket.on('timeout', () => {
			socket.destroy();
			resolve(false);
		});

		socket.on('error', () => {
			socket.destroy();
			resolve(false);
		});

		socket.connect(port, host);
	});
}

async function checkRedisPort() {
	const redisAvailable = await checkPort('localhost', 6379);
	if (redisAvailable) {
		console.log('✅ Redis port 6379 is open (Redis likely running)');
	} else {
		console.log('❌ Redis port 6379 is closed (Redis not running)');
	}
	return redisAvailable;
}

// Check if API server is running
console.log('\n🔍 Checking API server...');
const http = require('http');

function checkAPI() {
	return new Promise((resolve) => {
		const apiUrl = process.env.API_URL || 'http://localhost:3001';
		const url = new URL(apiUrl);

		const req = http.request(
			{
				hostname: url.hostname,
				port: url.port || 80,
				path: '/health',
				method: 'GET',
				timeout: 5000,
			},
			(res) => {
				console.log('✅ API server is running');
				resolve(true);
			}
		);

		req.on('error', (error) => {
			console.log('❌ API server not accessible:', error.message);
			resolve(false);
		});

		req.on('timeout', () => {
			console.log('❌ API server timeout');
			resolve(false);
		});

		req.end();
	});
}

// Main execution
async function main() {
	console.log('\n🚀 Running diagnostics...\n');

	const redisAvailable = await checkRedisPort();
	const apiAvailable = await checkAPI();

	console.log('\n📋 Summary:');
	console.log(`Redis: ${redisAvailable ? '✅ Available' : '❌ Not Available'}`);
	console.log(`API: ${apiAvailable ? '✅ Available' : '❌ Not Available'}`);

	if (!redisAvailable || !apiAvailable) {
		console.log('\n🔧 Quick Fix Options:');
		console.log('1. Set DISABLE_QUEUES=true to disable Redis dependency');
		console.log('2. Set DISABLE_API=true to disable WebSocket dependency');
		console.log('3. Start Redis server: redis-server');
		console.log('4. Start API server: npm run dev:api');

		console.log('\n💡 Recommended .env additions:');
		if (!redisAvailable) {
			console.log('DISABLE_QUEUES=true');
		}
		if (!apiAvailable) {
			console.log('DISABLE_API=true');
		}
	} else {
		console.log('\n✅ All services are available!');
	}

	console.log('\n🎯 Next Steps:');
	console.log('1. Restart the bot after making any changes');
	console.log('2. Check logs for any remaining errors');
	console.log('3. Test automod commands: /automod list, /automod stats');

	console.log('\n🔧 Immediate Fix:');
	console.log(
		'Add these lines to your .env file to disable problematic services:'
	);
	console.log('DISABLE_QUEUES=true');
	console.log('DISABLE_API=true');
}

main().catch(console.error);
