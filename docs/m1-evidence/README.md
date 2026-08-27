# M1 Exit Evidence — Local Verification

**Branch:** `feat/m1-foundation` at `7aadbb2` (PR #1)
**Date:** 2026-08-27
**Mode:** Localhost only — prod deferred per `docs/todos/prod-move.md:1`

## Gate (from `docs/prd.md:242`)

Real user creates constellation → invites second user → second user sees only permitted clusters.

## Evidence

### 1. Type / lint / format

`bun run check` — 0/4 workspaces, 0 errors. See `check.log`.

### 2. Unit tests

`bun test packages/api/test` — 7 pass, 17 expect. See `tests.log`.

### 3. Seed idempotent

`bun run apps/server/scripts/seed.ts` ×2 — second run all `reused`, zero duplicate rows. See `seed.log`.
Demo accounts: `demo-nav@zentryx.dev` / `demo-member@zentryx.dev` (`zentryx-demo-1`), constellation `demo-constellation` (published), clusters `open-lounge` (public) / `live-trading` (members) / `mentors-lounge` (invite).

### 4. API smoke

Tagged `m1-api-smoke-ok` at `7e1190e`. Full sequence via `curl` + cookie jars:

- Alice `constellation.create` → id+slug
- Alice `cluster.create` ×3 (public/members/invite)
- Alice `constellation.createInvite` → token
- Bob `invitePreview` → name/slug
- Bob `acceptInvite` → slug
- Bob `cluster.listForConstellation` → `general=granted / workouts=joinable / vip=locked` ✅
- Bob `requestAccess` → ok, repeat → `CONFLICT` (now correctly via `err.cause.code`)
- Alice `pendingRequests` → 1 row, `respondToRequest approve` → ok
- Bob re-lists → `workouts=granted` ✅
- Negative matrix (FR-018): `setMemberRole`, `removeMember`, `createInvite`, `cluster.create`, `pendingRequests`, email-bound accept — all `FORBIDDEN` for plain member / wrong account ✅

### 5. Browser e2e (`localhost:3001`)

- `localhost:3001/` — Better T Stack probe, API Connected
- `localhost:3001/constellations/new` — create form (slug auto-derive, CONFLICT toast)
- `localhost:3001/dashboard` — CTA when empty, membership rows when joined
- `localhost:3001/c/[slug]` — tabs Overview (publish gate draft+owner|navigator) / Clusters (strict access) / Members (role selects, pending panel, invite URL+copy)
- `localhost:3001/invite/[token]` — invalid vs valid vs accept → `/c/[slug]`
- `localhost:3001/c/[slug]/[clusterSlug]` — granted empty-state / joinable Request → Requested / locked Invite-only / non-member card

All verified in Tasks 8–12 browser runs (see task reports).

## Tag

`m1-exit` — local gate complete. Prod smoke deferred until Hetzner/Coolify available.
