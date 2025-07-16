#!/usr/bin/env node

/**
 * Check bot health status
 */

const http = require('http');

function checkHealth() {
	const options = {
		hostname: 'localhost',
		port: 9132,
		path: '/health',
		method: 'GET',
	};

	const req = http.request(options, (res) => {
		let data = '';

		res.on('data', (chunk) => {
			data += chunk;
		});

		res.on('end', () => {
			try {
				const health = JSON.parse(data);
				console.log('🔍 Bot Health Status:');
				console.log(JSON.stringify(health, null, 2));

				// Check queue status specifically
				if (health.components && health.components.queue) {
					console.log('\n📊 Queue Status Details:');
					console.log(`Status: ${health.components.queue.status}`);
					console.log(`Ready: ${health.components.queue.ready}`);
					console.log(
						`Processing Jobs: ${health.components.queue.processingJobs}`
					);
					if (health.components.queue.connectionStatus) {
						console.log(
							'Connection Status:',
							health.components.queue.connectionStatus
						);
					}
				}
			} catch (error) {
				console.error('Failed to parse health response:', error.message);
				console.log('Raw response:', data);
			}
		});
	});

	req.on('error', (error) => {
		console.error('Failed to check health:', error.message);
		console.log(
			'Make sure the bot is running and the metrics server is accessible on port 9132'
		);
	});

	req.end();
}

console.log('🔍 Checking bot health status...');
checkHealth();
