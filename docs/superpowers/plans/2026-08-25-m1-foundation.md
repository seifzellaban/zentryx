# M1 Foundation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship PRD milestone M1 — a real user signs up, creates a constellation, invites a second user, and the second user sees only the clusters they are permitted to see.

**Architecture:** Extend the existing Better T Stack monorepo. New `community` schema tables in `@zentryx/db`, a pure permission module in `@zentryx/api`, three new tRPC routers (`profile`, `constellation`, `cluster`), and four new web routes under `apps/web`. No new runtime dependencies.

**Tech Stack:** Bun workspaces, Drizzle ORM + Neon Postgres (`neon-http` driver), Better Auth (email+password), tRPC v11 + `@trpc/tanstack-react-query`, Next.js 16 App Router, Tailwind 4, `bun test`.

**Spec:** `docs/prd.md` §Release Plan M1; FR-001–004, FR-016–019, NFR-006.

---

## Critical Constraints (read first)

1. **No SQL transactions.** The `neon-http` driver does not support them. Every multi-table write uses a _compensating write_ pattern (insert parent → insert child → on child failure, delete parent). Never call `db.transaction(...)`. **Documented exception:** `profile.update`'s user-name + profile-upsert pair is intentionally uncompensated — both writes are idempotent, same-owner, and independently retriable, so partial application self-heals on retry without data loss. Compensation remains mandatory wherever partial state is unrecoverable or user-visible to others (e.g., `constellation.create`).
2. **Next.js 16 breaking changes.** Before writing any file under `apps/web/src/app`, read the relevant guide in `apps/web/node_modules/next/dist/docs/` (per `AGENTS.md`). Page props `params` are a Promise — `await` it in server components.
3. **Repo style:** no code comments, follow existing file conventions exactly (text IDs via `$defaultFn(crypto.randomUUID())`, `timestamp()` without tz mode, zod v4 validation in every procedure input).
4. **Auth roles take effect on next request** (FR-018) — no cache invalidation machinery needed; do not add any.
5. **Known M1 limitations (accepted, revisit in M2+):** last-owner protection has a theoretical race under concurrent demotions (two owners demoted simultaneously can leave zero owners — recovery currently requires DB access); draft constellations are readable via direct slug access until discovery/search lands (Epic 5) or M2 hardening adds a status gate to public reads; **denied cluster join-requests are final for v1** — the `(clusterId, userId)` unique index means denied (or approved-then-removed) users cannot re-request; re-application flow is a v1.x decision; locked/invite-only cluster names and descriptions remain visible to fellow constellation members (with `access: "locked"`) because the cluster list needs badges — content itself stays gated until M2 chat arrives.

## File Structure

| File                                                                     | Responsibility                                                     |
| ------------------------------------------------------------------------ | ------------------------------------------------------------------ |
| `packages/db/src/schema/community.ts`                                    | Constellation/cluster/member/invite/request tables + enums         |
| `packages/db/src/schema/index.ts`                                        | Re-export community schema                                         |
| `packages/db/src/schema/profile.ts`                                      | `user_profile` table (bio, skills)                                 |
| `packages/api/src/permissions.ts`                                        | Pure permission logic (no DB, fully unit-testable)                 |
| `packages/api/test/permissions.test.ts`                                  | Unit tests for permission logic                                    |
| `packages/api/src/routers/profile.ts`                                    | Profile read/update                                                |
| `packages/api/src/routers/constellation.ts`                              | CRUD, publish, invites, members, roles                             |
| `packages/api/src/routers/cluster.ts`                                    | CRUD, access-filtered listing, join requests                       |
| `packages/api/src/routers/index.ts`                                      | Mount all three routers                                            |
| `apps/web/src/app/(app)/constellations/new/page.tsx` + `create-form.tsx` | Create constellation flow                                          |
| `apps/web/src/app/(app)/dashboard/dashboard.tsx`                         | Membership list + onboarding CTA (edit existing)                   |
| `apps/web/src/app/c/[slug]/page.tsx` + `constellation-view.tsx`          | Overview / Clusters / Members tabs                                 |
| `apps/web/src/app/c/[slug]/[clusterSlug]/page.tsx` + `cluster-view.tsx`  | Cluster stub gated by access                                       |
| `apps/web/src/app/invite/[token]/page.tsx` + `invite-view.tsx`           | Invitation acceptance                                              |
| `apps/server/scripts/seed.ts`                                            | Demo data: two users, one constellation, mixed-visibility clusters |

---

### Task 0: Baseline verification

**Files:** none modified

- [ ] **Step 0.1: Confirm environment**

Run: `ls apps/server/.env && bun install`
Expected: `.env` listed; install succeeds silently.

- [ ] **Step 0.2: Verify `.env` has a real Neon URL and required secrets**

Run: `grep -cE "^DATABASE_URL=postgres|^BETTER_AUTH_SECRET=.+" apps/server/.env`
Expected: `2`. If missing, fill from your Neon dashboard (`postgresql://...neon.tech/neondb?sslmode=require`) and generate the secret with `openssl rand -base64 32`.

- [ ] **Step 0.3: Typecheck baseline**

Run: `bun run check`
Expected: exits 0. Fix nothing yet if it fails — report the pre-existing failure before continuing.

---

### Task 1: Community schema

**Files:**

- Create: `packages/db/src/schema/community.ts`
- Modify: `packages/db/src/schema/index.ts`

- [ ] **Step 1.1: Write `packages/db/src/schema/community.ts`**

