import { existsSync } from "node:fs";
import path from "node:path";

import dotenv from "dotenv";
import { and, eq } from "drizzle-orm";

const envCandidates = [
  path.resolve(import.meta.dir, "../.env"),
  path.resolve(process.cwd(), "apps/server/.env"),
];
const envPath = envCandidates.find((candidate) => existsSync(candidate));
if (!envPath) {
  throw new Error("apps/server/.env not found");
}
dotenv.config({ path: envPath });

const { auth } = await import("@zentryx/auth");
const { db } = await import("@zentryx/db");
const { cluster, constellation, constellationMember, user } = await import("@zentryx/db/schema");

const DEMO_PASSWORD = "zentryx-demo-1";
const CONSTELLATION_SLUG = "demo-constellation";
const CLUSTERS = [
  { slug: "open-lounge", name: "Open Lounge", visibility: "public" as const, type: "discussion" as const },
  { slug: "live-trading", name: "Live Trading", visibility: "members" as const, type: "cohort" as const },
  { slug: "mentors-lounge", name: "Mentors Lounge", visibility: "invite" as const, type: "discussion" as const },
];

type Mark = "created" | "reused";
const createdSlugs: string[] = [];
const reusedSlugs: string[] = [];
const emails: string[] = [];

function mark(slug: string, status: Mark) {
  if (status === "created") {
    createdSlugs.push(slug);
  } else {
    reusedSlugs.push(slug);
  }
}

async function ensureUser(name: string, email: string): Promise<string> {
  const found = await db.select({ id: user.id }).from(user).where(eq(user.email, email)).limit(1);
  if (found[0]) {
    emails.push(email);
    return found[0].id;
  }

  try {
    const result = await auth.api.signUpEmail({
      body: { name, email, password: DEMO_PASSWORD },
    });
    emails.push(email);
    return result.user.id;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (!message.toLowerCase().includes("already exists")) throw error;
    const existing = await db.select({ id: user.id }).from(user).where(eq(user.email, email)).limit(1);
    if (!existing[0]) throw error;
    emails.push(email);
    return existing[0].id;
  }
}

async function main() {
  const navId = await ensureUser("Demo Navigator", "demo-nav@zentryx.dev");
  await ensureUser("Demo Member", "demo-member@zentryx.dev");

  let constellationId: string;
  const existingConstellation = await db
    .select({ id: constellation.id })
    .from(constellation)
    .where(eq(constellation.slug, CONSTELLATION_SLUG))
    .limit(1);

  if (existingConstellation[0]) {
    constellationId = existingConstellation[0].id;
    mark(CONSTELLATION_SLUG, "reused");
  } else {
    const inserted = await db
      .insert(constellation)
      .values({
        slug: CONSTELLATION_SLUG,
        name: "Demo Constellation",
        category: "general",
        status: "published",
        createdById: navId,
      })
      .returning({ id: constellation.id });
    constellationId = inserted[0]!.id;
    mark(CONSTELLATION_SLUG, "created");
  }

  const navMembership = await db
    .select({ id: constellationMember.id })
    .from(constellationMember)
    .where(
      and(
        eq(constellationMember.constellationId, constellationId),
        eq(constellationMember.userId, navId),
      ),
    )
    .limit(1);

  if (!navMembership[0]) {
    await db.insert(constellationMember).values({
      constellationId,
      userId: navId,
      role: "owner",
    });
  }

  for (const definition of CLUSTERS) {
    const existing = await db
      .select({ id: cluster.id })
      .from(cluster)
      .where(and(eq(cluster.constellationId, constellationId), eq(cluster.slug, definition.slug)))
      .limit(1);

    if (existing[0]) {
      mark(definition.slug, "reused");
      continue;
    }

    await db.insert(cluster).values({
      constellationId,
      slug: definition.slug,
      name: definition.name,
      visibility: definition.visibility,
      type: definition.type,
      createdById: navId,
    });
    mark(definition.slug, "created");
  }

  console.log(JSON.stringify({ users: emails.sort(), created: createdSlugs, reused: reusedSlugs }, null, 2));
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
