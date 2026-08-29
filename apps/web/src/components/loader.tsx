import { Loader2 } from "lucide-react";

export default function Loader() {
  return (
    <div className="flex min-h-[240px] flex-col items-center justify-center gap-3 py-10">
      <span className="flex size-10 items-center justify-center rounded-xl bg-muted">
        <Loader2 className="size-5 animate-spin text-muted-foreground" />
      </span>
      <p className="text-sm text-muted-foreground">Loading…</p>
    </div>
  );
}
