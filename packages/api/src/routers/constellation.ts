import { db } from "@zentryx/db";
import {
  constellation,
  constellationInvite,
  constellationMember,
  user,
  type MemberRole,
} from "@zentryx/db/schema";
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
      let created: { id: string; slug: string } | undefined;
      try {
        const [inserted] = await db
          .insert(constellation)
          .values({
            name: input.name,
            slug: input.slug,
            description: input.description,
            category: input.category,
            createdById: ctx.session.user.id,
          })
          .returning({ id: constellation.id, slug: constellation.slug });
        if (!inserted) {
          throw new TRPCError({
            code: "INTERNAL_SERVER_ERROR",
            message: "Failed to create constellation",
          });
        }
        created = inserted;
        await db.insert(constellationMember).values({
          constellationId: created.id,
          userId: ctx.session.user.id,
          role: "owner",
        });
      } catch (err) {
        if (created) {
          await db.delete(constellation).where(eq(constellation.id, created.id));
        }
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
        id: z.uuid(),
        name: z.string().min(3).max(80).optional(),
        description: z.string().max(1000).optional(),
        category: z.string().max(40).optional(),
        coverImage: z.url().optional(),
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

  publish: protectedProcedure.input(z.object({ id: z.uuid() })).mutation(async ({ ctx, input }) => {
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
        constellationId: z.uuid(),
        invitedEmail: z.email().optional(),
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
      if (!invite) {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to create invite",
        });
      }
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
    .input(z.object({ constellationId: z.uuid() }))
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
        membershipId: z.uuid(),
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
        const [row] = await db
          .select({ count: sql<number>`count(*)::int` })
          .from(constellationMember)
          .where(
            and(
              eq(constellationMember.constellationId, target.constellationId),
              eq(constellationMember.role, "owner"),
            ),
          );
        if ((row?.count ?? 0) <= 1) {
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
    .input(z.object({ membershipId: z.uuid() }))
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
