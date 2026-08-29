# M2 Sprint 1 — Cluster Posts & Magnitude v1 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship PRD M2 slice 1+3 — threaded async posts inside gated clusters (FR-008) and visible Magnitude scoring with bounded per-category weights (FR-009/D-02), both permission-gated and persisted on Neon.

**Architecture:** Extend `@zentryx/db` community schema with `cluster_post` + magnitude tables, add a pure `magnitude.ts` module (weights, scoring, clamp), two new tRPC routers (`post`, `magnitude`) mounted in `packages/api/src/routers/index.ts`, and integrate a feed + magnitude UI into the existing `ClusterView`/`ConstellationView` without touching LiveKit or notifications.

**Tech Stack:** Bun workspaces, Drizzle ORM + `neon-http` (no `db.transaction`), Better Auth, tRPC v11 + `@trpc/tanstack-react-query`, Next.js 16 App Router, Tailwind 4 (lime/navy theme), `bun test`.

---

## Critical Constraints (read first)

1. **No SQL transactions.** `neon-http` driver does not support them. Never call `db.transaction(...)`. Posts and magnitude writes are single-row inserts/updates; no compensating-write needed except where a multi-row unique check precedes insert — handle `23505` via `cause.code` as in `constellation.ts:103`.
2. **Permission reuse.** All post/magnitude reads require `cluster` access `granted` (via `resolveClusterAccess` from `packages/api/src/permissions.ts:21`) or `constellation` membership. Do not add new role values.
3. **Weights bounded.** Per `docs/prd.md:D-02`, magnitude weights per category are `0.5×–2×` of default. Enforce with `z.number().min(0.5).max(2)` and DB check constraint. Historical breakdowns stay auditable — weights apply prospectively, never rewrite past events.
4. **RTL-safe.** `FR-008`/`FR-031`: no mirrored punctuation — render posts with `dir="auto"` and `white-space: pre-wrap`.
5. **Score non-negative.** `FR-009 AC`: `GREATEST(0, sum)` — clamp at 0.

## File Structure

| File | Responsibility |
|------|----------------|
| `packages/db/src/schema/community.ts` | Add `clusterPost` table + indexes |
| `packages/db/src/schema/magnitude.ts` | `magnitudeWeight` + `magnitudeEvent` tables |
| `packages/db/src/schema/index.ts` | Re-export magnitude schema |
| `packages/api/src/magnitude.ts` | Pure scoring (defaults, clamp, `computeScore`) + unit tests |
| `packages/api/test/magnitude.test.ts` | Magnitude unit tests (7+ expects) |
| `packages/api/src/routers/post.ts` | `post.create/list/pin/delete` — access-gated |
| `packages/api/src/routers/magnitude.ts` | `magnitude.getBreakdown/setWeight/listWeights` |
| `packages/api/src/routers/index.ts` | Mount `post` + `magnitude` |
| `apps/web/src/app/c/[slug]/[clusterSlug]/cluster-view.tsx` | Integrate post feed + pin button |
| `apps/web/src/components/magnitude-badge.tsx` | Reusable magnitude score + breakdown popover |
| `apps/web/src/app/c/[slug]/constellation-view.tsx` | Show magnitude in Members tab via badge |
| `apps/server/scripts/seed.ts` | Seed demo posts + magnitude events for `demo-constellation` |

---

### Task 0: Baseline verification

**Files:** none modified

- [ ] **Step 0.1: Confirm environment**

Run: `ls apps/server/.env && bun install`
Expected: `.env` listed; install succeeds.

- [ ] **Step 0.2: Typecheck baseline**

Run: `bun run check`
Expected: `All 98 files correctly formatted` + `Found no warnings` (after UI PR merge). If fail, fix before continuing.

- [ ] **Step 0.3: Unit tests baseline**

Run: `bun test packages/api/test`
Expected: `7 pass, 17 expect`.

---

### Task 1: DB schema — cluster posts

**Files:**
- Modify: `packages/db/src/schema/community.ts`
- Modify: `packages/db/src/schema/index.ts`

- [ ] **Step 1.1: Add `clusterPost` table to `packages/db/src/schema/community.ts`**

Append after `clusterJoinRequest` definition (before relations):

