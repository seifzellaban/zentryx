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
      if (input.name === undefined && input.bio === undefined && input.skills === undefined) {
        const [current] = await db
          .select()
          .from(userProfile)
          .where(eq(userProfile.userId, ctx.session.user.id))
          .limit(1);
        return {
          name: ctx.session.user.name,
          bio: current?.bio ?? "",
          skills: current?.skills ?? [],
        };
      }
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
      const [updatedUser] = await db
        .select({ name: user.name })
        .from(user)
        .where(eq(user.id, ctx.session.user.id))
        .limit(1);
      return {
        name: updatedUser?.name ?? ctx.session.user.name,
        bio: next.bio,
        skills: next.skills,
      };
    }),
});
