#!/usr/bin/env node

/**
 * Test script to verify the BullMQ fixes work correctly
 */

const { config } = require('dotenv');
const { resolve } = require('path');

// Load environment variables
config({ path: resolve(__dirname, '../.env') });

console.log('🔧 Testing Fixed BullMQ Configuration...');
console.log(`Redis Host: ${process.env.REDIS_HOST || 'localhost'}`);
console.log(`Redis Port: ${process.env.REDIS_PORT || '6379'}`);
console.log(
	`Redis Password: ${process.env.REDIS_PASSWORD ? '[SET]' : '[NOT SET]'}`
);

// Import the BullMQ registry
const { bullMQRegistry } = require('../shared/src/queue/bullmq');

async function testFixedRegistry() {
	try {
		console.log('\n🧪 Testing BullMQ Registry with fixes...');

		// Check initial status
		console.log('Initial status:', bullMQRegistry.getConnectionStatus());

		// Check availability immediately
		const initialAvailable = bullMQRegistry.isAvailable();
		console.log('Initial availability:', initialAvailable);

		// Wait for connections to establish
		console.log('\n⏳ Waiting 5 seconds for connections to establish...');
		await new Promise((resolve) => setTimeout(resolve, 5000));

		// Check status after wait
		const finalStatus = bullMQRegistry.getConnectionStatus();
		console.log('Final status:', finalStatus);

		const finalAvailable = bullMQRegistry.isAvailable();
		console.log('Final availability:', finalAvailable);

		if (finalAvailable) {
			console.log('\n✅ BullMQ Registry is working correctly!');

			// Test queue creation
			console.log('\n🧪 Testing queue creation...');
			const testQueue = bullMQRegistry.getQueue('test-queue');
			if (testQueue) {
				console.log('✅ Test queue created successfully');

				// Test job addition
				console.log('\n🧪 Testing job addition...');
				const job = await testQueue.add('test-job', { data: 'test' });
				console.log('✅ Job added successfully:', job.id);

				// Clean up
				await testQueue.close();
				console.log('✅ Test queue closed');
			} else {
				console.log('❌ Failed to create test queue');
			}
		} else {
			console.log('\n❌ BullMQ Registry is still not available');
			console.log('Connection details:', finalStatus);
		}
	} catch (error) {
		console.error('❌ Test failed:', error.message);
		console.error('Stack:', error.stack);
	} finally {
		// Cleanup
		try {
			await bullMQRegistry.shutdown();
			console.log('\n👋 BullMQ Registry shutdown complete');
		} catch (error) {
			console.error('Shutdown error:', error.message);
		}
		process.exit(0);
	}
}

// Run the test
testFixedRegistry();
