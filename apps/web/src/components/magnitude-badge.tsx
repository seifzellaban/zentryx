"use client";

import { useQuery } from "@tanstack/react-query";
import { trpc } from "@/utils/trpc";

export function MagnitudeBadge({
  constellationId,
  userId,
}: {
  constellationId: string;
  userId: string;
}) {
  const q = useQuery(trpc.magnitude.getBreakdown.queryOptions({ constellationId, userId }));
  if (q.isPending) return <span className="rounded-full bg-muted px-2 py-0.5 text-xs">…</span>;
  if (q.isError) return null;
  return (
    <span
      className="rounded-full bg-primary px-2.5 py-1 text-xs font-semibold text-primary-foreground"
      title={`attendance ${q.data.byCategory.attendance} • post ${q.data.byCategory.post} • endorsement ${q.data.byCategory.endorsement}`}
    >
      {q.data.total} ✦
    </span>
  );
}

export function MagnitudeBreakdown({
  constellationId,
  userId,
}: {
  constellationId: string;
  userId: string;
}) {
  const q = useQuery(trpc.magnitude.getBreakdown.queryOptions({ constellationId, userId }));
  if (q.isPending || q.isError || !q.data) return null;
  return (
    <div className="rounded-xl bg-muted p-3 text-xs">
      <p className="font-semibold">Magnitude {q.data.total}</p>
      <p className="text-muted-foreground">
        attendance {q.data.byCategory.attendance} • post {q.data.byCategory.post} • endorsement{" "}
        {q.data.byCategory.endorsement} ({q.data.events} events)
      </p>
    </div>
  );
}
