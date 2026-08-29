import { Button } from "@zentryx/ui/components/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@zentryx/ui/components/dropdown-menu";
import { Skeleton } from "@zentryx/ui/components/skeleton";
import { LogOut, User } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";

import { authClient } from "@/lib/auth-client";

export default function UserMenu() {
  const router = useRouter();
  const { data: session, isPending } = authClient.useSession();

  if (isPending) {
    return <Skeleton className="h-9 w-24 rounded-full" />;
  }

  if (!session) {
    return (
      <Link href="/login">
        <Button className="rounded-full px-5 shadow-sm">Sign In</Button>
      </Link>
    );
  }

  const initials = session.user.name
    .split(" ")
    .map((n) => n[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <Button variant="outline" className="gap-2 rounded-full pr-1.5">
            <span className="flex size-7 items-center justify-center rounded-full bg-primary text-xs font-semibold text-primary-foreground">
              {initials}
            </span>
            <span className="hidden max-w-[12ch] truncate text-sm font-medium sm:inline">
              {session.user.name}
            </span>
          </Button>
        }
      />
      <DropdownMenuContent className="w-60 rounded-xl bg-card" align="end">
        <DropdownMenuLabel className="space-y-0.5">
          <p className="flex items-center gap-1.5 text-sm font-semibold leading-none">
            <User className="size-3.5" /> {session.user.name}
          </p>
          <p className="truncate text-xs font-normal text-muted-foreground">{session.user.email}</p>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuGroup>
          <DropdownMenuItem onClick={() => router.push("/dashboard")} className="rounded-lg">
            Dashboard
          </DropdownMenuItem>
          <DropdownMenuItem
            variant="destructive"
            className="gap-2 rounded-lg"
            onClick={() => {
              authClient.signOut({
                fetchOptions: {
                  onSuccess: () => {
                    router.push("/");
                  },
                },
              });
            }}
          >
            <LogOut className="size-4" /> Sign Out
          </DropdownMenuItem>
        </DropdownMenuGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
