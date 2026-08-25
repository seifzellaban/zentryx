import { headers } from "next/headers";
import { redirect } from "next/navigation";

import { authClient } from "@/lib/auth-client";

import ClusterView from "./cluster-view";

export default async function ClusterPage({
  params,
}: {
  params: Promise<{ slug: string; clusterSlug: string }>;
}) {
  const { slug, clusterSlug } = await params;

  const session = await authClient.getSession({
    fetchOptions: {
      headers: await headers(),
      throw: true,
    },
  });

  if (!session?.user) {
    redirect("/login");
  }

  return <ClusterView slug={slug} clusterSlug={clusterSlug} />;
}
