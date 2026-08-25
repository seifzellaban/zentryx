# Zentryx — M1 Deployment Runbook

**Scope:** M1 Foundation deploy to Hetzner/Coolify with managed Neon Postgres (NFR-006). Covers Neon setup, environment values, Coolify deployment, smoke verification against the M1 exit criteria (PRD Release Plan), and rollback. LiveKit/coturn is M2 (D-06) and is out of scope here.

---

## 1. Neon production setup

1. Create a Neon project named `zentryx-prod`. Its default branch is production. Do not share branches with dev/CI — create separate projects or branches per NFR-006.
2. Copy the **pooled** connection string (hostname contains `-pooler`) for the app runtime:

   ```
   postgresql://<user>:<password>@<endpoint>-pooler.<region>.aws.neon.tech/neondb?sslmode=require
   ```

   Why pooled: `packages/db/src/index.ts` connects through Drizzle's Neon HTTP driver (`drizzle-orm/neon-http` over `@neondatabase/serverless`). Every query is an HTTP request, so connection reuse happens at Neon's pooler, not in-process. The pooled endpoint also protects against Postgres max-connection limits and absorbs scale-to-zero cold starts (risk R-07). Keep the unpooled (direct) string stored for break-glass admin use only.

3. Enable **point-in-time recovery** on the project/branch (Neon console → Branch → Restore → configure history retention). Requirement: NFR-007, RPO ≤ 15 min, RTO ≤ 4h.
4. Apply the schema from your workstation — no migrations exist yet; M1 uses push:

   ```bash
   # Point DATABASE_URL in apps/server/.env at the Neon POOLED prod string,
   # then from the repo root:
   bun run db:push
   ```

   `drizzle-kit push` reads `DATABASE_URL` from `apps/server/.env` (see `packages/db/drizzle.config.ts`). This creates:

   | Group              | Objects                                                                                                                                                                          |
   | ------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
   | Auth (Better Auth) | tables `user`, `session`, `account`, `verification`                                                                                                                              |
   | Community          | tables `constellation`, `constellation_member`, `constellation_invite`, `cluster`, `cluster_member`, `cluster_join_request`; enums for visibility/type/status/role/request state |
   | Profile            | table `user_profile`                                                                                                                                                             |

---

## 2. Production environment values

Server validation lives in `packages/env/src/server.ts`: `DATABASE_URL` non-empty, `BETTER_AUTH_SECRET` ≥ 32 chars, `BETTER_AUTH_URL` and `CORS_ORIGIN` must be valid URLs. The container fails fast on violation.

Generate the secret once, per environment: `openssl rand -base64 32`.

### Server container (`apps/server`)

| Variable             | Value                       | Notes                                                                    |
| -------------------- | --------------------------- | ------------------------------------------------------------------------ |
| `DATABASE_URL`       | Neon **pooled** prod string | Same string the workstation used for `db:push`                           |
| `BETTER_AUTH_SECRET` | `openssl rand -base64 32`   | Never reuse the dev secret from local `apps/server/.env`                 |
| `BETTER_AUTH_URL`    | `https://api.YOURDOMAIN`    | Public origin of the API; Better Auth builds callbacks/redirects from it |
| `CORS_ORIGIN`        | `https://YOURDOMAIN`        | Exact web origin; overrides the compose-inline `http://localhost:3001`   |

### Web container (`apps/web`)

| Variable                 | Value                    | Notes                                                                                 |
| ------------------------ | ------------------------ | ------------------------------------------------------------------------------------- |
| `SERVER_URL`             | `http://server:3000`     | Internal SSR base URL inside the compose network (compose default is already correct) |
| `NEXT_PUBLIC_SERVER_URL` | `https://api.YOURDOMAIN` | Browser-facing API origin; **baked into the client bundle at Docker BUILD time**      |

