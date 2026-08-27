# TODO: Prod Move — Hetzner + Coolify + Neon Prod Branch

**Status:** Deferred — no VPS yet. M1 runs fully on localhost.
**Owner:** Seif
**Created:** 2026-08-25 from `feat/m1-foundation` exit gate

## Trigger

You have a Hetzner project + Coolify instance with a domain + DNS.

## What to do (from `docs/deploy-m1.md:1`)

1. **Neon prod branch** — in Neon console create `prod` branch from `main`; copy its **pooled** connection string (`-pooler` host); enable PITR on `prod` (`docs/prd.md:203` RPO ≤15min).
2. **Env vars** — in Coolify UI (not committed `.env`):
   - Server: `DATABASE_URL` (pooled), `BETTER_AUTH_SECRET` (`openssl rand -base64 32`), `BETTER_AUTH_URL=https://api.YOURDOMAIN`, `CORS_ORIGIN=https://YOURDOMAIN`
   - Web build arg: `NEXT_PUBLIC_SERVER_URL=https://api.YOURDOMAIN` — **build-time only**, must be set before first `docker compose build` (`docs/deploy-m1.md:1` explains the trap).
3. **Deploy** — `docker compose up -d --build` via Coolify; verify both healthchecks green (`web:3001`, `server:3000`).
4. **Schema** — point a workstation `apps/server/.env` `DATABASE_URL` at prod pooled URL, run `bun run db:push`, then `bun run apps/server/scripts/seed.ts`.
5. **Smoke** — `curl https://api.YOURDOMAIN/trpc/healthCheck`, sign up in live UI, create constellation, second browser accept invite, verify `general=granted / workouts=joinable→granted / vip=locked`.
6. **Tag** — `git tag m1-prod-smoke-ok && git push --tags`.

## Local verification already done for M1

`bun run check` green (4 workspaces), `bun test packages/api/test` 7 pass, `bun run apps/server/scripts/seed.ts` idempotent, full API smoke (tagged `m1-api-smoke-ok` at `7e1190e`), browser e2e on `localhost:3001` via demo accounts `demo-nav@zentryx.dev` / `demo-member@zentryx.dev` (`zentryx-demo-1`).

## Not in this TODO

LiveKit/coturn (M2), transactional email (M2), backups beyond Neon PITR — all out of M1 per `docs/prd.md:193`.
