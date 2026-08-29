"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Sparkles } from "lucide-react";

import { ModeToggle } from "./mode-toggle";
import UserMenu from "./user-menu";

const nav = [
  { to: "/", label: "Home" },
  { to: "/dashboard", label: "Dashboard" },
] as const;

export default function Header() {
  const pathname = usePathname();

  return (
    <header className="sticky top-0 z-40 w-full border-b border-border/70 bg-background/80 backdrop-blur supports-[backdrop-filter]:bg-background/70">
      <div className="mx-auto flex h-[64px] w-full max-w-6xl items-center justify-between gap-6 px-4 sm:px-6 lg:px-8">
        <div className="flex items-center gap-8">
          <Link href="/" className="flex items-center gap-2.5">
            <span className="flex size-8 items-center justify-center rounded-lg bg-primary text-primary-foreground shadow-sm">
              <Sparkles className="size-4" />
            </span>
            <span className="font-serif text-[17px] font-bold leading-none tracking-tight">
              ZENTRYX
            </span>
            <span className="hidden rounded-full bg-accent px-2 py-0.5 text-[10px] font-semibold tracking-widest text-accent-foreground sm:inline-flex">
              M1
            </span>
          </Link>

          <nav className="hidden items-center gap-1 sm:flex">
            {nav.map(({ to, label }) => {
              const active = pathname === to || (to !== "/" && pathname.startsWith(to));
              return (
                <Link
                  key={to}
                  href={to}
                  className={`rounded-full px-3.5 py-1.5 text-sm font-medium transition-colors ${
                    active
                      ? "bg-primary text-primary-foreground"
                      : "text-muted-foreground hover:bg-muted hover:text-foreground"
                  }`}
                >
                  {label}
                </Link>
              );
            })}
          </nav>
        </div>

        <div className="flex items-center gap-2">
          <nav className="flex items-center gap-1 sm:hidden">
            {nav.map(({ to, label }) => {
              const active = pathname === to;
              return (
                <Link
                  key={to}
                  href={to}
                  className={`rounded-full px-2.5 py-1 text-xs font-medium ${
                    active ? "bg-primary text-primary-foreground" : "text-muted-foreground"
                  }`}
                >
                  {label}
                </Link>
              );
            })}
          </nav>
          <ModeToggle />
          <UserMenu />
        </div>
      </div>
    </header>
  );
}