> **Build-time trap:** `NEXT_PUBLIC_SERVER_URL` reaches the running web container two ways — as a Docker build arg consumed in `apps/web/Dockerfile` before `bun run build`, and as a runtime env var in `docker-compose.yml`. Only the build arg affects what browsers execute; the runtime value cannot rewrite an already-built bundle. Set `NEXT_PUBLIC_SERVER_URL=https://api.YOURDOMAIN` as a build argument **before the first image build**, or the shipped bundle will point users' browsers at localhost.

> **Never ship dev values:** do not copy `apps/web/.env` / `apps/server/.env` from your workstation into prod. Any `localhost:*` value leaking into prod breaks auth redirects, tRPC calls, and CORS.

---

## 3. Coolify deployment steps

1. In Coolify, create a project/resource from **Docker Compose**, pointing at this repo and branch (`feat/m1-foundation` until merged; then `main`). Compose file: repo-root `docker-compose.yml` (services `server` :3000, `web` :3001).
2. Enter environment variables in the **Coolify UI per service** (Section 2 tables). Do not rely on committed `.env` files — compose declares both `env_file` entries `required: false`, so their absence is safe and intended.
3. For the `web` service, also set the build argument `NEXT_PUBLIC_SERVER_URL=https://api.YOURDOMAIN` in Coolify's compose/build configuration (replaces the compose-default `http://localhost:3000` under `build.args`). Do this before the first build.
4. Map domains and TLS through the Coolify proxy:
   - `api.YOURDOMAIN` → `server:3000`
   - `YOURDOMAIN` → `web:3001`

   Coolify issues certificates automatically once DNS points at the host.

5. Deploy. First-deploy ordering is handled by compose: `web` has `depends_on: { server: { condition: service_healthy } }`, and each service defines its own healthcheck (`GET /` returning OK on :3000 and :3001 respectively). Expect `web` to wait until `server` reports healthy; if the stack stalls, check the `server` service logs for env-validation errors first.

---

## 4. Post-deploy smoke checklist

Run top to bottom; stop at the first failure.

1. API reachable and healthy:
   ```bash
   curl -fsS https://api.YOURDOMAIN/
   # → OK
   ```
2. tRPC health procedure:
   ```bash
   curl -fsS https://api.YOURDOMAIN/trpc/healthCheck
   # → JSON body containing "OK" (tRPC wraps the plain string)
   ```
3. Web loads: open `https://YOURDOMAIN`, confirm the app renders with valid TLS.
4. Sign up through the live UI (email + password). Confirm you land authenticated; verify a row appears in Neon's `user` table (SQL editor) if in doubt.
5. Create a constellation as that user (navigator flow): name it, add one cluster of each visibility — public, members-only, invite-only.
6. Second browser (fresh session): accept the constellation invite. Confirm the new member sees the public cluster, cannot enter the members-only cluster uninvited, and gets denied on the invite-only cluster.
7. Approve flow flips access: as navigator, approve the member's join request on the members-only cluster; reload in the second browser and confirm access now resolves. Deny path leaves access closed.

Steps 3–7 are the M1 exit criteria from the PRD Release Plan.

---

## 5. Rollback & ops notes

- **App rollback:** in Coolify, redeploy the previous successful deployment of the compose stack (Deployments → select prior build → Redeploy). Both services rebuild from the same commit, so a rollback is a whole-stack action.
- **Data rollback:** Neon console → Branch → Restore to a timestamp (PITR, Section 1.3). Restoring creates a new branch head; repoint `DATABASE_URL` if you cut over rather than restore in place.
- **Logs:** Coolify shows per-service stdout/stderr (Service → Logs, filter by `server` / `web`). Locally, `bun run docker:logs` tails both containers.
- **Schema changes:** during M1 all schema changes go through `bun run db:push` deliberately — there are no committed migration files yet (`packages/db/src/migrations` is empty; pre-production posture). Run push against prod only after reviewing the generated SQL diff in the drizzle-kit prompt. Introduce `drizzle-kit generate`/`migrate` before GA.

---

## 6. Not in this runbook

- LiveKit SFU + coturn — M2 per D-06/NFR-006.
- Transactional email provider wiring — later milestone (FR-021 transports).
- Backups beyond Neon PITR; object storage for recordings — M2.