```ts
import { relations } from "drizzle-orm";
import { index, pgEnum, pgTable, text, timestamp, uniqueIndex } from "drizzle-orm/pg-core";

import { user } from "./auth";

export const memberRoleEnum = pgEnum("member_role", ["owner", "navigator", "moderator", "member"]);
export const constellationStatusEnum = pgEnum("constellation_status", ["draft", "published"]);
export const clusterVisibilityEnum = pgEnum("cluster_visibility", ["public", "members", "invite"]);
export const clusterTypeEnum = pgEnum("cluster_type", ["discussion", "cohort", "library"]);
export const requestStatusEnum = pgEnum("request_status", ["pending", "approved", "denied"]);

const idColumn = () =>
  text("id")
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID());

const timestamps = {
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at")
    .defaultNow()
    .notNull()
    .$onUpdate(() => new Date()),
};

export const constellation = pgTable("constellation", {
  id: idColumn(),
  slug: text("slug").notNull().unique(),
  name: text("name").notNull(),
  description: text("description").notNull().default(""),
  coverImage: text("cover_image"),
  category: text("category").notNull().default("general"),
  status: constellationStatusEnum("status").notNull().default("draft"),
  createdById: text("created_by_id")
    .notNull()
    .references(() => user.id, { onDelete: "cascade" }),
  ...timestamps,
});

export const constellationMember = pgTable(
  "constellation_member",
  {
    id: idColumn(),
    constellationId: text("constellation_id")
      .notNull()
      .references(() => constellation.id, { onDelete: "cascade" }),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    role: memberRoleEnum("role").notNull().default("member"),
    ...timestamps,
  },
  (t) => [
    uniqueIndex("constellation_member_uidx").on(t.constellationId, t.userId),
    index("constellation_member_user_idx").on(t.userId),
  ],
);

export const constellationInvite = pgTable(
  "constellation_invite",
  {
    id: idColumn(),
    token: text("token").notNull().unique(),
    constellationId: text("constellation_id")
      .notNull()
      .references(() => constellation.id, { onDelete: "cascade" }),
    invitedEmail: text("invited_email"),
    role: memberRoleEnum("role").notNull().default("member"),
    invitedById: text("invited_by_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    expiresAt: timestamp("expires_at").notNull(),
    acceptedAt: timestamp("accepted_at"),
    ...timestamps,
  },
  (t) => [index("constellation_invite_constellation_idx").on(t.constellationId)],
);

export const cluster = pgTable(
  "cluster",
  {
    id: idColumn(),
    constellationId: text("constellation_id")
      .notNull()
      .references(() => constellation.id, { onDelete: "cascade" }),
    slug: text("slug").notNull(),
    name: text("name").notNull(),
    description: text("description").notNull().default(""),
    visibility: clusterVisibilityEnum("visibility").notNull().default("public"),
    type: clusterTypeEnum("type").notNull().default("discussion"),
    createdById: text("created_by_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    ...timestamps,
  },
  (t) => [uniqueIndex("cluster_constellation_slug_uidx").on(t.constellationId, t.slug)],
);

export const clusterMember = pgTable(
  "cluster_member",
  {
    id: idColumn(),
    clusterId: text("cluster_id")
      .notNull()
      .references(() => cluster.id, { onDelete: "cascade" }),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    grantedById: text("granted_by_id").references(() => user.id, {
      onDelete: "set null",
    }),
    ...timestamps,
  },
  (t) => [
    uniqueIndex("cluster_member_uidx").on(t.clusterId, t.userId),
    index("cluster_member_user_idx").on(t.userId),
  ],
);

export const clusterJoinRequest = pgTable(
  "cluster_join_request",
  {
    id: idColumn(),
    clusterId: text("cluster_id")
      .notNull()
      .references(() => cluster.id, { onDelete: "cascade" }),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    status: requestStatusEnum("status").notNull().default("pending"),
    respondedById: text("responded_by_id").references(() => user.id, {
      onDelete: "set null",
    }),
    respondedAt: timestamp("responded_at"),
    ...timestamps,
  },
  (t) => [
    uniqueIndex("cluster_join_request_uidx").on(t.clusterId, t.userId),
    index("cluster_join_request_cluster_idx").on(t.clusterId),
  ],
);

export const constellationRelations = relations(constellation, ({ many }) => ({
  members: many(constellationMember),
  clusters: many(cluster),
}));

export const constellationMemberRelations = relations(constellationMember, ({ one }) => ({
  constellation: one(constellation, {
    fields: [constellationMember.constellationId],
    references: [constellation.id],
  }),
  user: one(user, {
    fields: [constellationMember.userId],
    references: [user.id],
  }),
}));

export const clusterRelations = relations(cluster, ({ one, many }) => ({
  constellation: one(constellation, {
    fields: [cluster.constellationId],
    references: [constellation.id],
  }),
  members: many(clusterMember),
}));

export type MemberRole = (typeof memberRoleEnum.enumValues)[number];
export type ClusterVisibility = (typeof clusterVisibilityEnum.enumValues)[number];
export type ClusterType = (typeof clusterTypeEnum.enumValues)[number];
export type Constellation = typeof constellation.$inferSelect;
export type Cluster = typeof cluster.$inferSelect;
```

- [ ] **Step 1.2: Export it — replace contents of `packages/db/src/schema/index.ts`**

```ts
export * from "./auth";
export * from "./community";
```

- [ ] **Step 1.3: Push schema to Neon**

Run: `bun run db:push`
Expected: drizzle-kit detects 6 new tables + 5 enums, prompts/applies, exits 0.

- [ ] **Step 1.4: Verify tables exist**

Run: `bun -e "import { db } from '@zentryx/db'; const r = await db.execute('select table_name from information_schema.tables where table_schema=\'public\''); console.log(r.rows.map((r:any)=>r.table_name).sort())" `
Expected: includes `constellation`, `constellation_member`, `constellation_invite`, `cluster`, `cluster_member`, `cluster_join_request`.

- [ ] **Step 1.5: Commit**

```bash
git add packages/db/src/schema
git commit -m "feat(db): community schema for constellations, clusters, membership"
```

---

### Task 2: Profile schema

**Files:**

- Create: `packages/db/src/schema/profile.ts`
- Modify: `packages/db/src/schema/index.ts`

- [ ] **Step 2.1: Write `packages/db/src/schema/profile.ts`**

```ts
import { relations } from "drizzle-orm";
import { pgTable, text } from "drizzle-orm/pg-core";

import { user } from "./auth";

export const userProfile = pgTable("user_profile", {
  userId: text("user_id")
    .primaryKey()
    .references(() => user.id, { onDelete: "cascade" }),
  bio: text("bio").notNull().default(""),
  skills: text("skills").array().notNull().default([]),
});

export const userProfileRelations = relations(userProfile, ({ one }) => ({
  user: one(user, { fields: [userProfile.userId], references: [user.id] }),
}));
```

- [ ] **Step 2.2: Add to `packages/db/src/schema/index.ts`**

```ts
export * from "./auth";
export * from "./community";
export * from "./profile";
```

- [ ] **Step 2.3: Push, verify, commit**

Run: `bun run db:push && bun -e "import { db } from '@zentryx/db'; console.log(await db.execute('select column_name from information_schema.columns where table_name=\'user_profile\''))"`

```bash
git add packages/db/src/schema
git commit -m "feat(db): user profile table with bio and skills"
```

---

### Task 3: Permission module (TDD)

**Files:**

- Create: `packages/api/src/permissions.ts`
- Test: `packages/api/test/permissions.test.ts`

- [ ] **Step 3.1: Write the failing test `packages/api/test/permissions.test.ts`**

