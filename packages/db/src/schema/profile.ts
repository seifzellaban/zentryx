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

export type UserProfile = typeof userProfile.$inferSelect;
