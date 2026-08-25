"use client";
import { useQuery } from "@tanstack/react-query";
import { buttonVariants } from "@zentryx/ui/components/button";
import { Card, CardContent } from "@zentryx/ui/components/card";
import Link from "next/link";
import type { Route } from "next";

import { authClient } from "@/lib/auth-client";
import { trpc } from "@/utils/trpc";

const badgeClasses =
  "inline-flex items-center rounded-none border border-border px-2 py-0.5 text-xs font-medium text-muted-foreground";

export default function Dashboard({ session }: { session: typeof authClient.$Infer.Session }) {
  const privateData = useQuery(trpc.privateData.queryOptions());
  const mine = useQuery(trpc.constellation.listMine.queryOptions());

  return (
    <>
      {mine.data?.length === 0 && (
        <Card>
          <CardContent className="space-y-3">
            <h2 className="text-base font-semibold">Create your first constellation</h2>
            <p className="text-sm text-muted-foreground">
              Spin up a skill community, add clusters, invite members.
            </p>
            <div>
              <Link href="/constellations/new" className={buttonVariants()}>
                Create constellation
              </Link>
            </div>
          </CardContent>
        </Card>
      )}
      {mine.data && mine.data.length > 0 && (
        <Card>
          <CardContent className="space-y-3">
            <h2 className="text-base font-semibold">Your constellations</h2>
            <ul className="space-y-2">
              {mine.data.map((constellation) => (
                <li key={constellation.id} className="flex items-center gap-2">
                  <Link
                    href={`/c/${constellation.slug}` as Route}
                    className="font-medium underline-offset-4 hover:underline"
                  >
                    {constellation.name}
                  </Link>
                  <span className={badgeClasses}>{constellation.role}</span>
                  <span className={badgeClasses}>{constellation.status}</span>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}
      <p>API: {privateData.data?.message}</p>
    </>
  );
}