```ts
import { describe, expect, test } from "bun:test";

import { canManageConstellation, hasRole, resolveClusterAccess } from "../src/permissions";

describe("hasRole", () => {
  test("ranks correctly", () => {
    expect(hasRole("owner", "navigator")).toBe(true);
    expect(hasRole("navigator", "owner")).toBe(false);
    expect(hasRole("member", "member")).toBe(true);
    expect(hasRole("moderator", "navigator")).toBe(false);
  });
});

describe("canManageConstellation", () => {
  test("navigator and above manage", () => {
    expect(canManageConstellation("owner")).toBe(true);
    expect(canManageConstellation("navigator")).toBe(true);
    expect(canManageConstellation("moderator")).toBe(false);
    expect(canManageConstellation("member")).toBe(false);
  });
});

describe("resolveClusterAccess", () => {
  const base = { isClusterMember: false };

  test("non-members are always locked", () => {
    expect(resolveClusterAccess({ ...base, role: null, visibility: "public" })).toBe("locked");
  });

  test("moderators and above see everything", () => {
    expect(resolveClusterAccess({ ...base, role: "moderator", visibility: "invite" })).toBe(
      "granted",
    );
    expect(resolveClusterAccess({ ...base, role: "navigator", visibility: "members" })).toBe(
      "granted",
    );
  });

  test("public clusters granted to any constellation member", () => {
    expect(resolveClusterAccess({ ...base, role: "member", visibility: "public" })).toBe("granted");
  });

  test("members-only is joinable, not granted", () => {
    expect(resolveClusterAccess({ ...base, role: "member", visibility: "members" })).toBe(
      "joinable",
    );
    expect(
      resolveClusterAccess({
        role: "member",
        visibility: "members",
        isClusterMember: true,
      }),
    ).toBe("granted");
  });

  test("invite-only stays locked without explicit grant", () => {
    expect(resolveClusterAccess({ ...base, role: "member", visibility: "invite" })).toBe("locked");
    expect(
      resolveClusterAccess({
        role: "member",
        visibility: "invite",
        isClusterMember: true,
      }),
    ).toBe("granted");
  });
});
```

- [ ] **Step 3.2: Run it, confirm failure**

Run: `bun test packages/api/test`
Expected: FAIL — cannot resolve `../src/permissions`.

- [ ] **Step 3.3: Implement `packages/api/src/permissions.ts`**

```ts
export type MemberRole = "owner" | "navigator" | "moderator" | "member";
export type ClusterVisibility = "public" | "members" | "invite";
export type ClusterAccess = "granted" | "joinable" | "locked";

export const ROLE_RANK: Record<MemberRole, number> = {
  owner: 4,
  navigator: 3,
  moderator: 2,
  member: 1,
};

export function hasRole(role: MemberRole, min: MemberRole): boolean {
  return ROLE_RANK[role] >= ROLE_RANK[min];
}

export function canManageConstellation(role: MemberRole): boolean {
  return hasRole(role, "navigator");
}

export function resolveClusterAccess(params: {
  role: MemberRole | null;
  visibility: ClusterVisibility;
  isClusterMember: boolean;
}): ClusterAccess {
  if (params.role === null) return "locked";
  if (hasRole(params.role, "moderator")) return "granted";
  if (params.visibility === "public") return "granted";
  if (params.isClusterMember) return "granted";
  return params.visibility === "members" ? "joinable" : "locked";
}
```

- [ ] **Step 3.4: Run tests, confirm pass**

Run: `bun test packages/api/test`
Expected: all pass, 0 fail.

- [ ] **Step 3.5: Commit**

```bash
git add packages/api/src/permissions.ts packages/api/test
git commit -m "feat(api): pure permission module with unit tests"
```

---

### Task 4: Profile router

**Files:**

- Create: `packages/api/src/routers/profile.ts`
- Modify: `packages/api/src/routers/index.ts`

- [ ] **Step 4.1: Write `packages/api/src/routers/profile.ts`**

```ts
import { db } from "@zentryx/db";
import { user, userProfile } from "@zentryx/db/schema";
import { eq } from "drizzle-orm";
import { z } from "zod";

import { protectedProcedure, router } from "../index";

export const profileRouter = router({
  me: protectedProcedure.query(async ({ ctx }) => {
    const [profile] = await db
      .select()
      .from(userProfile)
      .where(eq(userProfile.userId, ctx.session.user.id))
      .limit(1);
    return {
      name: ctx.session.user.name,
      email: ctx.session.user.email,
      image: ctx.session.user.image,
      bio: profile?.bio ?? "",
      skills: profile?.skills ?? [],
    };
  }),

  update: protectedProcedure
    .input(
      z.object({
        name: z.string().min(1).max(80).optional(),
        bio: z.string().max(500).optional(),
        skills: z.array(z.string().min(1).max(40)).max(10).optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      if (input.name !== undefined) {
        await db.update(user).set({ name: input.name }).where(eq(user.id, ctx.session.user.id));
      }
      const [current] = await db
        .select()
        .from(userProfile)
        .where(eq(userProfile.userId, ctx.session.user.id))
        .limit(1);
      const next = {
        bio: input.bio ?? current?.bio ?? "",
        skills: input.skills ?? current?.skills ?? [],
      };
      await db
        .insert(userProfile)
        .values({ userId: ctx.session.user.id, ...next })
        .onConflictDoUpdate({
          target: userProfile.userId,
          set: next,
        });
      return next;
    }),
});
```

- [ ] **Step 4.2: Wire into `packages/api/src/routers/index.ts`**

```ts
import { profileRouter } from "./profile";

export const appRouter = router({
  healthCheck: publicProcedure.query(() => "OK"),
  privateData: protectedProcedure.query(({ ctx }) => ({
    message: "This is private",
    user: ctx.session.user,
  })),
  profile: profileRouter,
});
export type AppRouter = typeof appRouter;
```

- [ ] **Step 4.3: Typecheck**

Run: `bun run check-types`
Expected: exits 0.

- [ ] **Step 4.4: Commit**

```bash
git add packages/api/src/routers
git commit -m "feat(api): profile router with bio and skills"
```

---

### Task 5: Constellation router — CRUD + publish

**Files:**

- Create: `packages/api/src/routers/constellation.ts`
- Modify: `packages/api/src/routers/index.ts`

- [ ] **Step 5.1: Write `packages/api/src/routers/constellation.ts`**

