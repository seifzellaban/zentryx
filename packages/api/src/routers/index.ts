import { protectedProcedure, publicProcedure, router } from "../index";

import { clusterRouter } from "./cluster";
import { constellationRouter } from "./constellation";
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
});
export type AppRouter = typeof appRouter;
