"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, Lock } from "lucide-react";
import Link from "next/link";
import type { Route } from "next";
import { useState } from "react";
import { toast } from "sonner";

import { Button } from "@zentryx/ui/components/button";
import { Card, CardContent } from "@zentryx/ui/components/card";
import { Skeleton } from "@zentryx/ui/components/skeleton";

import { trpc } from "@/utils/trpc";

const badgeClasses =
  "inline-flex items-center rounded-none border border-border px-2 py-0.5 text-xs font-medium text-muted-foreground";

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

  if (clusterQuery.isPending) {
    return (
      <div className="mx-auto w-full max-w-3xl space-y-4 p-6">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-4 w-full max-w-md" />
        <Skeleton className="h-48 w-full" />
      </div>
    );
  }

  if (clusterQuery.isError) {
    if (clusterQuery.error.data?.code === "FORBIDDEN") {
      return (
        <div className="mx-auto w-full max-w-3xl p-6">
          <Card>
            <CardContent className="space-y-2">
              <h1 className="text-lg font-semibold">
                You&apos;re not a member of this constellation.
              </h1>
              <p className="text-sm text-muted-foreground">
                Join the constellation to see its clusters.
              </p>
              <Link
                href="/dashboard"
                className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
              >
                <ArrowLeft className="size-4" /> Back to dashboard
              </Link>
            </CardContent>
          </Card>
        </div>
      );
    }
    return (
      <div className="mx-auto w-full max-w-3xl p-6">
        <Card>
          <CardContent className="space-y-2">
            <h1 className="text-lg font-semibold">Cluster not found</h1>
            <p className="text-sm text-muted-foreground">
              This cluster does not exist or is unavailable.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  const { cluster, access, hasPendingRequest } = clusterQuery.data;

  return (
    <div className="mx-auto w-full max-w-3xl space-y-6 p-6">
      <Link
        href={`/c/${slug}` as Route}
        className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="size-4" /> Back to constellation
      </Link>

      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0 space-y-1.5">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="flex flex-wrap items-center gap-2 text-2xl font-bold">
              {access === "locked" && <Lock className="size-5" />}
              {cluster.name}
            </h1>
            <span className={badgeClasses}>{cluster.visibility}</span>
            <span className={badgeClasses}>{cluster.type}</span>
          </div>
          {cluster.description && (
            <p className="text-sm text-muted-foreground">{cluster.description}</p>
          )}
        </div>
        {access === "joinable" && (
          <RequestAccess
            clusterId={cluster.id}
            hasPendingRequest={hasPendingRequest}
            slug={slug}
            clusterSlug={clusterSlug}
          />
        )}
      </div>

      {access === "granted" && (
        <Card>
          <CardContent className="space-y-1.5">
            <h2 className="text-base font-semibold">Discussion space arrives in M2</h2>
            <p className="text-sm text-muted-foreground">
              Chat and async posts land in milestone M2. Recordings and sessions follow.
            </p>
          </CardContent>
        </Card>
      )}

      {access === "locked" && (
        <Card>
          <CardContent className="space-y-1.5">
            <h2 className="text-base font-semibold">Invite-only cluster</h2>
            <p className="text-sm text-muted-foreground">
              An owner or navigator must grant you access to this cluster.
            </p>
          </CardContent>
        </Card>
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
      <Button size="sm" variant="outline" disabled>
        Requested
      </Button>
    );
  }

  return (
    <Button
      size="sm"
      variant="outline"
      disabled={requestAccess.isPending}
      onClick={() => requestAccess.mutate({ clusterId })}
    >
      Request access
    </Button>
  );
}
