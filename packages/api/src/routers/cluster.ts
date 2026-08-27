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
    .where(and(eq(clusterMember.userId, userId), eq(cluster.constellationId, constellationId)));
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
      let created: typeof cluster.$inferSelect | undefined;
      try {
        [created] = await db
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
      } catch (err) {
        const pgCode =
          (err as { code?: string })?.code ?? (err as { cause?: { code?: string } })?.cause?.code;
        if (pgCode === "23505") {
          throw new TRPCError({ code: "CONFLICT", message: "Cluster slug already used" });
        }
        throw err;
      }
      if (!created) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
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
      let hasPendingRequest = false;
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
        hasPendingRequest = req?.status === "pending";
      }
      return { cluster: cl, access, hasPendingRequest };
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
      try {
        await db.insert(clusterJoinRequest).values({
          clusterId: cl.id,
          userId: ctx.session.user.id,
        });
      } catch (err) {
        const pgCode =
          (err as { code?: string })?.code ?? (err as { cause?: { code?: string } })?.cause?.code;
        if (pgCode === "23505") {
          throw new TRPCError({ code: "CONFLICT", message: "Request already exists" });
        }
        throw err;
      }
      return { ok: true };
    }),

  pendingRequests: protectedProcedure
    .input(z.object({ constellationId: z.uuid() }))
    .query(async ({ ctx, input }) => {
      const { role } = await viewerContext(ctx.session.user.id, input.constellationId);
      if (role !== "owner" && role !== "navigator" && role !== "moderator") {
        throw new TRPCError({ code: "FORBIDDEN", message: "Moderator role required" });
      }
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
    .input(z.object({ requestId: z.uuid(), approve: z.boolean() }))
    .mutation(async ({ ctx, input }) => {
      const [req] = await db
        .select()
        .from(clusterJoinRequest)
        .where(eq(clusterJoinRequest.id, input.requestId))
        .limit(1);
      if (!req || req.status !== "pending") throw new TRPCError({ code: "NOT_FOUND" });
      const [cl] = await db.select().from(cluster).where(eq(cluster.id, req.clusterId)).limit(1);
      if (!cl) throw new TRPCError({ code: "NOT_FOUND" });
      const { role } = await viewerContext(ctx.session.user.id, cl.constellationId);
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
    .input(z.object({ clusterId: z.uuid(), email: z.email() }))
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
      const [isMember] = await db
        .select({ id: constellationMember.id })
        .from(constellationMember)
        .where(
          and(
            eq(constellationMember.constellationId, cl.constellationId),
            eq(constellationMember.userId, targetUser.id),
          ),
        )
        .limit(1);
      if (!isMember) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "Not a constellation member" });
      }
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
