import { db } from "@zentryx/db";
import {
  cluster,
  clusterMember,
  clusterPost,
  constellationMember,
  magnitudeEvent,
  magnitudeWeight,
} from "@zentryx/db/schema";
import { and, desc, eq } from "drizzle-orm";
import { TRPCError } from "@trpc/server";
import { z } from "zod";

import { resolveClusterAccess } from "../permissions";
import { protectedProcedure, router } from "../index";

async function requireClusterAccess(userId: string, clusterId: string, needGranted = true) {
  const [cl] = await db.select().from(cluster).where(eq(cluster.id, clusterId)).limit(1);
  if (!cl) throw new TRPCError({ code: "NOT_FOUND", message: "Cluster not found" });
  const [membership] = await db
    .select({ role: constellationMember.role })
    .from(constellationMember)
    .where(
      and(
        eq(constellationMember.userId, userId),
        eq(constellationMember.constellationId, cl.constellationId),
      ),
    )
    .limit(1);
  if (!membership)
    throw new TRPCError({ code: "FORBIDDEN", message: "Not a constellation member" });
  const grants = await db
    .select({ clusterId: clusterMember.clusterId })
    .from(clusterMember)
    .innerJoin(cluster, eq(cluster.id, clusterMember.clusterId))
    .where(and(eq(clusterMember.userId, userId), eq(cluster.constellationId, cl.constellationId)));
  const grantedIds = new Set(grants.map((g) => g.clusterId));
  const access = resolveClusterAccess({
    role: membership.role,
    visibility: cl.visibility,
    isClusterMember: grantedIds.has(cl.id),
  });
  if (needGranted && access !== "granted")
    throw new TRPCError({ code: "FORBIDDEN", message: "No access to cluster" });
  return { cl, role: membership.role, access };
}

export const postRouter = router({
  create: protectedProcedure
    .input(
      z.object({
        clusterId: z.uuid(),
        content: z.string().min(1).max(2000),
        parentPostId: z.uuid().optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const { cl } = await requireClusterAccess(ctx.session.user.id, input.clusterId, true);
      if (input.parentPostId) {
        const [parent] = await db
          .select()
          .from(clusterPost)
          .where(eq(clusterPost.id, input.parentPostId))
          .limit(1);
        if (!parent || parent.clusterId !== input.clusterId)
          throw new TRPCError({ code: "BAD_REQUEST", message: "Invalid parent" });
      }
      const [created] = await db
        .insert(clusterPost)
        .values({
          clusterId: input.clusterId,
          authorId: ctx.session.user.id,
          content: input.content,
          parentPostId: input.parentPostId ?? null,
        })
        .returning();
      if (!created) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      // magnitude side-effect: post = 2 points, snapshot current weight
      const [weightRow] = await db
        .select({ weight: magnitudeWeight.weight })
        .from(magnitudeWeight)
        .where(
          and(
            eq(magnitudeWeight.constellationId, cl.constellationId),
            eq(magnitudeWeight.category, "post"),
          ),
        )
        .limit(1);
      const w = weightRow ? Number.parseFloat(weightRow.weight) : 1;
      await db.insert(magnitudeEvent).values({
        constellationId: cl.constellationId,
        userId: ctx.session.user.id,
        category: "post",
        points: "2",
        weightAtEvent: String(w),
        actorId: ctx.session.user.id,
      });
      return created;
    }),

  list: protectedProcedure
    .input(z.object({ clusterId: z.uuid() }))
    .query(async ({ ctx, input }) => {
      await requireClusterAccess(ctx.session.user.id, input.clusterId, true);
      const rows = await db
        .select()
        .from(clusterPost)
        .where(eq(clusterPost.clusterId, input.clusterId))
        .orderBy(desc(clusterPost.pinned), desc(clusterPost.createdAt));
      return rows;
    }),

  pin: protectedProcedure
    .input(z.object({ postId: z.uuid(), pinned: z.boolean() }))
    .mutation(async ({ ctx, input }) => {
      const [post] = await db
        .select()
        .from(clusterPost)
        .where(eq(clusterPost.id, input.postId))
        .limit(1);
      if (!post) throw new TRPCError({ code: "NOT_FOUND" });
      const { role } = await requireClusterAccess(ctx.session.user.id, post.clusterId, false);
      if (role !== "owner" && role !== "navigator")
        throw new TRPCError({ code: "FORBIDDEN", message: "Navigator role required" });
      const [updated] = await db
        .update(clusterPost)
        .set({ pinned: input.pinned })
        .where(eq(clusterPost.id, input.postId))
        .returning();
      return updated;
    }),

  delete: protectedProcedure
    .input(z.object({ postId: z.uuid() }))
    .mutation(async ({ ctx, input }) => {
      const [post] = await db
        .select()
        .from(clusterPost)
        .where(eq(clusterPost.id, input.postId))
        .limit(1);
      if (!post) throw new TRPCError({ code: "NOT_FOUND" });
      if (post.authorId !== ctx.session.user.id) {
        const { role } = await requireClusterAccess(ctx.session.user.id, post.clusterId, false);
        if (role !== "owner" && role !== "navigator" && role !== "moderator")
          throw new TRPCError({ code: "FORBIDDEN" });
      }
      await db.delete(clusterPost).where(eq(clusterPost.id, input.postId));
      return { ok: true };
    }),
});
