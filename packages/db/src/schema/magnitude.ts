import { index, pgEnum, pgTable, text, timestamp, uniqueIndex } from "drizzle-orm/pg-core";
import { user } from "./auth";
import { constellation } from "./community";

export const magnitudeCategoryEnum = pgEnum("magnitude_category", [
  "attendance",
  "post",
  "endorsement",
]);

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

export const magnitudeWeight = pgTable(
  "magnitude_weight",
  {
    id: idColumn(),
    constellationId: text("constellation_id")
      .notNull()
      .references(() => constellation.id, { onDelete: "cascade" }),
    category: magnitudeCategoryEnum("category").notNull(),
    weight: text("weight").notNull().default("1"),
    updatedById: text("updated_by_id").references(() => user.id, { onDelete: "set null" }),
    ...timestamps,
  },
  (t) => [
    uniqueIndex("magnitude_weight_constellation_category_uidx").on(t.constellationId, t.category),
  ],
);

export const magnitudeEvent = pgTable(
  "magnitude_event",
  {
    id: idColumn(),
    constellationId: text("constellation_id")
      .notNull()
      .references(() => constellation.id, { onDelete: "cascade" }),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    category: magnitudeCategoryEnum("category").notNull(),
    points: text("points").notNull(),
    weightAtEvent: text("weight_at_event").notNull(),
    actorId: text("actor_id").references(() => user.id, { onDelete: "set null" }),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (t) => [
    index("magnitude_event_constellation_user_idx").on(t.constellationId, t.userId),
    index("magnitude_event_category_idx").on(t.category),
  ],
);

export type MagnitudeCategory = (typeof magnitudeCategoryEnum.enumValues)[number];
export type MagnitudeWeight = typeof magnitudeWeight.$inferSelect;
export type MagnitudeEvent = typeof magnitudeEvent.$inferSelect;
