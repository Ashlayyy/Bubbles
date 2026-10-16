import session from 'express-session';
import type Redis from 'ioredis';

type SessionData = session.SessionData;

export class RedisSessionStore extends session.Store {
	constructor(
		private readonly client: Redis,
		private readonly prefix = 'sess:'
	) {
		super();
	}

	get(
		sid: string,
		callback: (err: unknown, session?: SessionData | null) => void
	): void {
		this.client
			.get(this.prefix + sid)
			.then((data) => {
				callback(null, data ? (JSON.parse(data) as SessionData) : null);
			})
			.catch(callback);
	}

	set(sid: string, sess: SessionData, callback?: (err?: unknown) => void): void {
		const maxAge = sess.cookie?.maxAge;
		const ttl = Math.ceil((typeof maxAge === 'number' ? maxAge : 8 * 60 * 60 * 1000) / 1000);
		this.client
			.setex(this.prefix + sid, ttl, JSON.stringify(sess))
			.then(() => callback?.())
			.catch(callback);
	}

	destroy(sid: string, callback?: (err?: unknown) => void): void {
		this.client
			.del(this.prefix + sid)
			.then(() => callback?.())
			.catch(callback);
	}
}
