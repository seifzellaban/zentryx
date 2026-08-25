"use client";

import { useForm } from "@tanstack/react-form";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Lock } from "lucide-react";
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

import { authClient } from "@/lib/auth-client";
import { trpc } from "@/utils/trpc";

const badgeClasses =
  "inline-flex items-center rounded-none border border-border px-2 py-0.5 text-xs font-medium text-muted-foreground";

const selectClasses =
  "h-8 w-full rounded-none border border-input bg-transparent px-2.5 py-1 text-xs transition-colors outline-none focus-visible:border-ring focus-visible:ring-1 focus-visible:ring-ring/50 disabled:cursor-not-allowed disabled:opacity-50 dark:bg-input/30";

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
      <div className="mx-auto w-full max-w-3xl space-y-4 p-6">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-4 w-full max-w-md" />
        <Skeleton className="h-48 w-full" />
      </div>
    );
  }

  if (constellationQuery.isError || !constellation) {
    return (
      <div className="mx-auto w-full max-w-3xl p-6">
        <Card>
          <CardContent className="space-y-2">
            <h1 className="text-lg font-semibold">Constellation not found</h1>
            <p className="text-sm text-muted-foreground">
              This constellation does not exist or is unavailable.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="mx-auto w-full max-w-3xl space-y-6 p-6">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0 space-y-1.5">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-2xl font-bold">{constellation.name}</h1>
            <span className={badgeClasses}>{constellation.status}</span>
            <span className={badgeClasses}>{constellation.category}</span>
          </div>
          {constellation.description && (
            <p className="text-sm text-muted-foreground">{constellation.description}</p>
          )}
        </div>
        {canManage && constellation.status === "draft" && <PublishButton id={constellation.id} />}
      </div>

      {viewerRole === null && (
        <Card>
          <CardContent className="space-y-1.5">
            <h2 className="text-base font-semibold">
              You&apos;re not a member of this constellation yet
            </h2>
            <p className="text-sm text-muted-foreground">
              Ask an owner or navigator for an invite to see clusters and members.
            </p>
          </CardContent>
        </Card>
      )}

      {viewerRole !== null && (
        <>
          <nav className="flex gap-5 border-b border-border">
            {tabs.map((t) => (
              <button
                key={t.key}
                type="button"
                onClick={() => setTab(t.key)}
                className={`pb-2 text-sm transition-colors ${
                  tab === t.key
                    ? "-mb-px border-b border-foreground font-medium"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                {t.label}
              </button>
            ))}
          </nav>

          {tab === "overview" && (
            <p className="text-sm text-muted-foreground">
              A {constellation.category} constellation.
              {constellation.description ? ` ${constellation.description}` : ""}
            </p>
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
        toast.success("Published");
        queryClient.invalidateQueries(trpc.constellation.getBySlug.pathFilter());
      },
      onError: toastMutationError,
    }),
  );

  return (
    <Button size="sm" disabled={publish.isPending} onClick={() => publish.mutate({ id })}>
      {publish.isPending ? "Publishing..." : "Publish"}
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
            <NewClusterForm
              constellationId={constellationId}
              onDone={() => setShowNewCluster(false)}
            />
          ) : (
            <Button size="sm" variant="outline" onClick={() => setShowNewCluster(true)}>
              New cluster
            </Button>
          )}
        </div>
      )}

      {clustersQuery.isPending ? (
        <div className="space-y-2">
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-10 w-full" />
        </div>
      ) : clustersQuery.isError ? (
        <p className="text-sm text-muted-foreground">Could not load clusters.</p>
      ) : clustersQuery.data.length === 0 ? (
        <p className="text-sm text-muted-foreground">No clusters yet.</p>
      ) : (
        <ul className="divide-y divide-border">
          {clustersQuery.data.map((cluster) => (
            <li key={cluster.id} className="flex items-center justify-between gap-3 py-3">
              <div className="min-w-0 space-y-0.5">
                <p className="truncate text-sm font-medium">{cluster.name}</p>
                {cluster.description && (
                  <p className="truncate text-xs text-muted-foreground">{cluster.description}</p>
                )}
                <div className="flex flex-wrap items-center gap-1.5 pt-0.5">
                  <span className={badgeClasses}>{cluster.type}</span>
                  <span className={badgeClasses}>{cluster.visibility}</span>
                </div>
              </div>
              <div className="shrink-0">
                {cluster.access === "granted" && (
                  <Link
                    href={`/c/${slug}/${cluster.slug}` as Route}
                    className={buttonVariants({ variant: "outline", size: "sm" })}
                  >
                    Open
                  </Link>
                )}
                {cluster.access === "joinable" &&
                  (requestedIds.has(cluster.id) ? (
                    <span className="text-xs text-muted-foreground">Requested</span>
                  ) : (
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={requestAccess.isPending}
                      onClick={() => requestAccess.mutate({ clusterId: cluster.id })}
                    >
                      Request access
                    </Button>
                  ))}
                {cluster.access === "locked" && (
                  <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
                    <Lock className="size-3" /> Invite-only
                  </span>
                )}
              </div>
            </li>
          ))}
        </ul>
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
        name: z
          .string()
          .min(2, "Name must be at least 2 characters")
          .max(80, "Name must be at most 80 characters"),
        slug: z
          .string()
          .min(2, "Slug must be at least 2 characters")
          .max(63, "Slug must be at most 63 characters")
          .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "Use lowercase letters, numbers, and hyphens"),
        description: z.string().max(500, "Description must be at most 500 characters"),
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
            <Label htmlFor={`new-cluster-${field.name}`}>Name</Label>
            <Input
              id={`new-cluster-${field.name}`}
              name={field.name}
              required
              value={field.state.value}
              onBlur={field.handleBlur}
              onChange={(e) => {
                field.handleChange(e.target.value);
                if (!slugEdited) {
                  form.setFieldValue("slug", slugify(e.target.value));
                }
              }}
            />
            {field.state.meta.errors.map((error) => (
              <p key={error?.message} className="text-red-500">
                {error?.message}
              </p>
            ))}
          </div>
        )}
      </form.Field>

      <form.Field name="slug">
        {(field) => (
          <div className="space-y-2">
            <Label htmlFor={`new-cluster-${field.name}`}>Slug</Label>
            <Input
              id={`new-cluster-${field.name}`}
              name={field.name}
              required
              value={field.state.value}
              onBlur={field.handleBlur}
              onChange={(e) => {
                setSlugEdited(true);
                field.handleChange(e.target.value);
              }}
            />
            {field.state.meta.errors.map((error) => (
              <p key={error?.message} className="text-red-500">
                {error?.message}
              </p>
            ))}
          </div>
        )}
      </form.Field>

      <form.Field name="description">
        {(field) => (
          <div className="space-y-2">
            <Label htmlFor={`new-cluster-${field.name}`}>Description</Label>
            <Textarea
              id={`new-cluster-${field.name}`}
              name={field.name}
              maxLength={500}
              value={field.state.value}
              onBlur={field.handleBlur}
              onChange={(e) => field.handleChange(e.target.value)}
            />
            {field.state.meta.errors.map((error) => (
              <p key={error?.message} className="text-red-500">
                {error?.message}
              </p>
            ))}
          </div>
        )}
      </form.Field>

      <div className="grid grid-cols-2 gap-4">
        <form.Field name="visibility">
          {(field) => (
            <div className="space-y-2">
              <Label htmlFor={`new-cluster-${field.name}`}>Visibility</Label>
              <select
                id={`new-cluster-${field.name}`}
                name={field.name}
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
              <Label htmlFor={`new-cluster-${field.name}`}>Type</Label>
              <select
                id={`new-cluster-${field.name}`}
                name={field.name}
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
        <Button type="submit" disabled={createCluster.isPending}>
          {createCluster.isPending ? "Creating..." : "Create cluster"}
        </Button>
        <Button type="button" variant="ghost" onClick={onDone}>
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

  return (
    <div className="space-y-6">
      {isModeratorPlus && (
        <section className="space-y-2">
          <h2 className="text-sm font-semibold">Pending requests</h2>
          {pendingRequestsQuery.isPending ? (
            <Skeleton className="h-9 w-full" />
          ) : pendingRequestsQuery.isError ? (
            <p className="text-sm text-muted-foreground">Could not load pending requests.</p>
          ) : pendingRequestsQuery.data.length === 0 ? (
            <p className="text-sm text-muted-foreground">No pending requests.</p>
          ) : (
            <ul className="divide-y divide-border">
              {pendingRequestsQuery.data.map((request) => (
                <li
                  key={request.requestId}
                  className="flex items-center justify-between gap-3 py-2"
                >
                  <p className="truncate text-sm">
                    <span className="font-medium">{request.userName}</span>{" "}
                    <span className="text-muted-foreground">wants to join</span>{" "}
                    {request.clusterName}
                  </p>
                  <div className="flex shrink-0 gap-2">
                    <Button
                      size="xs"
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
        </section>
      )}

      {canManage && (
        <section className="space-y-2">
          <h2 className="text-sm font-semibold">Invite</h2>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-[1fr_140px_100px_auto] sm:items-end">
            <div className="space-y-1.5">
              <Label htmlFor="invite-email">Email (optional)</Label>
              <Input
                id="invite-email"
                name="email"
                type="email"
                placeholder="friend@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="invite-role">Role</Label>
              <select
                id="invite-role"
                name="role"
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
              <Label htmlFor="invite-expiry">Expires (days)</Label>
              <Input
                id="invite-expiry"
                name="expiresInDays"
                type="number"
                min={1}
                max={30}
                value={expiresInDays}
                onChange={(e) => setExpiresInDays(e.target.value)}
              />
            </div>
            <Button disabled={createInvite.isPending} onClick={submitInvite}>
              {createInvite.isPending ? "Creating..." : "Create invite"}
            </Button>
          </div>
          {inviteUrl && (
            <div className="flex items-center gap-2 pt-1">
              <Input
                readOnly
                value={inviteUrl}
                onFocus={(e) => e.currentTarget.select()}
                aria-label="Invite URL"
              />
              <Button variant="outline" onClick={copyInviteUrl}>
                Copy
              </Button>
            </div>
          )}
        </section>
      )}

      <section className="space-y-2">
        <h2 className="text-sm font-semibold">Members</h2>
        {membersQuery.isPending ? (
          <div className="space-y-2">
            <Skeleton className="h-9 w-full" />
            <Skeleton className="h-9 w-full" />
          </div>
        ) : membersQuery.isError ? (
          <p className="text-sm text-muted-foreground">Could not load members.</p>
        ) : (
          <ul className="divide-y divide-border">
            {membersQuery.data.map((member) => {
              return (
                <li
                  key={member.membershipId}
                  className="flex items-center justify-between gap-3 py-2.5"
                >
                  <p className="truncate text-sm font-medium">{member.name}</p>
                  <div className="flex shrink-0 items-center gap-2">
                    {viewerRole === "owner" ? (
                      <select
                        aria-label={`Role for ${member.name}`}
                        className={`${selectClasses} w-32`}
                        value={member.role}
                        onChange={(e) => {
                          const role = e.target.value as MemberRoleValue;
                          if (role === member.role) return;
                          setMemberRole.mutate({
                            membershipId: member.membershipId,
                            role,
                          });
                        }}
                      >
                        {memberRoles.map((role) => (
                          <option key={role} value={role}>
                            {role}
                          </option>
                        ))}
                      </select>
                    ) : (
                      <span className={badgeClasses}>{member.role}</span>
                    )}
                    {canManage &&
                      !(
                        member.role === "owner" &&
                        (viewerRole !== "owner" || member.userId === currentUserId)
                      ) && (
                        <Button
                          size="xs"
                          variant="destructive"
                          disabled={removeMember.isPending}
                          onClick={() => removeMember.mutate({ membershipId: member.membershipId })}
                        >
                          Remove
                        </Button>
                      )}
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </div>
  );
}