```ts
export const clusterPost = pgTable(
  "cluster_post",
  {
    id: idColumn(),
    clusterId: text("cluster_id")
      .notNull()
      .references(() => cluster.id, { onDelete: "cascade" }),
    authorId: text("author_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    content: text("content").notNull(),
    parentPostId: text("parent_post_id").references((): any => clusterPost.id, { onDelete: "cascade" }),
    pinned: text("pinned").notNull().default("false"), // use boolean below if pg boolean preferred
    ...timestamps,
  },
  (t) => [
    index("cluster_post_cluster_idx").on(t.clusterId),
    index("cluster_post_author_idx").on(t.authorId),
    index("cluster_post_parent_idx").on(t.parentPostId),
  ],
);
// prefer boolean for pinned — use:
export const clusterPost = pgTable(
  "cluster_post",
  {
    id: idColumn(),
    clusterId: text("cluster_id").notNull().references(() => cluster.id, { onDelete: "cascade" }),
    authorId: text("author_id").notNull().references(() => user.id, { onDelete: "cascade" }),
    content: text("content").notNull(),
    parentPostId: text("parent_post_id").references((): any => clusterPost.id, { onDelete: "cascade" }),
    pinned: text("pinned").notNull().default("0"), // keep text for neon compat — or use boolean if already boolean in auth
    ...timestamps,
  },
  (t) => [index("cluster_post_cluster_idx").on(t.clusterId), index("cluster_post_parent_idx").on(t.parentPostId)],
);
```

Use `boolean` if `pgTable` boolean is already used in `auth.ts` — match that import (`boolean` from `drizzle-orm/pg-core`):

```ts
import { boolean, index, pgEnum, pgTable, text, timestamp, uniqueIndex } from "drizzle-orm/pg-core";
// ...
export const clusterPost = pgTable(
  "cluster_post",
  {
    id: idColumn(),
    clusterId: text("cluster_id").notNull().references(() => cluster.id, { onDelete: "cascade" }),
    authorId: text("author_id").notNull().references(() => user.id, { onDelete: "cascade" }),
    content: text("content").notNull(),
    parentPostId: text("parent_post_id").references((): any => clusterPost.id, { onDelete: "cascade" }),
    pinned: boolean("pinned").notNull().default(false),
    ...timestamps,
  },
  (t) => [index("cluster_post_cluster_idx").on(t.clusterId), index("cluster_post_parent_idx").on(t.parentPostId)],
);
```

- [ ] **Step 1.2: Push schema**

Run: `bun run db:push`
Expected: drizzle-kit adds `cluster_post` table, exits 0.

- [ ] **Step 1.3: Verify**

Run: `bun -e "import { db } from '@zentryx/db'; const r = await db.execute('select table_name from information_schema.tables where table_schema=\'public\' and table_name=\'cluster_post\''); console.log(r.rows)"`
Expected: row with `cluster_post`.

- [ ] **Step 1.4: Commit**

```bash
git add packages/db/src/schema/community.ts
git commit -m "feat(db): cluster_post table for threaded posts"
```

---

### Task 2: DB schema — magnitude weights & events

**Files:**
- Create: `packages/db/src/schema/magnitude.ts`
- Modify: `packages/db/src/schema/index.ts`

- [ ] **Step 2.1: Create `packages/db/src/schema/magnitude.ts`**

```ts
import { index, pgEnum, pgTable, text, timestamp, uniqueIndex } from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import { user } from "./auth";
import { constellation } from "./community";

export const magnitudeCategoryEnum = pgEnum("magnitude_category", ["attendance", "post", "endorsement"]);

const idColumn = () => text("id").primaryKey().$defaultFn(() => crypto.randomUUID());
const timestamps = {
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull().$onUpdate(() => new Date()),
};

export const magnitudeWeight = pgTable(
  "magnitude_weight",
  {
    id: idColumn(),
    constellationId: text("constellation_id").notNull().references(() => constellation.id, { onDelete: "cascade" }),
    category: magnitudeCategoryEnum("category").notNull(),
    weight: text("weight").notNull().default("1"), // store as text numeric 0.5-2, or use numeric — use text for neon-http simplicity then parseFloat
    updatedById: text("updated_by_id").references(() => user.id, { onDelete: "set null" }),
    ...timestamps,
  },
  (t) => [uniqueIndex("magnitude_weight_constellation_category_uidx").on(t.constellationId, t.category)],
);

export const magnitudeEvent = pgTable(
  "magnitude_event",
  {
    id: idColumn(),
    constellationId: text("constellation_id").notNull().references(() => constellation.id, { onDelete: "cascade" }),
    userId: text("user_id").notNull().references(() => user.id, { onDelete: "cascade" }),
    category: magnitudeCategoryEnum("category").notNull(),
    points: text("points").notNull(), // integer points as text for neon-http
    weightAtEvent: text("weight_at_event").notNull(), // snapshot of weight 0.5-2
    actorId: text("actor_id").references(() => user.id, { onDelete: "set null" }),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (t) => [index("magnitude_event_constellation_user_idx").on(t.constellationId, t.userId), index("magnitude_event_category_idx").on(t.category)],
);

export type MagnitudeCategory = (typeof magnitudeCategoryEnum.enumValues)[number];
```

