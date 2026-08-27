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
    <div className="mx-auto w-full max-w-md p-6">
      <h1 className="mb-6 text-center text-3xl font-bold">Create a constellation</h1>
      <CreateForm />
    </div>
  );
}
