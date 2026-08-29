"use client";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@zentryx/ui/components/button";
import { Card, CardContent } from "@zentryx/ui/components/card";
import { Skeleton } from "@zentryx/ui/components/skeleton";
import { ArrowRight, Layers, Plus, Sparkles } from "lucide-react";
import Link from "next/link";
import type { Route } from "next";

import { authClient } from "@/lib/auth-client";
import { trpc } from "@/utils/trpc";

export default function Dashboard({ session }: { session: typeof authClient.$Infer.Session }) {
  const mine = useQuery(trpc.constellation.listMine.queryOptions());

  if (mine.isPending) {
    return (
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <Skeleton className="h-44 rounded-2xl" />
        <Skeleton className="h-44 rounded-2xl" />
        <Skeleton className="h-44 rounded-2xl" />
      </div>
    );
  }

  if (mine.isError) {
    return (
      <Card className="rounded-2xl border-destructive/20">
        <CardContent className="p-6">
          <p className="text-sm font-medium">Could not load your constellations.</p>
          <p className="text-sm text-muted-foreground">Please reload the page.</p>
        </CardContent>
      </Card>
    );
  }

  if (!mine.data || mine.data.length === 0) {
    return (
      <Card className="overflow-hidden rounded-[1.5rem] border-border/60 shadow-xl">
        <div className="h-1.5 w-full bg-gradient-to-r from-primary via-accent to-primary" />
        <CardContent className="space-y-6 p-6 sm:p-8">
          <div className="flex flex-col gap-6 sm:flex-row sm:items-start sm:justify-between">
            <div className="space-y-3">
              <span className="inline-flex items-center gap-2 rounded-full bg-accent px-3 py-1 text-xs font-semibold text-accent-foreground">
                <Sparkles className="size-3.5" /> No constellations yet
              </span>
              <h2 className="font-serif text-2xl font-bold leading-tight tracking-tight sm:text-3xl">
                Create your first
                <br />
                <span className="font-light italic text-muted-foreground">constellation</span>
              </h2>
              <p className="max-w-[42ch] text-sm leading-relaxed text-muted-foreground">
                Spin up a skill community, add clusters with visibility gates, and invite members
                with single-use tokens. You&apos;ll be live in under a minute.
              </p>
              <div className="flex flex-wrap gap-3 pt-1">
                <Link href="/constellations/new">
                  <Button className="gap-2 rounded-full px-5 shadow-md">
                    <Plus className="size-4" /> Create constellation
                  </Button>
                </Link>
                <Link href="/">
                  <Button variant="outline" className="rounded-full bg-card">
                    Learn more
                  </Button>
                </Link>
              </div>
            </div>

            <div className="hidden w-[280px] shrink-0 sm:block">
              <div className="rounded-2xl border bg-muted p-4">
                <p className="text-xs font-semibold tracking-widest text-muted-foreground">
                  WHAT YOU GET
                </p>
                <ul className="mt-3 space-y-2 text-sm">
                  <li className="flex items-center gap-2">
                    <span className="size-1.5 rounded-full bg-primary" />
                    Draft → published lifecycle
                  </li>
                  <li className="flex items-center gap-2">
                    <span className="size-1.5 rounded-full bg-accent" />3 cluster visibilities
                  </li>
                  <li className="flex items-center gap-2">
                    <span className="size-1.5 rounded-full bg-secondary" />
                    Role-gated invites & requests
                  </li>
                </ul>
                <div className="mt-4 rounded-xl bg-card p-3 font-mono text-xs">
                  <p className="font-semibold">demo-constellation</p>
                  <p className="text-muted-foreground">
                    open-lounge / live-trading / mentors-lounge
                  </p>
                </div>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <span className="h-px flex-1 bg-border" />
            signed in as {session.user.email}
            <span className="h-px flex-1 bg-border" />
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <h2 className="font-serif text-xl font-semibold tracking-tight">Your constellations</h2>
          <span className="rounded-full bg-muted px-2.5 py-1 text-xs font-medium">
            {mine.data.length} total
          </span>
        </div>
        <Link href="/constellations/new">
          <Button className="gap-2 rounded-full shadow-sm">
            <Plus className="size-4" /> New constellation
          </Button>
        </Link>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {mine.data.map((c) => (
          <Link key={c.id} href={`/c/${c.slug}` as Route} className="group">
            <Card className="h-full overflow-hidden rounded-2xl border-border/60 transition-all hover:-translate-y-0.5 hover:shadow-lg">
              <div className="h-1 w-full bg-gradient-to-r from-primary to-accent opacity-80 group-hover:opacity-100" />
              <CardContent className="space-y-4 p-5">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex size-10 items-center justify-center rounded-xl bg-primary text-primary-foreground shadow-sm">
                    <Layers className="size-5" />
                  </div>
                  <span
                    className={`rounded-full px-2.5 py-1 text-[11px] font-semibold tracking-wide ${
                      c.status === "published"
                        ? "bg-accent text-accent-foreground"
                        : "bg-muted text-muted-foreground"
                    }`}
                  >
                    {c.status}
                  </span>
                </div>

                <div className="space-y-1">
                  <h3 className="font-serif text-lg font-semibold leading-tight tracking-tight group-hover:underline decoration-border underline-offset-4">
                    {c.name}
                  </h3>
                  <p className="font-mono text-xs tracking-wide text-muted-foreground">
                    /c/{c.slug}
                  </p>
                </div>

                <div className="flex flex-wrap gap-1.5">
                  <span className="rounded-full border bg-card px-2.5 py-1 text-xs font-medium">
                    {c.category}
                  </span>
                  <span className="rounded-full bg-secondary px-2.5 py-1 text-xs font-medium text-secondary-foreground">
                    {c.role}
                  </span>
                </div>

                <div className="flex items-center gap-1.5 pt-1 text-xs font-medium text-muted-foreground group-hover:text-foreground">
                  Open{" "}
                  <ArrowRight className="size-3.5 transition-transform group-hover:translate-x-0.5" />
                </div>
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>

      <Card className="rounded-2xl bg-muted/50">
        <CardContent className="flex flex-wrap items-center justify-between gap-3 p-4 text-sm">
          <span className="text-muted-foreground">
            API:{" "}
            <span className="font-medium text-foreground">
              {useQuery(trpc.privateData.queryOptions()).data?.message ?? "—"}
            </span>
          </span>
          <span className="font-mono text-xs text-muted-foreground">{session.user.email}</span>
        </CardContent>
      </Card>
    </div>
  );
}
