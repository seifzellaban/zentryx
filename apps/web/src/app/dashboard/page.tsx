import { headers } from "next/headers";
import { redirect } from "next/navigation";

import { authClient } from "@/lib/auth-client";

import Dashboard from "./dashboard";

export default async function DashboardPage() {
  const session = await authClient.getSession({
    fetchOptions: {
      headers: await headers(),
      throw: true,
    },
  });

  if (!session?.user) {
    redirect("/login");
  }

  return (
    <div className="py-8 sm:py-10">
      <div className="mb-8 space-y-2">
        <p className="text-xs font-semibold tracking-widest text-muted-foreground">DASHBOARD</p>
        <h1 className="font-serif text-3xl font-bold tracking-tight sm:text-4xl">
          Welcome,{" "}
          <span className="font-light italic">{session.user.name?.split(" ")[0] ?? "there"}</span>
        </h1>
        <p className="max-w-[60ch] text-sm leading-relaxed text-muted-foreground sm:text-base">
          Your constellations, memberships, and the clusters you can access — all in one place.
        </p>
      </div>
      <Dashboard session={session} />
    </div>
  );
}
