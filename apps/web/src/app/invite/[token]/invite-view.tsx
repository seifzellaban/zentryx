"use client";

import { useMutation, useQuery } from "@tanstack/react-query";
import { Button } from "@zentryx/ui/components/button";
import { Card, CardContent } from "@zentryx/ui/components/card";
import { Skeleton } from "@zentryx/ui/components/skeleton";
import { ArrowRight, Calendar, Mail, Shield, Sparkles } from "lucide-react";
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
      <div className="mx-auto w-full max-w-md py-12">
        <Card className="rounded-2xl">
          <CardContent className="space-y-3 p-6">
            <Skeleton className="h-7 w-48 rounded-full" />
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-40" />
            <Skeleton className="h-11 w-full rounded-full" />
          </CardContent>
        </Card>
      </div>
    );
  }

  if (inviteQuery.isError || !inviteQuery.data) {
    return (
      <div className="mx-auto w-full max-w-md py-12">
        <Card className="rounded-2xl border-destructive/20">
          <CardContent className="space-y-3 p-8 text-center">
            <div className="mx-auto flex size-12 items-center justify-center rounded-xl bg-destructive/10 text-destructive">
              <Shield className="size-6" />
            </div>
            <h1 className="font-serif text-xl font-semibold">Invitation unavailable</h1>
            <p className="text-sm text-muted-foreground">
              This invitation is invalid, already used, or has expired.
            </p>
            <Button variant="outline" className="rounded-full" onClick={() => router.push("/")}>
              Go home
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  const invite = inviteQuery.data;

  return (
    <div className="mx-auto w-full max-w-md py-10">
      <div className="mb-6 text-center">
        <span className="inline-flex items-center gap-1.5 rounded-full bg-accent px-3 py-1 text-xs font-semibold text-accent-foreground">
          <Sparkles className="size-3.5" /> Invitation
        </span>
      </div>

      <Card className="overflow-hidden rounded-[1.5rem] border-border/60 shadow-xl">
        <div className="h-1.5 w-full bg-gradient-to-r from-primary via-accent to-primary" />
        <CardContent className="space-y-6 p-6 sm:p-7">
          <div className="space-y-3 text-center">
            <p className="text-xs font-semibold tracking-widest text-muted-foreground">
              YOU&apos;RE INVITED TO
            </p>
            <h1 className="font-serif text-3xl font-bold tracking-tight">{invite.name}</h1>
            <p className="font-mono text-xs tracking-wide text-muted-foreground">
              /c/{invite.slug}
            </p>
          </div>

          <div className="grid grid-cols-2 gap-3 text-sm">
            <div className="rounded-xl bg-muted p-3">
              <p className="flex items-center gap-1.5 text-xs font-semibold tracking-wide text-muted-foreground">
                <Calendar className="size-3.5" /> EXPIRES
              </p>
              <p className="mt-1 font-medium" suppressHydrationWarning>
                {new Date(invite.expiresAt).toLocaleDateString("en-US", {
                  month: "long",
                  day: "numeric",
                  year: "numeric",
                })}
              </p>
            </div>
            <div className="rounded-xl bg-card p-3 ring-1 ring-border">
              <p className="flex items-center gap-1.5 text-xs font-semibold tracking-wide text-muted-foreground">
                <Mail className="size-3.5" /> FOR
              </p>
              <p className="mt-1 truncate font-medium">
                {invite.invitedEmail ? invite.invitedEmail : "Anyone with link"}
              </p>
            </div>
          </div>

          {sessionPending ? (
            <Skeleton className="h-11 w-full rounded-full" />
          ) : session ? (
            <div className="space-y-3">
              <Button
                className="h-11 w-full gap-2 rounded-full text-sm font-semibold shadow-md"
                disabled={acceptInvite.isPending}
                onClick={() => acceptInvite.mutate({ token })}
              >
                {acceptInvite.isPending ? "Accepting…" : "Accept invitation"}{" "}
                <ArrowRight className="size-4" />
              </Button>
              {invite.invitedEmail &&
                invite.invitedEmail.toLowerCase() !== session.user.email.toLowerCase() && (
                  <p className="rounded-xl bg-amber-50 p-3 text-center text-xs leading-relaxed text-amber-800 dark:bg-amber-950/30 dark:text-amber-200">
                    This invite is for <span className="font-semibold">{invite.invitedEmail}</span>.
                    You&apos;re signed in as {session.user.email}. Switch accounts to accept.
                  </p>
                )}
            </div>
          ) : (
            <div className="space-y-3">
              <Button className="h-11 w-full rounded-full" onClick={() => router.push("/login")}>
                Sign in to accept
              </Button>
              <p className="text-center text-xs leading-relaxed text-muted-foreground">
                {invite.invitedEmail
                  ? `This invitation is for ${invite.invitedEmail}. Sign in with that address to accept it.`
                  : "Sign in to accept this invitation and join the constellation."}
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      <p className="mt-6 text-center font-mono text-xs text-muted-foreground">
        Token: {token.slice(0, 8)}…
      </p>
    </div>
  );
}