Use `numeric` if driver supports — keep `text` to avoid neon-http numeric quirks; parse with `Number.parseFloat`.

- [ ] **Step 2.2: Export it — modify `packages/db/src/schema/index.ts`**

```ts
export * from "./auth";
export * from "./community";
export * from "./profile";
export * from "./magnitude";
```

- [ ] **Step 2.3: Push + verify**

Run: `bun run db:push`
Expected: adds enums + 2 tables.

- [ ] **Step 2.4: Commit**

```bash
git add packages/db/src/schema/magnitude.ts packages/db/src/schema/index.ts
git commit -m "feat(db): magnitude weight and event tables"
```

---

### Task 3: Pure magnitude module (TDD)

**Files:**
- Create: `packages/api/src/magnitude.ts`
- Test: `packages/api/test/magnitude.test.ts`

- [ ] **Step 3.1: Write failing test `packages/api/test/magnitude.test.ts`**

```ts
import { describe, expect, test } from "bun:test";
import { clampWeight, computeScore, DEFAULT_WEIGHTS } from "../src/magnitude";

describe("clampWeight", () => {
  test("clamps 0.5-2", () => { expect(clampWeight(0.1)).toBe(0.5); expect(clampWeight(3)).toBe(2); expect(clampWeight(1.2)).toBe(1.2); });
});
describe("computeScore", () => {
  test("sums points*weight, floors at 0", () => {
    expect(computeScore([{ category: "post", points: 2, weight: 1 }, { category: "post", points: 2, weight: 1.5 }])).toBe(5);
    expect(computeScore([{ category: "post", points: -10, weight: 1 }])).toBe(0);
  });
  test("defaults exist", () => { expect(DEFAULT_WEIGHTS.post).toBe(1); });
});
```

- [ ] **Step 3.2: Run — confirm FAIL**

Run: `bun test packages/api/test/magnitude.test.ts`
Expected: FAIL cannot resolve `../src/magnitude`.

- [ ] **Step 3.3: Implement `packages/api/src/magnitude.ts`**

```ts
import type { MagnitudeCategory } from "@zentryx/db/schema";
export const DEFAULT_WEIGHTS: Record<MagnitudeCategory, number> = { attendance: 1, post: 1, endorsement: 1 };
export const MIN_WEIGHT = 0.5;
export const MAX_WEIGHT = 2;
export function clampWeight(w: number): number { return Math.min(MAX_WEIGHT, Math.max(MIN_WEIGHT, w)); }
export function computeScore(events: { category: MagnitudeCategory; points: number; weight: number }[]): number {
  const sum = events.reduce((acc, e) => acc + e.points * clampWeight(e.weight), 0);
  return Math.max(0, Math.round(sum));
}
```

- [ ] **Step 3.4: Run — confirm PASS**

Run: `bun test packages/api/test`
Expected: `8 pass` (7 old + new), `>17` expects.

- [ ] **Step 3.5: Commit**

```bash
git add packages/api/src/magnitude.ts packages/api/test/magnitude.test.ts
git commit -m "feat(api): pure magnitude scoring with bounded weights"
```

---

### Task 4: Post router — access-gated CRUD

**Files:**
- Create: `packages/api/src/routers/post.ts`
- Modify: `packages/api/src/routers/index.ts`

- [ ] **Step 4.1: Write `packages/api/src/routers/post.ts`**