```ts
import { db } from "@zentryx/db";
import { constellation, constellationInvite, constellationMember, user } from "@zentryx/db/schema";
import { and, desc, eq, sql } from "drizzle-orm";
import { TRPCError } from "@trpc/server";
import { z } from "zod";

import { env } from "@zentryx/env/server";
import { canManageConstellation } from "../permissions";
import { protectedProcedure, publicProcedure, router } from "../index";

const slugSchema = z
  .string()
  .min(3)
  .max(63)
  .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "lowercase letters, numbers, hyphens");

async function requireMembership(
  userId: string,
  constellationId: string,
): Promise<{ role: MemberRole; membershipId: string }> {
  const [row] = await db
    .select({ id: constellationMember.id, role: constellationMember.role })
    .from(constellationMember)
    .where(
      and(
        eq(constellationMember.userId, userId),
        eq(constellationMember.constellationId, constellationId),
      ),
    )
    .limit(1);
  if (!row) {
    throw new TRPCError({ code: "FORBIDDEN", message: "Not a member" });
  }
  return { role: row.role, membershipId: row.id };
}

async function requireManager(userId: string, constellationId: string) {
  const m = await requireMembership(userId, constellationId);
  if (!canManageConstellation(m.role)) {
    throw new TRPCError({ code: "FORBIDDEN", message: "Navigator role required" });
  }
  return m;
}

export const constellationRouter = router({
  create: protectedProcedure
    .input(
      z.object({
        name: z.string().min(3).max(80),
        slug: slugSchema,
        description: z.string().max(1000).default(""),
        category: z.string().max(40).default("general"),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const existing = await db
        .select({ id: constellation.id })
        .from(constellation)
        .where(eq(constellation.slug, input.slug))
        .limit(1);
      if (existing.length > 0) {
        throw new TRPCError({ code: "CONFLICT", message: "Slug already taken" });
      }
      let created: { id: string; slug: string };
      try {
        [created] = await db
          .insert(constellation)
          .values({
            name: input.name,
            slug: input.slug,
            description: input.description,
            category: input.category,
            createdById: ctx.session.user.id,
          })
          .returning({ id: constellation.id, slug: constellation.slug });
        await db.insert(constellationMember).values({
          constellationId: created.id,
          userId: ctx.session.user.id,
          role: "owner",
        });
      } catch (err) {
        await db.delete(constellation).where(eq(constellation.slug, input.slug));
        throw err;
      }
      return created;
    }),

  getBySlug: publicProcedure.input(z.object({ slug: z.string() })).query(async ({ ctx, input }) => {
    const [row] = await db
      .select()
      .from(constellation)
      .where(eq(constellation.slug, input.slug))
      .limit(1);
    if (!row) {
      throw new TRPCError({ code: "NOT_FOUND", message: "Constellation not found" });
    }
    let role: MemberRole | null = null;
    if (ctx.session) {
      const [membership] = await db
        .select({ role: constellationMember.role })
        .from(constellationMember)
        .where(
          and(
            eq(constellationMember.userId, ctx.session.user.id),
            eq(constellationMember.constellationId, row.id),
          ),
        )
        .limit(1);
      role = membership?.role ?? null;
    }
    return { constellation: row, viewerRole: role };
  }),

  listMine: protectedProcedure.query(async ({ ctx }) => {
    return db
      .select({
        id: constellation.id,
        slug: constellation.slug,
        name: constellation.name,
        status: constellation.status,
        category: constellation.category,
        role: constellationMember.role,
      })
      .from(constellationMember)
      .innerJoin(constellation, eq(constellation.id, constellationMember.constellationId))
      .where(eq(constellationMember.userId, ctx.session.user.id))
      .orderBy(desc(constellationMember.createdAt));
  }),

  update: protectedProcedure
    .input(
      z.object({
        id: z.string().uuid(),
        name: z.string().min(3).max(80).optional(),
        description: z.string().max(1000).optional(),
        category: z.string().max(40).optional(),
        coverImage: z.string().url().optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      await requireManager(ctx.session.user.id, input.id);
      const { id, ...patch } = input;
      const [updated] = await db
        .update(constellation)
        .set(patch)
        .where(eq(constellation.id, id))
        .returning();
      return updated;
    }),

  publish: protectedProcedure
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      await requireManager(ctx.session.user.id, input.id);
      const [updated] = await db
        .update(constellation)
        .set({ status: "published" })
        .where(and(eq(constellation.id, input.id), eq(constellation.status, "draft")))
        .returning({ id: constellation.id, status: constellation.status });
      return updated;
    }),

  createInvite: protectedProcedure
    .input(
      z.object({
        constellationId: z.string().uuid(),
        invitedEmail: z.string().email().optional(),
        role: z.enum(["navigator", "moderator", "member"]).default("member"),
        expiresInDays: z.number().int().min(1).max(30).default(7),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      await requireManager(ctx.session.user.id, input.constellationId);
      const [invite] = await db
        .insert(constellationInvite)
        .values({
          token: crypto.randomUUID(),
          constellationId: input.constellationId,
          invitedEmail: input.invitedEmail ?? null,
          role: input.role,
          invitedById: ctx.session.user.id,
          expiresAt: new Date(Date.now() + input.expiresInDays * 86_400_000),
        })
        .returning({ token: constellationInvite.token, expiresAt: constellationInvite.expiresAt });
      return {
        token: invite.token,
        expiresAt: invite.expiresAt,
        url: `${env.CORS_ORIGIN}/invite/${invite.token}`,
      };
    }),

  invitePreview: publicProcedure.input(z.object({ token: z.string() })).query(async ({ input }) => {
    const [row] = await db
      .select({
        name: constellation.name,
        slug: constellation.slug,
        expiresAt: constellationInvite.expiresAt,
        invitedEmail: constellationInvite.invitedEmail,
        acceptedAt: constellationInvite.acceptedAt,
      })
      .from(constellationInvite)
      .innerJoin(constellation, eq(constellation.id, constellationInvite.constellationId))
      .where(eq(constellationInvite.token, input.token))
      .limit(1);
    if (!row || row.acceptedAt !== null || row.expiresAt < new Date()) {
      throw new TRPCError({ code: "NOT_FOUND", message: "Invitation invalid or expired" });
    }
    return row;
  }),

  acceptInvite: protectedProcedure
    .input(z.object({ token: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const [invite] = await db
        .select()
        .from(constellationInvite)
        .where(eq(constellationInvite.token, input.token))
        .limit(1);
      if (
        !invite ||
        invite.acceptedAt !== null ||
        invite.expiresAt < new Date() ||
        (invite.invitedEmail !== null &&
          invite.invitedEmail.toLowerCase() !== ctx.session.user.email.toLowerCase())
      ) {
        throw new TRPCError({ code: "FORBIDDEN", message: "Invitation cannot be accepted" });
      }
      await db
        .insert(constellationMember)
        .values({
          constellationId: invite.constellationId,
          userId: ctx.session.user.id,
          role: invite.role,
        })
        .onConflictDoNothing();
      await db
        .update(constellationInvite)
        .set({ acceptedAt: new Date() })
        .where(eq(constellationInvite.id, invite.id));
      const [c] = await db
        .select({ slug: constellation.slug })
        .from(constellation)
        .where(eq(constellation.id, invite.constellationId))
        .limit(1);
      return { slug: c?.slug ?? "" };
    }),

  members: protectedProcedure
    .input(z.object({ constellationId: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      await requireMembership(ctx.session.user.id, input.constellationId);
      return db
        .select({
          membershipId: constellationMember.id,
          userId: constellationMember.userId,
          role: constellationMember.role,
          name: user.name,
        })
        .from(constellationMember)
        .innerJoin(user, eq(user.id, constellationMember.userId))
        .where(eq(constellationMember.constellationId, input.constellationId));
    }),

  setMemberRole: protectedProcedure
    .input(
      z.object({
        membershipId: z.string().uuid(),
        role: z.enum(["owner", "navigator", "moderator", "member"]),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const [target] = await db
        .select()
        .from(constellationMember)
        .where(eq(constellationMember.id, input.membershipId))
        .limit(1);
      if (!target) throw new TRPCError({ code: "NOT_FOUND" });
      const caller = await requireMembership(ctx.session.user.id, target.constellationId);
      if (caller.role !== "owner") {
        throw new TRPCError({ code: "FORBIDDEN", message: "Owner role required" });
      }
      if (target.role === "owner" && input.role !== "owner") {
        const [{ count }] = await db
          .select({ count: sql<number>`count(*)::int` })
          .from(constellationMember)
          .where(
            and(
              eq(constellationMember.constellationId, target.constellationId),
              eq(constellationMember.role, "owner"),
            ),
          );
        if (count <= 1) {
          throw new TRPCError({ code: "BAD_REQUEST", message: "Cannot demote the last owner" });
        }
      }
      const [updated] = await db
        .update(constellationMember)
        .set({ role: input.role })
        .where(eq(constellationMember.id, input.membershipId))
        .returning({ id: constellationMember.id, role: constellationMember.role });
      return updated;
    }),

  removeMember: protectedProcedure
    .input(z.object({ membershipId: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      const [target] = await db
        .select()
        .from(constellationMember)
        .where(eq(constellationMember.id, input.membershipId))
        .limit(1);
      if (!target) throw new TRPCError({ code: "NOT_FOUND" });
      const caller = await requireMembership(ctx.session.user.id, target.constellationId);
      if (target.role === "owner" && caller.role !== "owner") {
        throw new TRPCError({ code: "FORBIDDEN" });
      }
      if (target.userId === ctx.session.user.id && target.role === "owner") {
        throw new TRPCError({ code: "BAD_REQUEST", message: "Owners cannot remove themselves" });
      }
      await db.delete(constellationMember).where(eq(constellationMember.id, input.membershipId));
      return { ok: true };
    }),
});
```

