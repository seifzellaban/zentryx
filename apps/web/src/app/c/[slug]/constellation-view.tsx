"use client";

import { useForm } from "@tanstack/react-form";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Check, Copy, Crown, Layers, Lock, Plus, Shield, Sparkles, Users } from "lucide-react";
import Link from "next/link";
import type { Route } from "next";
import { useState } from "react";
import { toast } from "sonner";
import z from "zod";

import { Button, buttonVariants } from "@zentryx/ui/components/button";
import { Card, CardContent } from "@zentryx/ui/components/card";
import { Input } from "@zentryx/ui/components/input";
import { Label } from "@zentryx/ui/components/label";
import { Skeleton } from "@zentryx/ui/components/skeleton";
import { Textarea } from "@zentryx/ui/components/textarea";

import { MagnitudeBadge, MagnitudeBreakdown } from "@/components/magnitude-badge";
import { authClient } from "@/lib/auth-client";
import { trpc } from "@/utils/trpc";

const tabs = [
  { key: "overview", label: "Overview" },
  { key: "clusters", label: "Clusters" },
  { key: "members", label: "Members" },
] as const;

type TabKey = (typeof tabs)[number]["key"];
type MemberRoleValue = "owner" | "navigator" | "moderator" | "member";
const memberRoles: MemberRoleValue[] = ["member", "moderator", "navigator", "owner"];

function slugify(value: string) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function toastMutationError(error: { data?: { code?: string } | null; message?: string }) {
  if (error.data?.code === "FORBIDDEN") {
    toast.error("Not allowed");
    return;
  }
  toast.error(error.message || "Something went wrong");
}

const selectClasses =
  "h-9 w-full rounded-xl border border-input bg-background px-3 text-sm outline-none focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/20";