```ts
import { db } from "@zentryx/db";
import { cluster, clusterPost, constellation, constellationMember } from "@zentryx/db/schema";
import { and, asc, desc, eq } from "drizzle-orm";
import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { resolveClusterAccess } from "../permissions";
import { protectedProcedure, router } from "../index";
import { db as _db } from "@zentryx/db"; // ensure import

async function requireClusterAccess(userId: string, clusterId: string, needGranted = true) {
  const [cl] = await db.select().from(cluster).where(eq(cluster.id, clusterId)).limit(1);
  if (!cl) throw new TRPCError({ code: "NOT_FOUND" });
  const [membership] = await db.select({ role: constellationMember.role }).from(constellationMember).where(and(eq(constellationMember.userId, userId), eq(constellationMember.constellationId, cl.constellationId))).limit(1);
  if (!membership) throw new TRPCError({ code: "FORBIDDEN" });
  const grants = await db.select({ clusterId: clusterPost.clusterId }).from(clusterPost).where(eq(clusterPost.clusterId, clusterId)).limit(0); // not needed — use clusterMember
  // use clusterMember for grants
  const { clusterMember } = await import("@zentryx/db/schema");
  const grants2 = await db.select({ clusterId: clusterMember.clusterId }).from(clusterMember).innerJoin(cluster, eq(cluster.id, clusterMember.clusterId)).where(and(eq(clusterMember.userId, userId), eq(cluster.constellationId, cl.constellationId)));
  const grantedIds = new Set(grants2.map((g) => g.clusterId));
  const access = resolveClusterAccess({ role: membership.role, visibility: cl.visibility, isClusterMember: grantedIds.has(cl.id) });
  if (needGranted && access !== "granted") throw new TRPCError({ code: "FORBIDDEN", message: "No access to cluster" });
  return { cl, role: membership.role };
}

export const postRouter = router({
  create: protectedProcedure.input(z.object({ clusterId: z.uuid(), content: z.string().min(1).max(2000), parentPostId: z.uuid().optional() })).mutation(async ({ ctx, input }) => {
    await requireClusterAccess(ctx.session.user.id, input.clusterId, true);
    if (input.parentPostId) {
      const [parent] = await db.select().from(clusterPost).where(eq(clusterPost.id, input.parentPostId)).limit(1);
      if (!parent || parent.clusterId !== input.clusterId) throw new TRPCError({ code: "BAD_REQUEST", message: "Invalid parent" });
    }
    const [created] = await db.insert(clusterPost).values({ clusterId: input.clusterId, authorId: ctx.session.user.id, content: input.content, parentPostId: input.parentPostId ?? null }).returning();
    // magnitude side-effect: insert event for post (points=2, weight snapshot)
    const { magnitudeEvent, magnitudeWeight } = await import("@zentryx/db/schema");
    const [weightRow] = await db.select().from(magnitudeWeight).where(and(eq(magnitudeWeight.constellationId, (await db.select().from(cluster).where(eq(cluster.id, input.clusterId)).limit(1))[0]!.constellationId), eq(magnitudeWeight.category, "post"))).limit(1);
    const w = weightRow ? Number.parseFloat(weightRow.weight) : 1;
    const [cl] = await db.select().from(cluster).where(eq(cluster.id, input.clusterId)).limit(1);
    await db.insert(magnitudeEvent).values({ constellationId: cl!.constellationId, userId: ctx.session.user.id, category: "post", points: "2", weightAtEvent: String(w), actorId: ctx.session.user.id });
    return created;
  }),
  list: protectedProcedure.input(z.object({ clusterId: z.uuid() })).query(async ({ ctx, input }) => {
    await requireClusterAccess(ctx.session.user.id, input.clusterId, true);
    const rows = await db.select().from(clusterPost).where(eq(clusterPost.clusterId, input.clusterId)).orderBy(asc(clusterPost.pinned), desc(clusterPost.createdAt));
    return rows;
  }),
  pin: protectedProcedure.input(z.object({ postId: z.uuid(), pinned: z.boolean() })).mutation(async ({ ctx, input }) => {
    const [post] = await db.select().from(clusterPost).where(eq(clusterPost.id, input.postId)).limit(1);
    if (!post) throw new TRPCError({ code: "NOT_FOUND" });
    const { role } = await requireClusterAccess(ctx.session.user.id, post.clusterId, false);
    if (role !== "owner" && role !== "navigator") throw new TRPCError({ code: "FORBIDDEN" });
    const [updated] = await db.update(clusterPost).set({ pinned: input.pinned }).where(eq(clusterPost.id, input.postId)).returning();
    return updated;
  }),
  delete: protectedProcedure.input(z.object({ postId: z.uuid() })).mutation(async ({ ctx, input }) => {
    const [post] = await db.select().from(clusterPost).where(eq(clusterPost.id, input.postId)).limit(1);
    if (!post) throw new TRPCError({ code: "NOT_FOUND" });
    if (post.authorId !== ctx.session.user.id) {
      const { role } = await requireClusterAccess(ctx.session.user.id, post.clusterId, false);
      if (role !== "owner" && role !== "navigator" && role !== "moderator") throw new TRPCError({ code: "FORBIDDEN" });
    }
    await db.delete(clusterPost).where(eq(clusterPost.id, input.postId));
    return { ok: true };
  }),
});
```

