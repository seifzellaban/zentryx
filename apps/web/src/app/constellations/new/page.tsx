import { headers } from "next/headers";
import { redirect } from "next/navigation";

import { authClient } from "@/lib/auth-client";

import CreateForm from "./create-form";

export default async function CreateConstellationPage() {
  const session = await authClient.getSession({
    fetchOptions: {
      headers: await headers(),
      throw: true,
    },
  });

  if (!session?.user) {
    redirect("/login");
  }

  return (
    <div className="mx-auto w-full max-w-xl py-8 sm:py-10">
      <div className="mb-6 text-center">
        <p className="text-xs font-semibold tracking-widest text-muted-foreground">
          NEW CONSTELLATION
        </p>
        <h1 className="mt-2 font-serif text-3xl font-bold tracking-tight sm:text-4xl">
          Shape your <span className="font-light italic text-muted-foreground">community</span>
        </h1>
        <p className="mx-auto mt-2 max-w-[46ch] text-sm leading-relaxed text-muted-foreground">
          A constellation is a branded home for a skill — you&apos;ll add clusters and invite
          members next.
        </p>
      </div>
      <CreateForm />
    </div>
  );
}