- [ ] **Step 5.2: Mount it — add `constellation: constellationRouter,` to the router object in `packages/api/src/routers/index.ts` (alongside `profile`).**

- [ ] **Step 5.3: Typecheck**

Run: `bun run check-types`
Expected: exits 0. If `z.string().uuid()` errors under zod v4, use `z.string().uuid()` replacement `z.uuid()` everywhere in this file.

- [ ] **Step 5.4: Commit**

```bash
git add packages/api/src/routers/constellation.ts packages/api/src/routers/index.ts
git commit -m "feat(api): constellation router with invites, members, roles"
```

---

### Task 6: Cluster router

**Files:**

- Create: `packages/api/src/routers/cluster.ts`
- Modify: `packages/api/src/routers/index.ts`

- [ ] **Step 6.1: Write `packages/api/src/routers/cluster.ts`**

```ts
import { db } from "@zentryx/db";
import {
  cluster,
  clusterJoinRequest,
  clusterMember,
  constellation,
  constellationMember,
  user,
} from "@zentryx/db/schema";
import { and, eq, sql } from "drizzle-orm";
import { TRPCError } from "@trpc/server";
import { z } from "zod";

import { resolveClusterAccess } from "../permissions";
import { protectedProcedure, router } from "../index";

const slugSchema = z
  .string()
  .min(2)
  .max(63)
  .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/);

async function viewerContext(userId: string, constellationId: string) {
  const [membership] = await db
    .select({ role: constellationMember.role })
    .from(constellationMember)
    .where(
      and(
        eq(constellationMember.userId, userId),
        eq(constellationMember.constellationId, constellationId),
      ),
    )
    .limit(1);
  if (!membership) {
    throw new TRPCError({ code: "FORBIDDEN", message: "Not a constellation member" });
  }
  const grants = await db
    .select({ clusterId: clusterMember.clusterId })
    .from(clusterMember)
    .innerJoin(cluster, eq(cluster.id, clusterMember.clusterId))
    .where(eq(clusterMember.userId, userId));
  return { role: membership.role, grantedIds: new Set(grants.map((g) => g.clusterId)) };
}

export const clusterRouter = router({
  create: protectedProcedure
    .input(
      z.object({
        constellationId: z.uuid(),
        name: z.string().min(2).max(80),
        slug: slugSchema,
        description: z.string().max(500).default(""),
        visibility: z.enum(["public", "members", "invite"]).default("public"),
        type: z.enum(["discussion", "cohort", "library"]).default("discussion"),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const { role } = await viewerContext(ctx.session.user.id, input.constellationId);
      if (role !== "owner" && role !== "navigator") {
        throw new TRPCError({ code: "FORBIDDEN", message: "Navigator role required" });
      }
      const dup = await db
        .select({ id: cluster.id })
        .from(cluster)
        .where(
          and(eq(cluster.constellationId, input.constellationId), eq(cluster.slug, input.slug)),
        )
        .limit(1);
      if (dup.length > 0) {
        throw new TRPCError({ code: "CONFLICT", message: "Cluster slug already used" });
      }
      const [created] = await db
        .insert(cluster)
        .values({
          constellationId: input.constellationId,
          name: input.name,
          slug: input.slug,
          description: input.description,
          visibility: input.visibility,
          type: input.type,
          createdById: ctx.session.user.id,
        })
        .returning();
      return created;
    }),

  listForConstellation: protectedProcedure
    .input(z.object({ constellationId: z.uuid() }))
    .query(async ({ ctx, input }) => {
      const { role, grantedIds } = await viewerContext(ctx.session.user.id, input.constellationId);
      const rows = await db
        .select()
        .from(cluster)
        .where(eq(cluster.constellationId, input.constellationId));
      return rows.map((c) => ({
        id: c.id,
        slug: c.slug,
        name: c.name,
        description: c.description,
        visibility: c.visibility,
        type: c.type,
        access: resolveClusterAccess({
          role,
          visibility: c.visibility,
          isClusterMember: grantedIds.has(c.id),
        }),
      }));
    }),

  getBySlug: protectedProcedure
    .input(z.object({ constellationSlug: z.string(), clusterSlug: z.string() }))
    .query(async ({ ctx, input }) => {
      const [c] = await db
        .select({ id: constellation.id })
        .from(constellation)
        .where(eq(constellation.slug, input.constellationSlug))
        .limit(1);
      if (!c) throw new TRPCError({ code: "NOT_FOUND" });
      const { role, grantedIds } = await viewerContext(ctx.session.user.id, c.id);
      const [cl] = await db
        .select()
        .from(cluster)
        .where(and(eq(cluster.constellationId, c.id), eq(cluster.slug, input.clusterSlug)))
        .limit(1);
      if (!cl) throw new TRPCError({ code: "NOT_FOUND" });
      const access = resolveClusterAccess({
        role,
        visibility: cl.visibility,
        isClusterMember: grantedIds.has(cl.id),
      });
      let requestId: string | null = null;
      if (access === "joinable") {
        const [req] = await db
          .select({ id: clusterJoinRequest.id, status: clusterJoinRequest.status })
          .from(clusterJoinRequest)
          .where(
            and(
              eq(clusterJoinRequest.clusterId, cl.id),
              eq(clusterJoinRequest.userId, ctx.session.user.id),
            ),
          )
          .limit(1);
        requestId = req && req.status === "pending" ? req.id : null;
      }
      return { cluster: cl, access, hasPendingRequest: requestId !== null };
    }),

  requestAccess: protectedProcedure
    .input(z.object({ clusterId: z.uuid() }))
    .mutation(async ({ ctx, input }) => {
      const [cl] = await db.select().from(cluster).where(eq(cluster.id, input.clusterId)).limit(1);
      if (!cl) throw new TRPCError({ code: "NOT_FOUND" });
      const { role, grantedIds } = await viewerContext(ctx.session.user.id, cl.constellationId);
      if (
        resolveClusterAccess({
          role,
          visibility: cl.visibility,
          isClusterMember: grantedIds.has(cl.id),
        }) !== "joinable"
      ) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "Cluster is not requestable" });
      }
      await db.insert(clusterJoinRequest).values({
        clusterId: cl.id,
        userId: ctx.session.user.id,
      });
      return { ok: true };
    }),

  pendingRequests: protectedProcedure
    .input(z.object({ constellationId: z.uuid() }))
    .query(async ({ ctx, input }) => {
      await viewerContext(ctx.session.user.id, input.constellationId);
      const rows = await db
        .select({
          requestId: clusterJoinRequest.id,
          clusterName: cluster.name,
          userName: user.name,
          requestedAt: clusterJoinRequest.createdAt,
        })
        .from(clusterJoinRequest)
        .innerJoin(cluster, eq(cluster.id, clusterJoinRequest.clusterId))
        .innerJoin(user, eq(user.id, clusterJoinRequest.userId))
        .where(
          and(
            eq(cluster.constellationId, input.constellationId),
            eq(clusterJoinRequest.status, "pending"),
          ),
        );
      return rows;
    }),

  respondToRequest: protectedProcedure
    .input(
      z.object({
        requestId: z.uuid(),
        approve: z.boolean(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const [req] = await db
        .select()
        .from(clusterJoinRequest)
        .where(eq(clusterJoinRequest.id, input.requestId))
        .limit(1);
      if (!req || req.status !== "pending") throw new TRPCError({ code: "NOT_FOUND" });
      const [cl] = await db.select().from(cluster).where(eq(cluster.id, req.clusterId)).limit(1);
      const { role } = await viewerContext(ctx.session.user.id, cl!.constellationId);
      if (role !== "owner" && role !== "navigator" && role !== "moderator") {
        throw new TRPCError({ code: "FORBIDDEN", message: "Moderator role required" });
      }
      if (input.approve) {
        await db
          .insert(clusterMember)
          .values({
            clusterId: req.clusterId,
            userId: req.userId,
            grantedById: ctx.session.user.id,
          })
          .onConflictDoNothing();
      }
      await db
        .update(clusterJoinRequest)
        .set({
          status: input.approve ? "approved" : "denied",
          respondedById: ctx.session.user.id,
          respondedAt: new Date(),
        })
        .where(eq(clusterJoinRequest.id, req.id));
      return { ok: true };
    }),

  addMemberByEmail: protectedProcedure
    .input(z.object({ clusterId: z.uuid(), email: z.string().email() }))
    .mutation(async ({ ctx, input }) => {
      const [cl] = await db.select().from(cluster).where(eq(cluster.id, input.clusterId)).limit(1);
      if (!cl) throw new TRPCError({ code: "NOT_FOUND" });
      const { role } = await viewerContext(ctx.session.user.id, cl.constellationId);
      if (role !== "owner" && role !== "navigator") {
        throw new TRPCError({ code: "FORBIDDEN", message: "Navigator role required" });
      }
      const [targetUser] = await db
        .select({ id: user.id })
        .from(user)
        .where(sql`lower(${user.email}) = ${input.email.toLowerCase()}`)
        .limit(1);
      if (!targetUser) throw new TRPCError({ code: "NOT_FOUND", message: "No such user" });
      await db
        .insert(clusterMember)
        .values({
          clusterId: cl.id,
          userId: targetUser.id,
          grantedById: ctx.session.user.id,
        })
        .onConflictDoNothing();
      return { ok: true };
    }),
});
```

