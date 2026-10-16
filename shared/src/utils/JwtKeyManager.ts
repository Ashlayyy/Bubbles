import { generateKeyPairSync, createPublicKey } from 'crypto';
import { SignJWT, jwtVerify, KeyLike } from 'jose';
import { RedisConnectionFactory } from './RedisConnectionFactory.js';
import type { Redis } from 'ioredis';

export type JwtFamily = 'user' | 'bot';

interface CachedSigner {
	kid: string;
	privateKey: any;
}

export class JwtKeyManager {
	private static instance: JwtKeyManager;
	private get redis(): Redis {
		return RedisConnectionFactory.getSharedConnection();
	}
	private cache = new Map<JwtFamily, CachedSigner>();

	private constructor() {
		// Redis connection now managed by factory
	}

	static getInstance(): JwtKeyManager {
		if (!this.instance) this.instance = new JwtKeyManager();
		return this.instance;
	}

	private namespace(fam: JwtFamily) {
		return fam === 'user'
			? process.env.JWT_KEY_NAMESPACE_USER || 'jwt:user'
			: process.env.JWT_KEY_NAMESPACE_BOT || 'jwt:bot';
	}

	/** Ensure at least one active key exists for a family and return latest kid */
	private async ensureKeyPair(fam: JwtFamily): Promise<string> {
		const ns = this.namespace(fam);
		const latestKey = await this.redis.get(`${ns}:latest`);
		if (latestKey) return latestKey;

		// Generate new keys (RSA 2048)
		const { privateKey, publicKey } = generateKeyPairSync('rsa', {
			modulusLength: 2048,
		});

		const kid = Date.now().toString(36);

		await Promise.all([
			this.redis.set(
				`${ns}:private:${kid}`,
				privateKey.export({ format: 'pem', type: 'pkcs1' }).toString()
			),
			this.redis.set(
				`${ns}:public:${kid}`,
				publicKey.export({ format: 'pem', type: 'pkcs1' }).toString()
			),
			this.redis.set(`${ns}:latest`, kid),
		]);

		return kid;
	}

	/** Returns signer for given family, caching key in memory until pointer changes */
	private async getSigner(fam: JwtFamily): Promise<CachedSigner> {
		const ns = this.namespace(fam);
		const latestKid = await this.ensureKeyPair(fam);

		const cached = this.cache.get(fam);
		if (cached && cached.kid === latestKid) return cached;

		// load private key from Redis
		const pem = (await this.redis.get(`${ns}:private:${latestKid}`)) as string;
		if (!pem)
			throw new Error('Private key missing in Redis for kid ' + latestKid);

		const keyObj = createPublicKey(pem); // Actually we need private key – but jose accepts KeyLike; use crypto.createPrivateKey
		const { createPrivateKey } = await import('crypto');
		const privateKey = createPrivateKey(pem);

		const signer: CachedSigner = { kid: latestKid, privateKey };
		this.cache.set(fam, signer);
		return signer;
	}

	/** Sign payload returning JWT */
	async sign(
		fam: JwtFamily,
		payload: Record<string, unknown>,
		expiresIn: string | number = '24h'
	): Promise<string> {
		const { privateKey, kid } = await this.getSigner(fam);
		return await new SignJWT(payload)
			.setProtectedHeader({ alg: 'RS256', kid })
			.setExpirationTime(expiresIn)
			.sign(privateKey);
	}

	/** Verify JWT and return payload */
	async verify(
		fam: JwtFamily,
		token: string
	): Promise<Record<string, unknown>> {
		const decodedHeader = JSON.parse(
			Buffer.from(token.split('.')[0], 'base64url').toString()
		);
		const kid: string = decodedHeader.kid;
		const ns = this.namespace(fam);
		const pem = await this.redis.get(`${ns}:public:${kid}`);
		if (!pem) throw new Error('Public key not found for kid ' + kid);
		const { createPublicKey } = await import('crypto');
		const publicKey = createPublicKey(pem);
		const { payload } = await jwtVerify(token, publicKey);
		return payload as Record<string, unknown>;
	}

	/** Rotate keys for a family – generate new pair and update latest pointer */
	async rotateKeys(fam: JwtFamily): Promise<void> {
		await this.ensureKeyPair(fam); // generates if none
		// Force new generation regardless of existing
		const { privateKey, publicKey } = generateKeyPairSync('rsa', {
			modulusLength: 2048,
		});
		const kid = Date.now().toString(36);
		const ns = this.namespace(fam);
		await Promise.all([
			this.redis.set(
				`${ns}:private:${kid}`,
				privateKey.export({ format: 'pem', type: 'pkcs1' }).toString()
			),
			this.redis.set(
				`${ns}:public:${kid}`,
				publicKey.export({ format: 'pem', type: 'pkcs1' }).toString()
			),
			this.redis.set(`${ns}:latest`, kid),
		]);
		// Clear cache so next sign picks new key
		this.cache.delete(fam);
	}
}

export const jwtKeyManager = JwtKeyManager.getInstance();
