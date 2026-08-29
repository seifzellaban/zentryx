import { protectedProcedure, publicProcedure, router } from "../index";

import { clusterRouter } from "./cluster";
import { constellationRouter } from "./constellation";
import { magnitudeRouter } from "./magnitude";
import { postRouter } from "./post";
import { profileRouter } from "./profile";

export const appRouter = router({
  healthCheck: publicProcedure.query(() => {
    return "OK";
  }),
  privateData: protectedProcedure.query(({ ctx }) => {
    return {
      message: "This is private",
      user: ctx.session.user,
    };
  }),
  profile: profileRouter,
  constellation: constellationRouter,
  cluster: clusterRouter,
  post: postRouter,
  magnitude: magnitudeRouter,
});
export type AppRouter = typeof appRouter;
