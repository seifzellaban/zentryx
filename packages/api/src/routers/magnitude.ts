import { db } from "@zentryx/db";
import { constellationMember, magnitudeEvent, magnitudeWeight } from "@zentryx/db/schema";
import { and, eq } from "drizzle-orm";
import { TRPCError } from "@trpc/server";
import { z } from "zod";

import { clampWeight, computeScore, DEFAULT_WEIGHTS } from "../magnitude";
import { protectedProcedure, router } from "../index";

export const magnitudeRouter = router({
  getBreakdown: protectedProcedure
    .input(z.object({ constellationId: z.uuid(), userId: z.uuid() }))
    .query(async ({ ctx, input }) => {
      const [mem] = await db
        .select()
        .from(constellationMember)
        .where(
          and(
            eq(constellationMember.constellationId, input.constellationId),
            eq(constellationMember.userId, ctx.session.user.id),
          ),
        )
        .limit(1);
      if (!mem) throw new TRPCError({ code: "FORBIDDEN", message: "Not a constellation member" });
      const events = await db
        .select()
        .from(magnitudeEvent)
        .where(
          and(
            eq(magnitudeEvent.constellationId, input.constellationId),
            eq(magnitudeEvent.userId, input.userId),
          ),
        );
      const byCategory: Record<string, number> = { attendance: 0, post: 0, endorsement: 0 };
      const parsed = events.map((e) => ({
        category: e.category as "attendance" | "post" | "endorsement",
        points: Number.parseInt(e.points, 10),
        weight: Number.parseFloat(e.weightAtEvent),
      }));
      for (const ev of parsed)
        byCategory[ev.category] =
          (byCategory[ev.category] ?? 0) + ev.points * clampWeight(ev.weight);
      return { total: computeScore(parsed), byCategory, events: events.length };
    }),

  listWeights: protectedProcedure
    .input(z.object({ constellationId: z.uuid() }))
    .query(async ({ ctx, input }) => {
      const [mem] = await db
        .select()
        .from(constellationMember)
        .where(
          and(
            eq(constellationMember.constellationId, input.constellationId),
            eq(constellationMember.userId, ctx.session.user.id),
          ),
        )
        .limit(1);
      if (!mem) throw new TRPCError({ code: "FORBIDDEN" });
      const rows = await db
        .select()
        .from(magnitudeWeight)
        .where(eq(magnitudeWeight.constellationId, input.constellationId));
      const map = new Map(rows.map((r) => [r.category, Number.parseFloat(r.weight)]));
      return {
        attendance: map.get("attendance") ?? DEFAULT_WEIGHTS.attendance,
        post: map.get("post") ?? DEFAULT_WEIGHTS.post,
        endorsement: map.get("endorsement") ?? DEFAULT_WEIGHTS.endorsement,
      };
    }),

  setWeight: protectedProcedure
    .input(
      z.object({
        constellationId: z.uuid(),
        category: z.enum(["attendance", "post", "endorsement"]),
        weight: z.number().min(0.5).max(2),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const [mem] = await db
        .select()
        .from(constellationMember)
        .where(
          and(
            eq(constellationMember.constellationId, input.constellationId),
            eq(constellationMember.userId, ctx.session.user.id),
          ),
        )
        .limit(1);
      if (!mem || (mem.role !== "owner" && mem.role !== "navigator"))
        throw new TRPCError({ code: "FORBIDDEN", message: "Navigator role required" });
      const w = clampWeight(input.weight);
      await db
        .insert(magnitudeWeight)
        .values({
          constellationId: input.constellationId,
          category: input.category,
          weight: String(w),
          updatedById: ctx.session.user.id,
        })
        .onConflictDoUpdate({
          target: [magnitudeWeight.constellationId, magnitudeWeight.category],
          set: { weight: String(w), updatedById: ctx.session.user.id },
        });
      return { ok: true, weight: w };
    }),
});
