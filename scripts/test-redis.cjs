const Redis = require('ioredis');
const redis = new Redis({ host: '127.0.0.1', port: 6379 });

setInterval(async () => {
	try {
		const pong = await redis.ping();
		console.log('PING:', pong);
	} catch (e) {
		console.error('Redis error:', e);
	}
}, 2000);
