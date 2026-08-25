import { headers } from "next/headers";
import { redirect } from "next/navigation";

import { authClient } from "@/lib/auth-client";

import ConstellationView from "./constellation-view";

export default async function ConstellationPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;

  const session = await authClient.getSession({
    fetchOptions: {
      headers: await headers(),
      throw: true,
    },
  });

  if (!session?.user) {
    redirect("/login");
  }

  return <ConstellationView slug={slug} />;
}