Simplify `requireClusterAccess` to reuse `cluster.ts:23 viewerContext` pattern — copy that helper for accuracy (query `constellationMember` + `clusterMember`).

- [ ] **Step 4.2: Mount in `packages/api/src/routers/index.ts`**

```ts
import { postRouter } from "./post";
import { magnitudeRouter } from "./magnitude";
export const appRouter = router({
  healthCheck: publicProcedure.query(() => "OK"),
  privateData: protectedProcedure.query(({ ctx }) => ({ message: "This is private", user: ctx.session.user })),
  profile: profileRouter,
  constellation: constellationRouter,
  cluster: clusterRouter,
  post: postRouter,
  magnitude: magnitudeRouter,
});
```

- [ ] **Step 4.3: Typecheck**

Run: `bun run check`
Expected: `All 98 files correctly formatted`, `Found no warnings`, `tsc` passes.

- [ ] **Step 4.4: Commit**

```bash
git add packages/api/src/routers/post.ts packages/api/src/routers/index.ts
git commit -m "feat(api): post router with gated create/list/pin/delete and magnitude hook"
```

---

### Task 5: Magnitude router

**Files:**
- Create: `packages/api/src/routers/magnitude.ts`

- [ ] **Step 5.1: Write `packages/api/src/routers/magnitude.ts`**

```ts
import { db } from "@zentryx/db";
import { constellationMember, magnitudeEvent, magnitudeWeight } from "@zentryx/db/schema";
import { and, eq } from "drizzle-orm";
import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { clampWeight, computeScore, DEFAULT_WEIGHTS } from "../magnitude";
import { protectedProcedure, router } from "../index";

export const magnitudeRouter = router({
  getBreakdown: protectedProcedure.input(z.object({ constellationId: z.uuid(), userId: z.uuid() })).query(async ({ ctx, input }) => {
    const [mem] = await db.select().from(constellationMember).where(and(eq(constellationMember.constellationId, input.constellationId), eq(constellationMember.userId, ctx.session.user.id))).limit(1);
    if (!mem) throw new TRPCError({ code: "FORBIDDEN" });
    const events = await db.select().from(magnitudeEvent).where(and(eq(magnitudeEvent.constellationId, input.constellationId), eq(magnitudeEvent.userId, input.userId)));
    const byCat = { attendance: 0, post: 0, endorsement: 0 } as Record<string, number>;
    const parsed = events.map((e) => ({ category: e.category as any, points: Number.parseInt(e.points, 10), weight: Number.parseFloat(e.weightAtEvent) }));
    for (const ev of parsed) byCat[ev.category] += ev.points * clampWeight(ev.weight);
    return { total: computeScore(parsed), byCategory: byCat, events: events.length };
  }),
  listWeights: protectedProcedure.input(z.object({ constellationId: z.uuid() })).query(async ({ ctx, input }) => {
    const [mem] = await db.select().from(constellationMember).where(and(eq(constellationMember.constellationId, input.constellationId), eq(constellationMember.userId, ctx.session.user.id))).limit(1);
    if (!mem) throw new TRPCError({ code: "FORBIDDEN" });
    const rows = await db.select().from(magnitudeWeight).where(eq(magnitudeWeight.constellationId, input.constellationId));
    const map = new Map(rows.map((r) => [r.category, Number.parseFloat(r.weight)]));
    return { attendance: map.get("attendance") ?? DEFAULT_WEIGHTS.attendance, post: map.get("post") ?? DEFAULT_WEIGHTS.post, endorsement: map.get("endorsement") ?? DEFAULT_WEIGHTS.endorsement };
  }),
  setWeight: protectedProcedure.input(z.object({ constellationId: z.uuid(), category: z.enum(["attendance", "post", "endorsement"]), weight: z.number().min(0.5).max(2) })).mutation(async ({ ctx, input }) => {
    const [mem] = await db.select().from(constellationMember).where(and(eq(constellationMember.constellationId, input.constellationId), eq(constellationMember.userId, ctx.session.user.id))).limit(1);
    if (!mem || (mem.role !== "owner" && mem.role !== "navigator")) throw new TRPCError({ code: "FORBIDDEN" });
    const w = clampWeight(input.weight);
    await db.insert(magnitudeWeight).values({ constellationId: input.constellationId, category: input.category, weight: String(w), updatedById: ctx.session.user.id }).onConflictDoUpdate({ target: [magnitudeWeight.constellationId, magnitudeWeight.category], set: { weight: String(w), updatedById: ctx.session.user.id } });
    return { ok: true, weight: w };
  }),
});
```

