import { jwtKeyManager } from '../../../shared/src/utils/JwtKeyManager.js';

(async () => {
	try {
		await jwtKeyManager.rotateKeys('user');
		console.log('[RotateKeys] User keys rotated successfully');
	} catch (err) {
		console.error('[RotateKeys] Failed to rotate user keys', err);
		process.exit(1);
	} finally {
		process.exit(0);
	}
})();
