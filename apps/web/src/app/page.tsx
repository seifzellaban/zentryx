"use client";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@zentryx/ui/components/button";
import { Card, CardContent } from "@zentryx/ui/components/card";
import { ArrowRight, Globe, Layers, Shield, Sparkles, Users, Zap } from "lucide-react";
import Link from "next/link";

import { trpc } from "@/utils/trpc";

export default function Home() {
  const healthCheck = useQuery(trpc.healthCheck.queryOptions());

  return (
    <div className="py-8 sm:py-10">
      {/* Hero */}
      <div className="grid gap-8 lg:grid-cols-[1.15fr_0.85fr] lg:items-center">
        <div className="space-y-6">
          <div className="inline-flex items-center gap-2 rounded-full border border-border bg-card px-3 py-1 text-xs font-medium shadow-sm">
            <span className="size-2 animate-pulse rounded-full bg-accent" />
            Live on localhost — M1 foundation ready
          </div>

          <div className="space-y-4">
            <h1 className="font-serif text-4xl font-bold leading-[0.95] tracking-tight sm:text-5xl lg:text-[52px]">
              A branded home
              <br />
              <span className="font-light italic text-muted-foreground">for skill-based</span>
              <br />
              mentors.
            </h1>
            <p className="max-w-[52ch] text-base leading-relaxed text-muted-foreground sm:text-[17px]">
              Zentryx is constellations, clusters, and real sessions — not a nicer Discord, not a
              course warehouse. Create a constellation, invite members, gate clusters with intent.
            </p>
          </div>

          <div className="flex flex-wrap gap-3">
            <Link href="/constellations/new">
              <Button size="lg" className="gap-2 rounded-full px-6 shadow-md">
                Create constellation <ArrowRight className="size-4" />
              </Button>
            </Link>
            <Link href="/dashboard">
              <Button variant="outline" size="lg" className="rounded-full bg-card px-6">
                Open dashboard
              </Button>
            </Link>
          </div>

          <div className="flex flex-wrap items-center gap-4 pt-2 text-xs text-muted-foreground">
            <span className="inline-flex items-center gap-1.5">
              <Users className="size-3.5" /> Auth + invites
            </span>
            <span className="inline-flex items-center gap-1.5">
              <Layers className="size-3.5" /> 3 visibility levels
            </span>
            <span className="inline-flex items-center gap-1.5">
              <Shield className="size-3.5" /> Server-enforced roles
            </span>
          </div>
        </div>

        <div className="space-y-4">
          <Card className="overflow-hidden rounded-[1.25rem] border-border/60 bg-card shadow-xl">
            <CardContent className="space-y-5 p-5 sm:p-6">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="flex size-8 items-center justify-center rounded-full bg-accent text-accent-foreground">
                    <Zap className="size-4" />
                  </span>
                  <div>
                    <p className="text-sm font-semibold leading-none">API Status</p>
                    <p className="text-xs text-muted-foreground">tRPC • Neon • Better Auth</p>
                  </div>
                </div>
                <span
                  className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium ${
                    healthCheck.data
                      ? "bg-accent text-accent-foreground"
                      : healthCheck.isLoading
                        ? "bg-muted text-muted-foreground"
                        : "bg-destructive/10 text-destructive"
                  }`}
                >
                  <span
                    className={`size-1.5 rounded-full ${healthCheck.data ? "bg-accent-foreground animate-pulse" : healthCheck.isLoading ? "bg-muted-foreground animate-pulse" : "bg-destructive"}`}
                  />
                  {healthCheck.isLoading ? "Checking…" : healthCheck.data ? "Connected" : "Offline"}
                </span>
              </div>

              <div className="rounded-xl bg-muted p-4 font-mono text-xs leading-relaxed">
                <div className="flex items-center gap-2 text-[11px] font-semibold tracking-widest text-muted-foreground">
                  <Globe className="size-3" /> STACK
                </div>
                <div className="mt-2 grid grid-cols-2 gap-2">
                  <div className="rounded-lg bg-card p-2.5">
                    <p className="font-semibold text-foreground">web :3001</p>
                    <p className="text-muted-foreground">Next 16 • React 19 • Tailwind 4</p>
                  </div>
                  <div className="rounded-lg bg-card p-2.5">
                    <p className="font-semibold text-foreground">server :3000</p>
                    <p className="text-muted-foreground">Elysia + tRPC • Drizzle</p>
                  </div>
                </div>
                <div className="mt-3 flex items-center gap-2 text-muted-foreground">
                  <Sparkles className="size-3" />
                  demo-nav@zentryx.dev / demo-member@zentryx.dev
                  <span className="ml-auto rounded bg-accent px-1.5 py-0.5 font-semibold text-accent-foreground">
                    zentryx-demo-1
                  </span>
                </div>
              </div>

              <div className="grid grid-cols-3 gap-2 text-center">
                <div className="rounded-xl bg-primary p-3 text-primary-foreground">
                  <p className="font-serif text-xl font-bold">3</p>
                  <p className="text-[11px] font-medium tracking-wide opacity-80">VISIBILITY</p>
                </div>
                <div className="rounded-xl bg-secondary p-3">
                  <p className="font-serif text-xl font-bold text-secondary-foreground">4</p>
                  <p className="text-[11px] font-medium tracking-wide text-muted-foreground">
                    ROLES
                  </p>
                </div>
                <div className="rounded-xl border bg-card p-3">
                  <p className="font-serif text-xl font-bold">M1</p>
                  <p className="text-[11px] font-medium tracking-wide text-muted-foreground">
                    LIVE
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          <div className="grid grid-cols-3 gap-3">
            <FeatureMini
              icon={Layers}
              title="Constellations"
              desc="Top-level communities, draft → published"
            />
            <FeatureMini icon={Users} title="Clusters" desc="public / members / invite → access" />
            <FeatureMini icon={Shield} title="Invites" desc="Token, expiry, email-bound" />
          </div>
        </div>
      </div>

      {/* Bottom detail */}
      <div className="mt-10 grid gap-4 sm:grid-cols-3">
        <Card className="rounded-2xl">
          <CardContent className="space-y-2 p-5">
            <p className="text-xs font-semibold tracking-widest text-muted-foreground">
              01 — CREATE
            </p>
            <h3 className="font-serif text-lg font-semibold leading-tight">
              Name it, slug it, publish
            </h3>
            <p className="text-sm leading-relaxed text-muted-foreground">
              Draft is yours alone. Publish opens discovery. Slug is unique and yours pre-publish.
            </p>
          </CardContent>
        </Card>
        <Card className="rounded-2xl border-primary/20 bg-primary text-primary-foreground">
          <CardContent className="space-y-2 p-5">
            <p className="text-xs font-semibold tracking-widest opacity-70">02 — GATE</p>
            <h3 className="font-serif text-lg font-semibold leading-tight">
              Clusters that mean it
            </h3>
            <p className="text-sm leading-relaxed opacity-80">
              Public is open. Members is joinable. Invite is locked. Moderator+ sees everything.
            </p>
          </CardContent>
        </Card>
        <Card className="rounded-2xl">
          <CardContent className="space-y-2 p-5">
            <p className="text-xs font-semibold tracking-widest text-muted-foreground">
              03 — INVITE
            </p>
            <h3 className="font-serif text-lg font-semibold leading-tight">
              Tokens, not links to leaking
            </h3>
            <p className="text-sm leading-relaxed text-muted-foreground">
              Email-bound or open tokens, 1–30 day expiry, single-use atomic claim.
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function FeatureMini({
  icon: Icon,
  title,
  desc,
}: {
  icon: React.ElementType;
  title: string;
  desc: string;
}) {
  return (
    <Card className="rounded-2xl">
      <CardContent className="space-y-1.5 p-3.5">
        <span className="flex size-7 items-center justify-center rounded-full bg-muted text-foreground">
          <Icon className="size-3.5" />
        </span>
        <p className="text-xs font-semibold leading-none">{title}</p>
        <p className="text-xs leading-tight text-muted-foreground">{desc}</p>
      </CardContent>
    </Card>
  );
}