export default function ConstellationView({ slug }: { slug: string }) {
  const { data: sessionData } = authClient.useSession();
  const [tab, setTab] = useState<TabKey>("overview");

  const constellationQuery = useQuery(trpc.constellation.getBySlug.queryOptions({ slug }));
  const constellation = constellationQuery.data?.constellation;
  const viewerRole = constellationQuery.data?.viewerRole ?? null;

  const canManage = viewerRole === "owner" || viewerRole === "navigator";
  const isModeratorPlus =
    viewerRole === "owner" || viewerRole === "navigator" || viewerRole === "moderator";

  if (constellationQuery.isPending) {
    return (
      <div className="mx-auto w-full max-w-5xl space-y-6 py-8">
        <Skeleton className="h-28 rounded-2xl" />
        <Skeleton className="h-10 w-64 rounded-full" />
        <Skeleton className="h-64 rounded-2xl" />
      </div>
    );
  }

  if (constellationQuery.isError || !constellation) {
    return (
      <div className="mx-auto w-full max-w-2xl py-12">
        <Card className="rounded-2xl border-border/60 shadow-lg">
          <CardContent className="space-y-3 p-8 text-center">
            <div className="mx-auto flex size-12 items-center justify-center rounded-xl bg-muted">
              <Layers className="size-6 text-muted-foreground" />
            </div>
            <h1 className="font-serif text-xl font-semibold">Constellation not found</h1>
            <p className="text-sm text-muted-foreground">
              This constellation does not exist or is unavailable.
            </p>
            <Link
              href="/dashboard"
              className={buttonVariants({ variant: "outline", className: "rounded-full" })}
            >
              Back to dashboard
            </Link>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="mx-auto w-full max-w-5xl space-y-6 py-8">
      {/* Header */}
      <div className="overflow-hidden rounded-[1.5rem] border border-border/60 bg-card shadow-xl">
        <div className="h-1.5 w-full bg-gradient-to-r from-primary via-accent to-primary" />
        <div className="p-6 sm:p-8">
          <div className="flex flex-col gap-6 lg:flex-row lg:items-start lg:justify-between">
            <div className="min-w-0 space-y-3">
              <div className="flex flex-wrap items-center gap-2">
                <span
                  className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold ${
                    constellation.status === "published"
                      ? "bg-accent text-accent-foreground"
                      : "bg-muted text-muted-foreground"
                  }`}
                >
                  <span className="size-1.5 rounded-full bg-current opacity-60" />
                  {constellation.status}
                </span>
                <span className="inline-flex items-center rounded-full border bg-background px-3 py-1 text-xs font-medium">
                  {constellation.category}
                </span>
                {viewerRole && (
                  <span className="inline-flex items-center gap-1 rounded-full bg-primary px-3 py-1 text-xs font-semibold text-primary-foreground">
                    <Crown className="size-3" /> {viewerRole}
                  </span>
                )}
              </div>

              <h1 className="font-serif text-3xl font-bold leading-tight tracking-tight sm:text-4xl">
                {constellation.name}
              </h1>
              {constellation.description ? (
                <p className="max-w-[60ch] text-sm leading-relaxed text-muted-foreground sm:text-base">
                  {constellation.description}
                </p>
              ) : (
                <p className="text-sm italic text-muted-foreground">No description yet.</p>
              )}
              <p className="font-mono text-xs tracking-wide text-muted-foreground">
                /c/{constellation.slug}
              </p>
            </div>

            <div className="flex shrink-0 flex-col gap-2">
              {canManage && constellation.status === "draft" && (
                <PublishButton id={constellation.id} />
              )}
              {!canManage && viewerRole && (
                <span className="inline-flex items-center justify-center rounded-full bg-muted px-4 py-2 text-xs font-medium text-muted-foreground">
                  Viewer • {viewerRole}
                </span>
              )}
            </div>
          </div>
        </div>
      </div>

      {viewerRole === null ? (
        <Card className="rounded-2xl border-amber-200 bg-amber-50/50 dark:border-amber-900 dark:bg-amber-950/20">
          <CardContent className="flex gap-4 p-6">
            <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-amber-500 text-white">
              <Lock className="size-5" />
            </span>
            <div className="space-y-1">
              <h2 className="font-semibold">You&apos;re not a member yet</h2>
              <p className="text-sm text-muted-foreground">
                Ask an owner or navigator for an invite link to see clusters and members. Draft
                constellations stay hidden from non-members.
              </p>
            </div>
          </CardContent>
        </Card>
      ) : (
        <>
          {/* Tabs */}
          <div className="flex items-center gap-2 overflow-x-auto pb-1">
            <div className="inline-flex rounded-full bg-muted p-1">
              {tabs.map((t) => (
                <button
                  key={t.key}
                  type="button"
                  onClick={() => setTab(t.key)}
                  className={`rounded-full px-4 py-1.5 text-sm font-medium transition-colors ${
                    tab === t.key
                      ? "bg-primary text-primary-foreground shadow-sm"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  {t.label}
                </button>
              ))}
            </div>
            <span className="ml-auto hidden items-center gap-1.5 text-xs text-muted-foreground sm:inline-flex">
              <Shield className="size-3.5" /> roles enforced server-side
            </span>
          </div>

          {tab === "overview" && (
            <div className="grid gap-4 lg:grid-cols-3">
              <Card className="rounded-2xl lg:col-span-2">
                <CardContent className="space-y-4 p-6">
                  <h3 className="font-serif text-lg font-semibold">About this constellation</h3>
                  <p className="text-sm leading-relaxed text-muted-foreground">
                    A {constellation.category} community. Create clusters for discussions, cohorts,
                    or libraries — then gate them by visibility. Members see only what they&apos;re
                    allowed to.
                  </p>
                  <div className="grid grid-cols-3 gap-3 pt-2">
                    <div className="rounded-xl bg-primary p-4 text-primary-foreground">
                      <p className="text-xs font-semibold tracking-widest opacity-70">STATUS</p>
                      <p className="font-serif text-lg font-bold capitalize">
                        {constellation.status}
                      </p>
                    </div>
                    <div className="rounded-xl bg-accent p-4 text-accent-foreground">
                      <p className="text-xs font-semibold tracking-widest opacity-70">CATEGORY</p>
                      <p className="font-serif text-lg font-bold capitalize">
                        {constellation.category}
                      </p>
                    </div>
                    <div className="rounded-xl border bg-card p-4">
                      <p className="text-xs font-semibold tracking-widest text-muted-foreground">
                        YOUR ROLE
                      </p>
                      <p className="font-serif text-lg font-bold capitalize">{viewerRole}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card className="rounded-2xl bg-secondary text-secondary-foreground">
                <CardContent className="space-y-3 p-6">
                  <div className="flex size-9 items-center justify-center rounded-xl bg-primary text-primary-foreground">
                    <Sparkles className="size-4" />
                  </div>
                  <h3 className="font-serif text-lg font-semibold leading-tight">
                    What&apos;s next?
                  </h3>
                  <ul className="space-y-2 text-sm leading-relaxed opacity-90">
                    <li>• Add a cluster → pick public / members / invite</li>
                    <li>• Create an invite → share the link</li>
                    <li>• Approve join requests from the Members tab</li>
                  </ul>
                  <Button
                    variant="outline"
                    size="sm"
                    className="mt-2 rounded-full bg-card"
                    onClick={() => setTab("clusters")}
                  >
                    Go to clusters
                  </Button>
                </CardContent>
              </Card>
            </div>
          )}

          {tab === "clusters" && (
            <ClustersTab slug={slug} constellationId={constellation.id} canManage={canManage} />
          )}

          {tab === "members" && (
            <MembersTab
              constellationId={constellation.id}
              viewerRole={viewerRole}
              canManage={canManage}
              isModeratorPlus={isModeratorPlus}
              currentUserId={sessionData?.user?.id ?? null}
            />
          )}
        </>
      )}
    </div>
  );
}