- [ ] **Step 6.2: Final `packages/api/src/routers/index.ts`**

```ts
import { clusterRouter } from "./cluster";
import { constellationRouter } from "./constellation";
import { profileRouter } from "./profile";
import { protectedProcedure, publicProcedure, router } from "../index";

export const appRouter = router({
  healthCheck: publicProcedure.query(() => "OK"),
  privateData: protectedProcedure.query(({ ctx }) => ({
    message: "This is private",
    user: ctx.session.user,
  })),
  profile: profileRouter,
  constellation: constellationRouter,
  cluster: clusterRouter,
});
export type AppRouter = typeof appRouter;
```

- [ ] **Step 6.3: Typecheck + unit tests**

Run: `bun run check-types && bun test packages/api/test`
Expected: types pass; all tests green.

- [ ] **Step 6.4: Commit**

```bash
git add packages/api/src
git commit -m "feat(api): cluster router with access-filtered listing and join requests"
```

---

### Task 7: API smoke verification

**Files:** none created (verification only)

- [ ] **Step 7.1: Start dev servers**

Run: `bun run dev` (leave running; open second shell for the rest)

- [ ] **Step 7.2: Health check**

Run: `curl -s http://localhost:3000/trpc/healthCheck`
Expected: `{"result":{"data":"OK"}}`

- [ ] **Step 7.3: Sign up two users via Better Auth HTTP API**

