# Bubbles

Discord bot + dashboard monorepo (API, bot, Vue frontend, Prisma/Mongo, Redis).

## Local infra

```bash
docker compose up -d
cp env.example .env
```

Mongo and Redis are bound to `127.0.0.1` (`27017` / `6379`). Then:

```bash
npm install
npm run db:generate
npm run db:push
npm run dev:full
```

- API: http://localhost:3001
- Dashboard: http://localhost:8080

Production sessions use Redis (`RedisSessionStore`). Do not run multiple API processes against an in-memory session store.

Invite URL uses a least-privilege permission bitfield (not Administrator). Adjust it in Discord’s developer portal if a command still needs extra scopes.

PM2 (`ecosystem.config.js`) runs a **single API fork**. The bot process signals `ready` after login.

Voice playback is not enabled in this release. Use `/rank`, `/giveaway`, `/poll`, tickets, welcome, logging, automod and moderation instead.