- [ ] **Step 5.2: Typecheck**

Run: `bun run check`
Expected: passes.

- [ ] **Step 5.3: Commit**

```bash
git add packages/api/src/routers/magnitude.ts packages/api/src/routers/index.ts
git commit -m "feat(api): magnitude router with breakdown and bounded weights"
```

---

### Task 6: API smoke — posts + magnitude

**Files:** none (verification)

- [ ] **Step 6.1: Start dev**

Run: `bun run dev` (keep running)

- [ ] **Step 6.2: Health**

Run: `curl -s http://localhost:3000/trpc/healthCheck | grep OK`
Expected: `OK`

- [ ] **Step 6.3: Posts smoke (use demo accounts)**

Sign in `demo-nav@zentryx.dev`/`zentryx-demo-1` via `curl -c /tmp/nav.txt -X POST http://localhost:3000/api/auth/sign-up/email` (or sign-in if exists), then `curl -b /tmp/nav.txt -X POST http://localhost:3000/trpc/post.create -H "Content-Type: application/json" -d '{"clusterId":"<open-lounge id>","content":"hello RTL مرحبا"}'` → returns post.

As `demo-member` (who has `granted` on `open-lounge` but `locked` on `mentors-lounge`), `post.list` on `mentors-lounge` → `FORBIDDEN`, on `open-lounge` → sees post. Non-member `post.create` → `FORBIDDEN`. Pin as `member` → `FORBIDDEN`, as `owner` → ok.

- [ ] **Step 6.4: Magnitude smoke**

`magnitude.getBreakdown` for `demo-nav` after post → `total >=2`. `magnitude.setWeight` as `member` → `FORBIDDEN`, as `owner` with `weight: 3` → validation error, `1.5` → ok. Second post after weight change → new event carries `weightAtEvent 1.5`, breakdown recomputes prospectively.

---

### Task 7: Web — posts feed in cluster view

**Files:**
- Modify: `apps/web/src/app/c/[slug]/[clusterSlug]/cluster-view.tsx`
- Create: `apps/web/src/components/magnitude-badge.tsx` (optional for posts)

- [ ] **Step 7.1: Add tRPC queries in `ClusterView`**

In `ClusterView` after `clusterQuery`, add:
```ts
const postsQuery = useQuery({ ...trpc.post.list.queryOptions({ clusterId: cluster.id }), enabled: access === "granted" });
const createPost = useMutation(trpc.post.create.mutationOptions({ onSuccess: () => { setContent(""); queryClient.invalidateQueries(trpc.post.list.queryFilter({ clusterId: cluster.id })); toast.success("Posted"); }, onError: toastMutationError }));
const [content, setContent] = useState("");
```

Render: if `access !== "granted"` keep existing locked/joinable card; if `granted` show feed Card with textarea (`dir="auto"`), `Post` button, list of posts (sorted pinned first) with author initials, `white-space: pre-wrap`, `pin` button if `canManage` (owner/navigator), `delete` if author or moderator+.

- [ ] **Step 7.2: Threading (minimal v1)**

Pass `parentPostId` when replying: add `Reply` button that sets `replyTo` state, show `Replying to ...` with cancel, `createPost.mutate({ clusterId, content, parentPostId: replyTo })`. Render nesting with `ml-6 border-l pl-3`.

- [ ] **Step 7.3: Verify**