function PublishButton({ id }: { id: string }) {
  const queryClient = useQueryClient();
  const publish = useMutation(
    trpc.constellation.publish.mutationOptions({
      onSuccess: () => {
        toast.success("Published — now discoverable");
        queryClient.invalidateQueries(trpc.constellation.getBySlug.pathFilter());
      },
      onError: toastMutationError,
    }),
  );

  return (
    <Button
      className="gap-2 rounded-full shadow-md"
      disabled={publish.isPending}
      onClick={() => publish.mutate({ id })}
    >
      {publish.isPending ? "Publishing…" : "Publish constellation"} <Sparkles className="size-4" />
    </Button>
  );
}

function ClustersTab({
  slug,
  constellationId,
  canManage,
}: {
  slug: string;
  constellationId: string;
  canManage: boolean;
}) {
  const [showNewCluster, setShowNewCluster] = useState(false);
  const [requestedIds, setRequestedIds] = useState<Set<string>>(() => new Set());
  const clustersQuery = useQuery(
    trpc.cluster.listForConstellation.queryOptions({ constellationId }),
  );
  const requestAccess = useMutation(
    trpc.cluster.requestAccess.mutationOptions({
      onSuccess: (_data, variables) => {
        setRequestedIds((prev) => new Set(prev).add(variables.clusterId));
        toast.success("Request sent");
      },
      onError: toastMutationError,
    }),
  );

  return (
    <div className="space-y-4">
      {canManage && (
        <div>
          {showNewCluster ? (
            <Card className="rounded-2xl border-border/60 shadow-lg">
              <CardContent className="p-6">
                <div className="mb-4 flex items-center justify-between">
                  <h3 className="font-semibold">New cluster</h3>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="rounded-full"
                    onClick={() => setShowNewCluster(false)}
                  >
                    Close
                  </Button>
                </div>
                <NewClusterForm
                  constellationId={constellationId}
                  onDone={() => setShowNewCluster(false)}
                />
              </CardContent>
            </Card>
          ) : (
            <Button
              onClick={() => setShowNewCluster(true)}
              className="gap-2 rounded-full shadow-sm"
            >
              <Plus className="size-4" /> New cluster
            </Button>
          )}
        </div>
      )}

      {clustersQuery.isPending ? (
        <div className="grid gap-3 sm:grid-cols-2">
          <Skeleton className="h-32 rounded-2xl" />
          <Skeleton className="h-32 rounded-2xl" />
        </div>
      ) : clustersQuery.isError ? (
        <Card className="rounded-2xl">
          <CardContent className="p-6 text-sm text-muted-foreground">
            Could not load clusters.
          </CardContent>
        </Card>
      ) : clustersQuery.data.length === 0 ? (
        <Card className="rounded-2xl border-dashed">
          <CardContent className="space-y-2 p-8 text-center">
            <div className="mx-auto flex size-10 items-center justify-center rounded-xl bg-muted">
              <Layers className="size-5 text-muted-foreground" />
            </div>
            <p className="font-medium">No clusters yet</p>
            <p className="text-sm text-muted-foreground">
              {canManage
                ? "Create your first cluster to organize discussions."
                : "An owner will add clusters soon."}
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2">
          {clustersQuery.data.map((cluster) => (
            <Card
              key={cluster.id}
              className="group overflow-hidden rounded-2xl border-border/60 transition-all hover:shadow-md"
            >
              <div
                className={`h-1 w-full ${
                  cluster.visibility === "public"
                    ? "bg-accent"
                    : cluster.visibility === "members"
                      ? "bg-primary"
                      : "bg-muted-foreground"
                }`}
              />
              <CardContent className="space-y-3 p-5">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0 space-y-1">
                    <h3 className="truncate font-serif text-base font-semibold leading-tight">
                      {cluster.name}
                    </h3>
                    {cluster.description && (
                      <p className="line-clamp-2 text-xs leading-relaxed text-muted-foreground">
                        {cluster.description}
                      </p>
                    )}
                  </div>
                  {cluster.access === "locked" && (
                    <Lock className="size-4 shrink-0 text-muted-foreground" />
                  )}
                </div>

                <div className="flex flex-wrap gap-1.5">
                  <span className="rounded-full border bg-card px-2 py-0.5 text-xs font-medium">
                    {cluster.type}
                  </span>
                  <span
                    className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                      cluster.visibility === "public"
                        ? "bg-accent text-accent-foreground"
                        : cluster.visibility === "members"
                          ? "bg-primary text-primary-foreground"
                          : "bg-muted text-muted-foreground"
                    }`}
                  >
                    {cluster.visibility}
                  </span>
                </div>

                <div className="pt-1">
                  {cluster.access === "granted" && (
                    <Link
                      href={`/c/${slug}/${cluster.slug}` as Route}
                      className={buttonVariants({
                        variant: "outline",
                        size: "sm",
                        className: "w-full rounded-full",
                      })}
                    >
                      Open cluster
                    </Link>
                  )}
                  {cluster.access === "joinable" &&
                    (requestedIds.has(cluster.id) ? (
                      <span className="flex h-7 items-center justify-center gap-1.5 rounded-full bg-muted text-xs font-medium text-muted-foreground">
                        <Check className="size-3.5" /> Requested
                      </span>
                    ) : (
                      <Button
                        size="sm"
                        className="w-full rounded-full"
                        disabled={requestAccess.isPending}
                        onClick={() => requestAccess.mutate({ clusterId: cluster.id })}
                      >
                        Request access
                      </Button>
                    ))}
                  {cluster.access === "locked" && (
                    <div className="flex h-7 items-center justify-center gap-1.5 rounded-full bg-muted text-xs font-medium text-muted-foreground">
                      <Lock className="size-3" /> Invite-only
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

function NewClusterForm({
  constellationId,
  onDone,
}: {
  constellationId: string;
  onDone: () => void;
}) {
  const queryClient = useQueryClient();
  const [slugEdited, setSlugEdited] = useState(false);

  const createCluster = useMutation(
    trpc.cluster.create.mutationOptions({
      onSuccess: () => {
        toast.success("Cluster created");
        queryClient.invalidateQueries(
          trpc.cluster.listForConstellation.queryFilter({ constellationId }),
        );
        onDone();
      },
      onError: (error) => {
        if (error.data?.code === "CONFLICT") {
          toast.error("That slug is already used");
          return;
        }
        toastMutationError(error);
      },
    }),
  );

  const form = useForm({
    defaultValues: {
      name: "",
      slug: "",
      description: "",
      visibility: "public" as "public" | "members" | "invite",
      type: "discussion" as "discussion" | "cohort" | "library",
    },
    validators: {
      onSubmit: z.object({
        name: z.string().min(2).max(80),
        slug: z
          .string()
          .min(2)
          .max(63)
          .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/),
        description: z.string().max(500),
        visibility: z.enum(["public", "members", "invite"]),
        type: z.enum(["discussion", "cohort", "library"]),
      }),
    },
    onSubmit: ({ value }) => {
      createCluster.mutate({ constellationId, ...value });
    },
  });

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        e.stopPropagation();
        form.handleSubmit();
      }}
      className="space-y-4"
    >
      <form.Field name="name">
        {(field) => (
          <div className="space-y-2">
            <Label className="text-xs font-semibold tracking-wide">Name</Label>
            <Input
              className="h-11 rounded-xl"
              placeholder="General, Trading Floor…"
              value={field.state.value}
              onBlur={field.handleBlur}
              onChange={(e) => {
                field.handleChange(e.target.value);
                if (!slugEdited) form.setFieldValue("slug", slugify(e.target.value));
              }}
            />
          </div>
        )}
      </form.Field>

      <form.Field name="slug">
        {(field) => (
          <div className="space-y-2">
            <Label className="text-xs font-semibold tracking-wide">Slug</Label>
            <Input
              className="h-11 rounded-xl font-mono text-sm"
              placeholder="general"
              value={field.state.value}
              onBlur={field.handleBlur}
              onChange={(e) => {
                setSlugEdited(true);
                field.handleChange(e.target.value);
              }}
            />
          </div>
        )}
      </form.Field>

      <form.Field name="description">
        {(field) => (
          <div className="space-y-2">
            <Label className="text-xs font-semibold tracking-wide">Description</Label>
            <Textarea
              className="min-h-[80px] rounded-xl"
              placeholder="What happens in this cluster?"
              value={field.state.value}
              onBlur={field.handleBlur}
              onChange={(e) => field.handleChange(e.target.value)}
            />
          </div>
        )}
      </form.Field>

      <div className="grid grid-cols-2 gap-4">
        <form.Field name="visibility">
          {(field) => (
            <div className="space-y-2">
              <Label className="text-xs font-semibold tracking-wide">Visibility</Label>
              <select
                className={selectClasses}
                value={field.state.value}
                onBlur={field.handleBlur}
                onChange={(e) => field.handleChange(e.target.value as typeof field.state.value)}
              >
                <option value="public">Public</option>
                <option value="members">Members</option>
                <option value="invite">Invite</option>
              </select>
            </div>
          )}
        </form.Field>
        <form.Field name="type">
          {(field) => (
            <div className="space-y-2">
              <Label className="text-xs font-semibold tracking-wide">Type</Label>
              <select
                className={selectClasses}
                value={field.state.value}
                onBlur={field.handleBlur}
                onChange={(e) => field.handleChange(e.target.value as typeof field.state.value)}
              >
                <option value="discussion">Discussion</option>
                <option value="cohort">Cohort</option>
                <option value="library">Library</option>
              </select>
            </div>
          )}
        </form.Field>
      </div>

      <div className="flex gap-2">
        <Button type="submit" disabled={createCluster.isPending} className="rounded-full">
          {createCluster.isPending ? "Creating…" : "Create cluster"}
        </Button>
        <Button type="button" variant="ghost" className="rounded-full" onClick={onDone}>
          Cancel
        </Button>
      </div>
    </form>
  );
}

function MembersTab({
  constellationId,
  viewerRole,
  canManage,
  isModeratorPlus,
  currentUserId,
}: {
  constellationId: string;
  viewerRole: MemberRoleValue;
  canManage: boolean;
  isModeratorPlus: boolean;
  currentUserId: string | null;
}) {
  const queryClient = useQueryClient();
  const membersQuery = useQuery(trpc.constellation.members.queryOptions({ constellationId }));
  const pendingRequestsQuery = useQuery({
    ...trpc.cluster.pendingRequests.queryOptions({ constellationId }),
    enabled: isModeratorPlus,
  });

  const setMemberRole = useMutation(
    trpc.constellation.setMemberRole.mutationOptions({
      onSuccess: () => {
        toast.success("Role updated");
        queryClient.invalidateQueries(trpc.constellation.members.queryFilter({ constellationId }));
      },
      onError: toastMutationError,
    }),
  );

  const removeMember = useMutation(
    trpc.constellation.removeMember.mutationOptions({
      onSuccess: () => {
        toast.success("Member removed");
        queryClient.invalidateQueries(trpc.constellation.members.queryFilter({ constellationId }));
      },
      onError: toastMutationError,
    }),
  );

  const respondToRequest = useMutation(
    trpc.cluster.respondToRequest.mutationOptions({
      onSuccess: (_data, variables) => {
        toast.success(variables.approve ? "Request approved" : "Request denied");
        queryClient.invalidateQueries(
          trpc.cluster.pendingRequests.queryFilter({ constellationId }),
        );
        queryClient.invalidateQueries(
          trpc.cluster.listForConstellation.queryFilter({ constellationId }),
        );
      },
      onError: toastMutationError,
    }),
  );

  const createInvite = useMutation(
    trpc.constellation.createInvite.mutationOptions({
      onSuccess: (data) => {
        setInviteUrl(data.url);
        toast.success("Invite created");
      },
      onError: toastMutationError,
    }),
  );

  const [email, setEmail] = useState("");
  const [inviteRole, setInviteRole] = useState<"member" | "moderator" | "navigator">("member");
  const [expiresInDays, setExpiresInDays] = useState("7");
  const [inviteUrl, setInviteUrl] = useState<string | null>(null);

  function submitInvite() {
    const trimmedEmail = email.trim();
    if (trimmedEmail && !/^\S+@\S+\.\S+$/.test(trimmedEmail)) {
      toast.error("Enter a valid email address");
      return;
    }
    const parsedDays = Number.parseInt(expiresInDays, 10);
    const days =
      Number.isFinite(parsedDays) && parsedDays >= 1 && parsedDays <= 30 ? parsedDays : 7;
    createInvite.mutate({
      constellationId,
      ...(trimmedEmail ? { invitedEmail: trimmedEmail } : {}),
      role: inviteRole,
      expiresInDays: days,
    });
  }

  async function copyInviteUrl() {
    if (!inviteUrl) return;
    try {
      await navigator.clipboard.writeText(inviteUrl);
      toast.success("Copied");
    } catch {
      toast.error("Could not copy invite link");
    }
  }

  const weightsQuery = useQuery({
    ...trpc.magnitude.listWeights.queryOptions({ constellationId }),
    enabled: canManage,
  });
  const setWeight = useMutation(
    trpc.magnitude.setWeight.mutationOptions({
      onSuccess: () => {
        toast.success("Weight updated");
        queryClient.invalidateQueries(trpc.magnitude.listWeights.queryFilter({ constellationId }));
      },
      onError: toastMutationError,
    }),
  );
  const [weightCategory, setWeightCategory] = useState<"attendance" | "post" | "endorsement">(
    "post",
  );
  const [weightValue, setWeightValue] = useState("1");

  return (
    <div className="space-y-6">
      {isModeratorPlus && (
        <Card className="rounded-2xl">
          <CardContent className="space-y-3 p-5 sm:p-6">
            <div className="flex items-center gap-2">
              <span className="flex size-7 items-center justify-center rounded-full bg-accent text-accent-foreground">
                <Users className="size-4" />
              </span>
              <h2 className="font-semibold">Pending requests</h2>
              {pendingRequestsQuery.data && pendingRequestsQuery.data.length > 0 && (
                <span className="rounded-full bg-primary px-2 py-0.5 text-xs font-semibold text-primary-foreground">
                  {pendingRequestsQuery.data.length}
                </span>
              )}
            </div>
            {pendingRequestsQuery.isPending ? (
              <Skeleton className="h-10 rounded-xl" />
            ) : pendingRequestsQuery.isError ? (
              <p className="text-sm text-muted-foreground">Could not load pending requests.</p>
            ) : pendingRequestsQuery.data.length === 0 ? (
              <p className="text-sm text-muted-foreground">No pending requests.</p>
            ) : (
              <ul className="divide-y divide-border">
                {pendingRequestsQuery.data.map((request) => (
                  <li
                    key={request.requestId}
                    className="flex items-center justify-between gap-3 py-3"
                  >
                    <p className="truncate text-sm">
                      <span className="font-semibold">{request.userName}</span>{" "}
                      <span className="text-muted-foreground">wants to join</span>{" "}
                      {request.clusterName}
                    </p>
                    <div className="flex shrink-0 gap-1.5">
                      <Button
                        size="xs"
                        className="rounded-full"
                        disabled={respondToRequest.isPending}
                        onClick={() =>
                          respondToRequest.mutate({ requestId: request.requestId, approve: true })
                        }
                      >
                        Approve
                      </Button>
                      <Button
                        size="xs"
                        variant="outline"
                        className="rounded-full"
                        disabled={respondToRequest.isPending}
                        onClick={() =>
                          respondToRequest.mutate({ requestId: request.requestId, approve: false })
                        }
                      >
                        Deny
                      </Button>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      )}

      {canManage && (
        <Card className="rounded-2xl border-primary/10">
          <CardContent className="space-y-4 p-5 sm:p-6">
            <div className="flex items-center gap-2">
              <span className="flex size-7 items-center justify-center rounded-full bg-primary text-primary-foreground">
                <Plus className="size-4" />
              </span>
              <h2 className="font-semibold">Invite members</h2>
              <span className="ml-auto hidden text-xs text-muted-foreground sm:inline">
                Token • 1–30 days • optional email lock
              </span>
            </div>

            <div className="grid gap-3 sm:grid-cols-[1fr_140px_110px_auto] sm:items-end">
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold tracking-wide">Email (optional)</Label>
                <Input
                  type="email"
                  placeholder="friend@example.com"
                  className="h-9 rounded-xl"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold tracking-wide">Role</Label>
                <select
                  className={selectClasses}
                  value={inviteRole}
                  onChange={(e) => setInviteRole(e.target.value as typeof inviteRole)}
                >
                  <option value="member">Member</option>
                  <option value="moderator">Moderator</option>
                  <option value="navigator">Navigator</option>
                </select>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold tracking-wide">Expires</Label>
                <Input
                  type="number"
                  min={1}
                  max={30}
                  className="h-9 rounded-xl"
                  value={expiresInDays}
                  onChange={(e) => setExpiresInDays(e.target.value)}
                />
              </div>
              <Button
                disabled={createInvite.isPending}
                onClick={submitInvite}
                className="h-9 rounded-full"
              >
                {createInvite.isPending ? "Creating…" : "Create"}
              </Button>
            </div>

            {inviteUrl && (
              <div className="flex items-center gap-2 rounded-xl bg-muted p-2">
                <Input
                  readOnly
                  value={inviteUrl}
                  className="h-8 flex-1 rounded-lg border-0 bg-card font-mono text-xs"
                  onFocus={(e) => e.currentTarget.select()}
                  aria-label="Invite URL"
                />
                <Button
                  variant="outline"
                  size="sm"
                  className="gap-1.5 rounded-full bg-card"
                  onClick={copyInviteUrl}
                >
                  <Copy className="size-3.5" /> Copy
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {canManage && (
        <section className="space-y-2 rounded-2xl border bg-card p-4">
          <h3 className="text-sm font-semibold">Magnitude weights (0.5–2×)</h3>
          {weightsQuery.isPending ? (
            <Skeleton className="h-10 rounded-xl" />
          ) : weightsQuery.data ? (
            <div className="space-y-2 text-xs">
              <p className="text-muted-foreground">
                attendance {weightsQuery.data.attendance} • post {weightsQuery.data.post} •
                endorsement {weightsQuery.data.endorsement}
              </p>
              <div className="flex gap-2">
                <select
                  className={selectClasses}
                  value={weightCategory}
                  onChange={(e) => setWeightCategory(e.target.value as any)}
                >
                  <option value="attendance">attendance</option>
                  <option value="post">post</option>
                  <option value="endorsement">endorsement</option>
                </select>
                <Input
                  type="number"
                  min={0.5}
                  max={2}
                  step={0.1}
                  value={weightValue}
                  onChange={(e) => setWeightValue(e.target.value)}
                  className="h-9 rounded-xl"
                />
                <Button
                  size="sm"
                  className="rounded-full"
                  onClick={() => {
                    const v = Number.parseFloat(weightValue);
                    if (!Number.isFinite(v) || v < 0.5 || v > 2) {
                      toast.error("Weight must be 0.5–2");
                      return;
                    }
                    setWeight.mutate({ constellationId, category: weightCategory, weight: v });
                  }}
                >
                  Save
                </Button>
              </div>
            </div>
          ) : null}
        </section>
      )}

      <Card className="rounded-2xl">
        <CardContent className="space-y-3 p-5 sm:p-6">
          <div className="flex items-center gap-2">
            <h2 className="font-semibold">Members</h2>
            {membersQuery.data && (
              <span className="rounded-full bg-muted px-2 py-0.5 text-xs">
                {membersQuery.data.length}
              </span>
            )}
          </div>
          {membersQuery.isPending ? (
            <div className="space-y-2">
              <Skeleton className="h-12 rounded-xl" />
              <Skeleton className="h-12 rounded-xl" />
            </div>
          ) : membersQuery.isError ? (
            <p className="text-sm text-muted-foreground">Could not load members.</p>
          ) : (
            <ul className="divide-y divide-border/70">
              {membersQuery.data.map((member) => (
                <li
                  key={member.membershipId}
                  className="flex items-center justify-between gap-3 py-3"
                >
                  <div className="flex items-center gap-3">
                    <span className="flex size-9 items-center justify-center rounded-full bg-secondary font-mono text-xs font-semibold text-secondary-foreground">
                      {member.name.slice(0, 2).toUpperCase()}
                    </span>
                    <div>
                      <p className="text-sm font-medium leading-none">{member.name}</p>
                      <p className="font-mono text-xs text-muted-foreground">{member.role}</p>
                    </div>
                    <MagnitudeBadge constellationId={constellationId} userId={member.userId} />
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    {viewerRole === "owner" ? (
                      <select
                        aria-label={`Role for ${member.name}`}
                        className={`${selectClasses} w-32`}
                        value={member.role}
                        onChange={(e) => {
                          const role = e.target.value as MemberRoleValue;
                          if (role === member.role) return;
                          setMemberRole.mutate({ membershipId: member.membershipId, role });
                        }}
                      >
                        {memberRoles.map((role) => (
                          <option key={role} value={role}>
                            {role}
                          </option>
                        ))}
                      </select>
                    ) : (
                      <span className="rounded-full border bg-card px-2.5 py-1 text-xs font-medium">
                        {member.role}
                      </span>
                    )}
                    {canManage &&
                      !(
                        member.role === "owner" &&
                        (viewerRole !== "owner" || member.userId === currentUserId)
                      ) && (
                        <Button
                          size="xs"
                          variant="destructive"
                          className="rounded-full"
                          disabled={removeMember.isPending}
                          onClick={() => removeMember.mutate({ membershipId: member.membershipId })}
                        >
                          Remove
                        </Button>
                      )}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