```bash
curl -s -X POST http://localhost:3000/api/auth/sign-up/email \
  -H "Content-Type: application/json" \
  -c /tmp/opencode/alice.txt \
  -d '{"name":"Alice Nav","email":"alice@example.com","password":"supersecret123"}' | head -c 200

curl -s -X POST http://localhost:3000/api/auth/sign-up/email \
  -H "Content-Type: application/json" \
  -c /tmp/opencode/bob.txt \
  -d '{"name":"Bob Member","email":"bob@example.com","password":"supersecret123"}' | head -c 200
```

Expected: both return JSON containing `"user"` with matching emails.

- [ ] **Step 7.4: Alice creates a constellation over tRPC (batched mutation with cookie)**

Get Alice's session token cookie name from `/tmp/opencode/alice.txt` (better-auth sets `better-auth.session_token`), then:

```bash
TOKEN=$(grep better-auth.session_token /tmp/opencode/alice.txt | awk '{print $NF}')
curl -s -X POST "http://localhost:3000/trpc/constellation.create" \
  -H "Content-Type: application/json" \
  -H "Cookie: better-auth.session_token=$TOKEN" \
  -d '{"name":"Trading Fundamentals","slug":"trading-fundamentals","category":"trading"}'
```

Expected: a result envelope containing `{"id":"<uuid>","slug":"trading-fundamentals"}`. NOTE: this API uses tRPC's default identity transformer — bodies are RAW input JSON, not `{"json":...}` envelopes.

Repeat Step 7.4 later tasks will reuse this pattern. Record the returned `id` as `$CID` for subsequent calls.

- [ ] **Step 7.5: Bob requests the constellation through an invite link**

As Alice: call `constellation.createInvite` (same pattern, raw-JSON body `{"constellationId":"$CID"}`; queries take `?input=<URL-encoded raw JSON>`) → copy `url`. As Bob (his cookie): GET the `constellation.invitePreview` query URL with `?input={"json":{"token":"..."}}` then POST `constellation.acceptInvite`.

Expected: accept returns `{"slug":"trading-fundamentals"}`.

- [ ] **Step 7.5b: Negative-path authorization checks (FR-018 enforcement)**

With cookies for Bob (plain member) and a third account Charlie:
1. Bob calls `constellation.setMemberRole` with any membership id → expect FORBIDDEN error, not success
2. Bob calls `constellation.removeMember` on Alice's membership → expect FORBIDDEN
3. Bob calls `constellation.createInvite` → expect FORBIDDEN (member cannot invite)
4. Alice creates an email-bound invite for bob@example.com; Charlie attempts `acceptInvite` with that token → expect FORBIDDEN
5. Charlie calls `acceptInvite` with an already-accepted token → expect FORBIDDEN
6. Bob calls `cluster.create` in the constellation → expect FORBIDDEN

Expected: every call rejected server-side; no partial state changes.

- [ ] **Step 7.6: Commit checkpoint tag**

```bash
git tag m1-api-smoke-ok
```

---

### Task 8: Web — create constellation flow

> Before editing: skim `apps/web/node_modules/next/dist/docs/` for App Router + async `params` conventions. Existing patterns to copy: `apps/web/src/app/dashboard/` (server page + client component split) and `useQuery(trpc.x.y.queryOptions())` usage in `dashboard.tsx`.

**Files:**

- Create: `apps/web/src/app/constellations/new/page.tsx`
- Create: `apps/web/src/app/constellations/new/create-form.tsx`

- [ ] **Step 8.1: Write `create-form.tsx`**

Client component. Uses `useMutation(trpc.constellation.create.mutationOptions())`, fields Name / Slug / Description / Category (select from `["coding","design","trading","languages","fitness","other"]`), slug auto-derived from name (`toLowerCase().replace(/[^a-z0-9]+/g,"-")`) but editable, error surfaced via `sonner` toast on `CONFLICT`. On success `router.push(\`/c/${data.slug}\`)`. Uses existing shadcn/ui primitives from `@zenvtryx/ui` (`Button`, `Input`, `Label`) exactly as imported elsewhere in `apps/web/src/components`.

- [ ] **Step 8.2: Write `page.tsx`**

Server component: `const session = await authClient.getSession()` equivalent used by `login` route (copy its session-guard pattern — redirect to `/login` when absent), renders `<CreateForm />` inside centered card layout.

- [ ] **Step 8.3: Manual verify**

With dev servers running and logged in as Alice: visit `http://localhost:3001/constellations/new`, create one. Expected: redirect to `/c/<slug>`, currently a 404 (next task builds it).

- [ ] **Step 8.4: Commit**

```bash
git add apps/web/src/app/constellations
git commit -m "feat(web): create constellation form"
```

---

### Task 9: Web — dashboard membership list + onboarding CTA

**Files:**

- Modify: `apps/web/src/app/dashboard/dashboard.tsx`

- [ ] **Step 9.1: Extend dashboard**

Add `const mine = useQuery(trpc.constellation.listMine.queryOptions());`. Render: if `mine.data?.length === 0` show CTA card ("Create your first constellation" → link `/constellations/new`); else render list of `{name, role, status}` linking to `/c/{slug}`. Keep the existing `privateData` block untouched below.

- [ ] **Step 9.2: Verify + commit**

Logged-in as Alice: dashboard lists Trading Fundamentals with role `owner`. As Bob: shows CTA before invite acceptance, list entry after.

```bash
git add apps/web/src/app/dashboard
git commit -m "feat(web): dashboard memberships with onboarding CTA"
```

---

### Task 10: Web — constellation page (tabs, clusters, members, approvals, invites)

**Files:**

- Create: `apps/web/src/app/c/[slug]/page.tsx` (server: `await params`, session guard, renders client view)
- Create: `apps/web/src/app/c/[slug]/constellation-view.tsx` (client)

- [ ] **Step 10.1: Data layer in the client view**

Three queries keyed on slug: `trpc.constellation.getBySlug.queryOptions({ slug })`, `trpc.cluster.listForConstellation.queryOptions({ constellationId })` (enabled once `getBySlug` returns an id AND `viewerRole !== null`; if `viewerRole === null` render join-prompt instead), `trpc.constellation.members.queryOptions({ constellationId })`.

- [ ] **Step 10.2: Tabs**

Simple local-state tabs (no new deps): **Overview** (name/description/category/status + Publish button shown only when `status === "draft"` && `viewerRole ∈ {owner, navigator}`, calling `constellation.publish`), **Clusters**, **Members**.

- [ ] **Step 10.3: Clusters tab (the exit-criterion surface)**

Each cluster row shows name, type badge, visibility badge, and behavior driven strictly by `access`:

- `granted` → Link to `/c/{slug}/{clusterSlug}`
- `joinable` → "Request access" button calling `cluster.requestAccess` (disabled with "Requested" after `getBySlug` refetch shows `hasPendingRequest`)
- `locked` → lock icon + "Invite-only"
  Plus a "New cluster" dialog for `viewerRole ∈ {owner, navigator}` (fields mirror `cluster.create` input).