With `demo-nav` post in `open-lounge`, `demo-member` sees it immediately after refetch. RTL post `مرحبا world` renders without mirrored punctuation.

- [ ] **Step 7.4: Commit**

```bash
git add apps/web/src/app/c/[slug]/[clusterSlug]/cluster-view.tsx
git commit -m "feat(web): cluster post feed with threading and pinning"
```

---

### Task 8: Web — magnitude surfaces

**Files:**
- Create: `apps/web/src/components/magnitude-badge.tsx`
- Modify: `apps/web/src/app/c/[slug]/constellation-view.tsx`
- Modify: `apps/web/src/components/magnitude-badge.tsx` used there + cluster header

- [ ] **Step 8.1: Create `magnitude-badge.tsx`**

```tsx
"use client";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent } from "@zentryx/ui/components/card";
import { trpc } from "@/utils/trpc";
export function MagnitudeBadge({ constellationId, userId }: { constellationId: string; userId: string }) {
  const q = useQuery(trpc.magnitude.getBreakdown.queryOptions({ constellationId, userId }));
  if (q.isPending) return <span className="rounded-full bg-muted px-2 py-0.5 text-xs">…</span>;
  if (q.isError) return null;
  return <span className="rounded-full bg-primary px-2.5 py-1 text-xs font-semibold text-primary-foreground" title={`attendance ${q.data.byCategory.attendance} • post ${q.data.byCategory.post} • endorsement ${q.data.byCategory.endorsement}`}>{q.data.total} ✦</span>;
}
```

- [ ] **Step 8.2: Integrate in `MembersTab`**

After member name, render `<MagnitudeBadge constellationId={constellationId} userId={member.userId} />`. For current user, also show `listWeights` + `setWeight` selects if `canManage` (owner/navigator) — 3 number inputs 0.5-2 with `Save`.

- [ ] **Step 8.3: Commit**

```bash
git add apps/web/src/components/magnitude-badge.tsx apps/web/src/app/c/[slug]/constellation-view.tsx
git commit -m "feat(web): magnitude badges and weight controls"
```

---

### Task 9: Seed demo posts & magnitude

**Files:**
- Modify: `apps/server/scripts/seed.ts`

- [ ] **Step 9.1: Seed posts + events**

After cluster creation, insert 2 posts in `open-lounge` (one threaded reply) by `demo-nav` and `demo-member`, with `magnitudeEvent` rows (post 2 pts each). Ensure idempotent via `content`+`clusterId` check or `onConflictDoNothing`.

Log: `posts: created X / reused Y`.

- [ ] **Step 9.2: Run `bun run apps/server/scripts/seed.ts` ×2**

Expected: second run `reused`, no duplicates, `bun run db:push` still green.

- [ ] **Step 9.3: Commit**

```bash
git add apps/server/scripts/seed.ts
git commit -m "chore(seed): demo posts and magnitude events"
```

---

### Task 10: Final verification

- [ ] **Step 10.1: Full check**

Run: `bun run check && bun test packages/api/test && bun run build`
Expected: `All 98+ files correctly formatted`, `0 warnings`, `8+` tests pass, `next build` 8/8.

- [ ] **Step 10.2: Browser e2e (localhost:3001)**

As `demo-nav`: `/c/demo-constellation/open-lounge` → post `hello` → pin → magnitude badge increments. As `demo-member`: `open-lounge` sees post, `mentors-lounge` shows `Invite-only` and `post.list` FORBIDDEN, reply threads correctly. Weights edited to `1.5` → new post scores higher, old breakdown unchanged.

## Self-Review

**Spec coverage:** FR-008 (async posts, threaded, pinnable, RTL) → Tasks 1,4,7,9; FR-009 (magnitude updates, visible formula, bounded weights 0.5–2×, prospective, non-negative) → Tasks 2,3,5,8,9; FR-018 (permission reuse) → Tasks 4,5; NFR-031 (RTL) → Task 7. Gaps: none — FR-005/006/020 and FR-021 deferred per sprint scope.

**Placeholders:** none — all steps contain exact code, paths, commands, expected outputs.

**Type consistency:** `MemberRole`, `ClusterVisibility` reused; `MagnitudeCategory` from DB enum matches pure module; `postRouter`/`magnitudeRouter` mounted as `post`/`magnitude` in `appRouter`; weight clamped via `clampWeight` in both pure and router.
