"use client";

import { useMutation, useQuery } from "@tanstack/react-query";
import { Button } from "@zentryx/ui/components/button";
import { Card, CardContent } from "@zentryx/ui/components/card";
import { Skeleton } from "@zentryx/ui/components/skeleton";
import { useRouter } from "next/navigation";
import type { Route } from "next";
import { toast } from "sonner";

import { authClient } from "@/lib/auth-client";
import { trpc } from "@/utils/trpc";

export default function InviteView({ token }: { token: string }) {
  const router = useRouter();
  const { data: session, isPending: sessionPending } = authClient.useSession();

  const inviteQuery = useQuery(trpc.constellation.invitePreview.queryOptions({ token }));

  const acceptInvite = useMutation(
    trpc.constellation.acceptInvite.mutationOptions({
      onSuccess: (data) => {
        toast.success("Invitation accepted");
        router.push(`/c/${data.slug}` as Route);
      },
      onError: (error) => {
        if (error.data?.code === "FORBIDDEN") {
          toast.error("This invitation can't be accepted with this account");
          return;
        }
        toast.error(error.message || "Failed to accept invitation");
      },
    }),
  );

  if (inviteQuery.isPending) {
    return (
      <div className="mx-auto w-full max-w-md p-6">
        <Card>
          <CardContent className="space-y-3">
            <Skeleton className="h-7 w-48" />
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-40" />
            <Skeleton className="h-9 w-full" />
          </CardContent>
        </Card>
      </div>
    );
  }

  if (inviteQuery.isError || !inviteQuery.data) {
    return (
      <div className="mx-auto w-full max-w-md p-6">
        <Card>
          <CardContent className="space-y-1.5">
            <h1 className="text-lg font-semibold">Invitation unavailable</h1>
            <p className="text-sm text-muted-foreground">
              This invitation is invalid or has expired.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  const invite = inviteQuery.data;

  return (
    <div className="mx-auto w-full max-w-md p-6">
      <Card>
        <CardContent className="space-y-3">
          <div className="space-y-1">
            <p className="text-sm text-muted-foreground">You&apos;re invited to</p>
            <h1 className="text-2xl font-bold">{invite.name}</h1>
            <p className="text-sm text-muted-foreground">
              Expires{" "}
              <span suppressHydrationWarning>
                {new Date(invite.expiresAt).toLocaleDateString("en-US", {
                  month: "long",
                  day: "numeric",
                  year: "numeric",
                })}
              </span>
            </p>
          </div>
          {sessionPending ? (
            <Skeleton className="h-9 w-full" />
          ) : session ? (
            <Button
              className="w-full"
              disabled={acceptInvite.isPending}
              onClick={() => acceptInvite.mutate({ token })}
            >
              {acceptInvite.isPending ? "Accepting..." : "Accept invitation"}
            </Button>
          ) : (
            <>
              <Button className="w-full" onClick={() => router.push("/login")}>
                Sign in to accept
              </Button>
              <p className="text-sm text-muted-foreground">
                {invite.invitedEmail
                  ? `This invitation is for ${invite.invitedEmail}. Sign in with that email address to accept it.`
                  : "Sign in to accept this invitation."}
              </p>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