- [ ] **Step 10.4: Members tab**

Member rows with role badges. Owner sees role `<Select>` per row calling `constellation.setMemberRole` (suppress demote-last-owner option client-side too, server still enforces). Navigator+ sees "Remove" per row calling `constellation.removeMember`. Navigator+ sees: **Pending cluster requests** panel (`cluster.pendingRequests` + approve/deny buttons calling `cluster.respondToRequest`) and **Invite** panel (optional email + role select → `constellation.createInvite` → copyable URL display).

- [ ] **Step 10.5: Verify the exact M1 exit scenario**

As Alice: create public cluster `general`, members-only cluster `workouts`, invite-only cluster `vip`. As Bob (after accepting invite from 7.5): Clusters tab shows General clickable, Workouts with Request button, VIP locked. Alice approves Bob's Workouts request. Bob reloads: Workouts clickable. **This is the PRD M1 exit criterion.**

- [ ] **Step 10.6: Commit**

```bash
git add apps/web/src/app/c
git commit -m "feat(web): constellation page with clusters, members, approvals, invites"
```

---

### Task 11: Web — invitation acceptance page

**Files:**

- Create: `apps/web/src/app/invite/[token]/page.tsx` + `invite-view.tsx`

- [ ] **Step 11.1: Implement**

Server page awaits `params`, passes token to client view. Client view: `trpc.constellation.invitePreview.queryOptions({ token })` → invalid/expired shows error card; valid shows constellation name + "Accept invitation" button. Button behavior: if logged out → `router.push('/login')` after stashing token (simplest: append `?redirect=/invite/{token}` if the login page already supports it — check `login/` route; otherwise just instruct user to log in then revisit); if logged in → `trpc.constellation.acceptInvite.mutationOptions()` then `router.push(/c/{slug})`.

- [ ] **Step 11.2: Verify + commit**

Fresh browser, Charlie account: open Alice-generated invite URL → accept → lands in constellation as `member`.

```bash
git add apps/web/src/app/invite
git commit -m "feat(web): invitation acceptance flow"
```

---

### Task 12: Web — cluster detail stub

**Files:**

- Create: `apps/web/src/app/c/[slug]/[clusterSlug]/page.tsx` + `cluster-view.tsx`

- [ ] **Step 12.1: Implement**

Client view queries `cluster.getBySlug`. `access === "granted"` → heading + "M1: discussion space arrives in M2" empty-state card. `joinable` → request button / pending state. `locked` → invite-only notice. No content leaks for locked clusters beyond name.

- [ ] **Step 12.2: Verify + commit**

Bob opens `/c/trading-fundamentals/vip`: sees lock notice, no request button.

```bash
git add apps/web/src/app/c
git commit -m "feat(web): cluster detail stub gated by access level"
```

---

### Task 13: Seed script

**Files:**

- Create: `apps/server/scripts/seed.ts`

- [ ] **Step 13.1: Write seed**

Uses `auth.api.signUpEmail({ body: {...} })` for `demo-nav@zentryx.dev` / `demo-member@zentryx.dev` (password `zentryx-demo-1`), swallows "USER_ALREADY_EXISTS"-style errors by looking up ids via db. Then creates constellation `demo-constellation` (published) owned by demo-nav with clusters `open-lounge` (public), `live-trading` (members), `mentors-lounge` (invite). Idempotent: every insert checks existence by natural key first. Ends with `console.log` of created entity slugs.

- [ ] **Step 13.2: Run + verify**

Run: `bun run apps/server/scripts/seed.ts` (twice — second run must succeed unchanged)
Expected: same slugs reported, no duplicates in db.

- [ ] **Step 13.3: Commit**

```bash
git add apps/server/scripts/seed.ts
git commit -m "chore(server): idempotent demo seed script"
```

---

### Task 14: Deployment runbook (NFR-006)

**Files:**

- Create: `docs/deploy-m1.md`

- [ ] **Step 14.1: Write the runbook** covering:

1. Neon production branch creation + pooled connection string (`...-pooler.../neondb?sslmode=require`) — record why pooled (NFR-007 RPO relies on Neon PITR being enabled on the prod branch).
2. Production `.env` values for server container: `DATABASE_URL`, `BETTER_AUTH_SECRET` (`openssl rand -base64 32`), `BETTER_AUTH_URL=https://api.<domain>`, `CORS_ORIGIN=https://<domain>`; web container: `NEXT_PUBLIC_SERVER_URL`.
3. Hetzner/Coolify: create project from `docker-compose.yml`, set `CORS_ORIGIN`/`NEXT_PUBLIC_SERVER_URL` to the real domain (not localhost), attach Neon env vars, deploy, healthcheck green.
4. DNS + TLS via Coolify proxy.
5. Smoke checklist: `curl https://api.<domain>/trpc/healthCheck` → OK; sign-up through the live domain; create constellation; second browser accepts invite; access-filtered cluster list behaves.

- [ ] **Step 14.2: Execute against Hetzner/Coolify and complete the smoke checklist**

Expected: all five smoke checks pass. This closes NFR-006 for M1.

- [ ] **Step 14.3: Commit**

```bash
git add docs/deploy-m1.md
git commit -m "docs: M1 deployment runbook for Hetzner/Coolify + Neon"
```

---

## Final Verification (M1 exit gate)

- [ ] `bun run check` passes from repo root.
- [ ] `bun test packages/api/test` green.
- [ ] Fresh-database walkthrough (drop/recreate Neon branch, `bun run db:push`, seed): sign up → create → invite → second user sees only permitted clusters → approval flips access. Screenshots into `docs/m1-evidence/`.
- [ ] Deployed Coolify instance passes the same walkthrough.
- [ ] Tag: `git tag m1-exit && git push --tags`

## Deliberately deferred out of M1 (recorded, not forgotten)

| Item                                           | PRD ref   | Deferral rationale                                                                                                                                                                                                 |
| ---------------------------------------------- | --------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Email verification + password reset end-to-end | FR-016 AC | Requires transactional-email provider selection (PRD dependency table slots this at M1, but no provider is chosen yet). First task of M2 once Resend-class provider is picked; Better Auth supports both natively. |
| Join-request outcome notifications             | FR-004 AC | In-app/email notification center is Epic 6 (M3). Until then, approval is visible via the cluster list refetch.                                                                                                     |
| Cluster-type-specific layouts                  | FR-003 AC | Cluster pages are stubs until live/chat arrives in M2; type badge renders in lists now, layout differentiation lands with real content surfaces.                                                                   |
| Public discovery of published constellations   | FR-001 AC | Search/discovery is Epic 5 (v1.x); publishing state is stored and enforced from day one.                                                                                                                           |
