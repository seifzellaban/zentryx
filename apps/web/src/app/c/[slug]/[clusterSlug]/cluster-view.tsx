"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, Check, Layers, Lock, Users } from "lucide-react";
import Link from "next/link";
import type { Route } from "next";
import { useState } from "react";
import { toast } from "sonner";

import { Button } from "@zentryx/ui/components/button";
import { Card, CardContent } from "@zentryx/ui/components/card";
import { Skeleton } from "@zentryx/ui/components/skeleton";
import { Textarea } from "@zentryx/ui/components/textarea";

import { trpc } from "@/utils/trpc";

function toastMutationError(error: { data?: { code?: string } | null; message?: string }) {
  if (error.data?.code === "FORBIDDEN") {
    toast.error("Not allowed");
    return;
  }
  toast.error(error.message || "Something went wrong");
}

export default function ClusterView({ slug, clusterSlug }: { slug: string; clusterSlug: string }) {
  const clusterQuery = useQuery(
    trpc.cluster.getBySlug.queryOptions({ constellationSlug: slug, clusterSlug }),
  );

  const queryClient = useQueryClient();
  const [content, setContent] = useState("");
  const [replyTo, setReplyTo] = useState<string | null>(null);

  const clusterId = clusterQuery.data?.cluster.id;
  const access = clusterQuery.data?.access;

  const postsQuery = useQuery({
    ...trpc.post.list.queryOptions({
      clusterId: clusterId ?? "00000000-0000-0000-0000-000000000000",
    }),
    enabled: !!clusterId && access === "granted",
  });

  const createPost = useMutation(
    trpc.post.create.mutationOptions({
      onSuccess: () => {
        setContent("");
        setReplyTo(null);
        toast.success("Posted");
        if (clusterId) queryClient.invalidateQueries(trpc.post.list.queryFilter({ clusterId }));
      },
      onError: (error) => {
        if (error.data?.code === "FORBIDDEN") toast.error("No access to post");
        else toast.error(error.message || "Failed to post");
      },
    }),
  );

  const pinPost = useMutation(
    trpc.post.pin.mutationOptions({
      onSuccess: () => {
        toast.success("Updated");
        if (clusterId) queryClient.invalidateQueries(trpc.post.list.queryFilter({ clusterId }));
      },
      onError: toastMutationError,
    }),
  );

  const deletePost = useMutation(
    trpc.post.delete.mutationOptions({
      onSuccess: () => {
        toast.success("Deleted");
        if (clusterId) queryClient.invalidateQueries(trpc.post.list.queryFilter({ clusterId }));
      },
      onError: toastMutationError,
    }),
  );

  if (clusterQuery.isPending) {
    return (
      <div className="mx-auto w-full max-w-5xl space-y-6 py-8">
        <Skeleton className="h-6 w-40 rounded-full" />
        <Skeleton className="h-28 rounded-2xl" />
        <Skeleton className="h-48 rounded-2xl" />
      </div>
    );
  }

  if (clusterQuery.isError) {
    if (clusterQuery.error.data?.code === "FORBIDDEN") {
      return (
        <div className="mx-auto w-full max-w-2xl py-12">
          <Card className="rounded-2xl border-amber-200 bg-amber-50/60 dark:border-amber-900 dark:bg-amber-950/20">
            <CardContent className="space-y-4 p-8 text-center">
              <div className="mx-auto flex size-12 items-center justify-center rounded-xl bg-amber-500 text-white">
                <Lock className="size-6" />
              </div>
              <h1 className="font-serif text-xl font-semibold">
                Not a member of this constellation
              </h1>
              <p className="text-sm text-muted-foreground">
                Join the constellation to see its clusters.
              </p>
              <Link
                href="/dashboard"
                className="inline-flex items-center gap-1 text-sm font-medium hover:underline"
              >
                <ArrowLeft className="size-4" /> Back to dashboard
              </Link>
            </CardContent>
          </Card>
        </div>
      );
    }
    return (
      <div className="mx-auto w-full max-w-2xl py-12">
        <Card className="rounded-2xl">
          <CardContent className="space-y-2 p-8 text-center">
            <h1 className="font-serif text-xl font-semibold">Cluster not found</h1>
            <p className="text-sm text-muted-foreground">
              This cluster does not exist or is unavailable.
            </p>
            <Link
              href={`/c/${slug}` as Route}
              className="inline-flex items-center gap-1 text-sm hover:underline"
            >
              <ArrowLeft className="size-4" /> Back
            </Link>
          </CardContent>
        </Card>
      </div>
    );
  }

  const { cluster, hasPendingRequest } = clusterQuery.data;

  return (
    <div className="mx-auto w-full max-w-5xl space-y-6 py-8">
      <Link
        href={`/c/${slug}` as Route}
        className="inline-flex items-center gap-1.5 rounded-full bg-muted px-3 py-1 text-xs font-medium text-muted-foreground hover:bg-muted/80 hover:text-foreground"
      >
        <ArrowLeft className="size-3.5" /> {slug}
      </Link>

      <div className="overflow-hidden rounded-[1.5rem] border border-border/60 bg-card shadow-xl">
        <div
          className={`h-1.5 w-full ${access === "granted" ? "bg-accent" : access === "joinable" ? "bg-primary" : "bg-muted-foreground"}`}
        />
        <div className="p-6 sm:p-8">
          <div className="flex flex-col gap-6 sm:flex-row sm:items-start sm:justify-between">
            <div className="min-w-0 space-y-3">
              <div className="flex flex-wrap items-center gap-2">
                <span className="flex size-9 items-center justify-center rounded-xl bg-primary text-primary-foreground">
                  <Layers className="size-4" />
                </span>
                <span className="rounded-full border bg-card px-2.5 py-1 text-xs font-medium">
                  {cluster.type}
                </span>
                <span
                  className={`rounded-full px-2.5 py-1 text-xs font-semibold ${
                    cluster.visibility === "public"
                      ? "bg-accent text-accent-foreground"
                      : cluster.visibility === "members"
                        ? "bg-primary text-primary-foreground"
                        : "bg-muted text-muted-foreground"
                  }`}
                >
                  {cluster.visibility}
                </span>
                <span
                  className={`rounded-full px-2.5 py-1 text-xs font-medium ${
                    access === "granted"
                      ? "bg-accent text-accent-foreground"
                      : access === "joinable"
                        ? "bg-secondary text-secondary-foreground"
                        : "bg-muted text-muted-foreground"
                  }`}
                >
                  {access}
                </span>
              </div>

              <h1 className="flex items-center gap-2 font-serif text-3xl font-bold tracking-tight sm:text-4xl">
                {access === "locked" && <Lock className="size-6 text-muted-foreground" />}
                {cluster.name}
              </h1>
              {cluster.description && (
                <p className="max-w-[60ch] text-sm leading-relaxed text-muted-foreground sm:text-base">
                  {cluster.description}
                </p>
              )}
              <p className="font-mono text-xs text-muted-foreground">
                /c/{slug}/{cluster.slug}
              </p>
            </div>

            {access === "joinable" && (
              <RequestAccess
                clusterId={cluster.id}
                hasPendingRequest={hasPendingRequest}
                slug={slug}
                clusterSlug={clusterSlug}
              />
            )}
            {access === "granted" && (
              <span className="inline-flex items-center gap-1.5 rounded-full bg-accent px-3 py-1.5 text-xs font-semibold text-accent-foreground">
                <Check className="size-3.5" /> You have access
              </span>
            )}
          </div>
        </div>
      </div>

      {access === "granted" && (
        <div className="space-y-4">
          <Card className="rounded-2xl">
            <CardContent className="space-y-3 p-5">
              {replyTo && (
                <div className="flex items-center justify-between rounded-xl bg-muted px-3 py-2 text-xs">
                  <span>Replying to {replyTo.slice(0, 8)}…</span>
                  <Button
                    variant="ghost"
                    size="xs"
                    className="rounded-full"
                    onClick={() => setReplyTo(null)}
                  >
                    Cancel
                  </Button>
                </div>
              )}
              <Textarea
                dir="auto"
                placeholder="Share something… try RTL مرحبا"
                className="min-h-[80px] rounded-xl"
                value={content}
                onChange={(e) => setContent(e.target.value)}
              />
              <div className="flex justify-end">
                <Button
                  className="rounded-full"
                  disabled={!content.trim() || createPost.isPending}
                  onClick={() =>
                    createPost.mutate({
                      clusterId: cluster.id,
                      content: content.trim(),
                      ...(replyTo ? { parentPostId: replyTo } : {}),
                    })
                  }
                >
                  {createPost.isPending ? "Posting…" : "Post"}
                </Button>
              </div>
            </CardContent>
          </Card>

          {postsQuery.isPending ? (
            <Skeleton className="h-32 rounded-2xl" />
          ) : postsQuery.isError ? (
            <p className="text-sm text-muted-foreground">Could not load posts.</p>
          ) : postsQuery.data.length === 0 ? (
            <Card className="rounded-2xl border-dashed">
              <CardContent className="p-6 text-center text-sm text-muted-foreground">
                No posts yet — be the first.
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-3">
              {postsQuery.data.map((post) => {
                const isReply = !!post.parentPostId;
                return (
                  <Card
                    key={post.id}
                    className={`rounded-2xl ${isReply ? "ml-6 border-l-4" : ""} ${post.pinned ? "border-accent bg-accent/5" : ""}`}
                  >
                    <CardContent className="space-y-2 p-4">
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0 flex-1">
                          <p
                            dir="auto"
                            className="whitespace-pre-wrap break-words text-sm leading-relaxed"
                          >
                            {post.content}
                          </p>
                          <p className="mt-1 font-mono text-xs text-muted-foreground">
                            {new Date(post.createdAt).toLocaleString()} •{" "}
                            {post.authorId.slice(0, 6)}
                          </p>
                        </div>
                        <div className="flex shrink-0 gap-1">
                          {access === "granted" && (
                            <Button
                              variant="ghost"
                              size="xs"
                              className="rounded-full"
                              onClick={() => setReplyTo(post.id)}
                            >
                              Reply
                            </Button>
                          )}
                          <Button
                            variant="ghost"
                            size="xs"
                            className="rounded-full"
                            onClick={() =>
                              pinPost.mutate({ postId: post.id, pinned: !post.pinned })
                            }
                          >
                            {post.pinned ? "Unpin" : "Pin"}
                          </Button>
                          <Button
                            variant="ghost"
                            size="xs"
                            className="rounded-full"
                            onClick={() => deletePost.mutate({ postId: post.id })}
                          >
                            Delete
                          </Button>
                        </div>
                      </div>
                      {post.pinned && (
                        <span className="inline-flex rounded-full bg-accent px-2 py-0.5 text-xs font-semibold text-accent-foreground">
                          Pinned
                        </span>
                      )}
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}
        </div>
      )}

      {access === "locked" && (
        <Card className="rounded-2xl">
          <CardContent className="flex gap-4 p-6">
            <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-muted text-muted-foreground">
              <Users className="size-5" />
            </span>
            <div className="space-y-1">
              <h2 className="font-semibold">Invite-only cluster</h2>
              <p className="text-sm text-muted-foreground">
                An owner or navigator must add you directly via the constellation members tab. Ask
                for an invite.
              </p>
            </div>
          </CardContent>
        </Card>
      )}

      {access === "joinable" && !hasPendingRequest && (
        <p className="text-center text-xs text-muted-foreground">
          Public → granted · Members → request · Invite → locked
        </p>
      )}
    </div>
  );
}

function RequestAccess({
  clusterId,
  hasPendingRequest,
  slug,
  clusterSlug,
}: {
  clusterId: string;
  hasPendingRequest: boolean;
  slug: string;
  clusterSlug: string;
}) {
  const queryClient = useQueryClient();
  const [requested, setRequested] = useState(false);

  const requestAccess = useMutation(
    trpc.cluster.requestAccess.mutationOptions({
      onSuccess: () => {
        setRequested(true);
        toast.success("Request sent");
        queryClient.invalidateQueries(
          trpc.cluster.getBySlug.queryFilter({ constellationSlug: slug, clusterSlug }),
        );
      },
      onError: (error) => {
        if (error.data?.code === "CONFLICT") {
          setRequested(true);
          toast.error("Request already exists");
          return;
        }
        toastMutationError(error);
      },
    }),
  );

  if (hasPendingRequest || requested) {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full bg-muted px-4 py-2 text-sm font-medium text-muted-foreground">
        <Check className="size-4" /> Requested
      </span>
    );
  }

  return (
    <Button
      className="gap-2 rounded-full shadow-md"
      disabled={requestAccess.isPending}
      onClick={() => requestAccess.mutate({ clusterId })}
    >
      Request access
    </Button>
  );
}
