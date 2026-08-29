import { relations } from "drizzle-orm";
import { boolean, index, pgEnum, pgTable, text, timestamp, uniqueIndex } from "drizzle-orm/pg-core";

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

export const clusterPost = pgTable(
  "cluster_post",
  {
    id: idColumn(),
    clusterId: text("cluster_id").notNull().references(() => cluster.id, { onDelete: "cascade" }),
    authorId: text("author_id").notNull().references(() => user.id, { onDelete: "cascade" }),
    content: text("content").notNull(),
    parentPostId: text("parent_post_id").references((): any => clusterPost.id, { onDelete: "cascade" }),
    pinned: boolean("pinned").notNull().default(false),
    ...timestamps,
  },
  (t) => [index("cluster_post_cluster_idx").on(t.clusterId), index("cluster_post_parent_idx").on(t.parentPostId)],
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
export type ConstellationMember = typeof constellationMember.$inferSelect;
export type ConstellationInvite = typeof constellationInvite.$inferSelect;
export type ClusterMember = typeof clusterMember.$inferSelect;
export type ClusterJoinRequest = typeof clusterJoinRequest.$inferSelect;
export type ClusterPost = typeof clusterPost.$inferSelect;
