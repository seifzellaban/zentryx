import { useForm } from "@tanstack/react-form";
import { Button } from "@zentryx/ui/components/button";
import { Card, CardContent } from "@zentryx/ui/components/card";
import { Input } from "@zentryx/ui/components/input";
import { Label } from "@zentryx/ui/components/label";
import { ArrowRight, Sparkles } from "lucide-react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import z from "zod";

import { authClient } from "@/lib/auth-client";

import Loader from "./loader";

export default function SignInForm({ onSwitchToSignUp }: { onSwitchToSignUp: () => void }) {
  const router = useRouter();
  const { isPending } = authClient.useSession();

  const form = useForm({
    defaultValues: {
      email: "",
      password: "",
    },
    onSubmit: async ({ value }) => {
      await authClient.signIn.email(
        {
          email: value.email,
          password: value.password,
        },
        {
          onSuccess: () => {
            router.push("/dashboard");
            toast.success("Welcome back");
          },
          onError: (error) => {
            toast.error(error.error.message || error.error.statusText);
          },
        },
      );
    },
    validators: {
      onSubmit: z.object({
        email: z.email("Invalid email address"),
        password: z.string().min(8, "Password must be at least 8 characters"),
      }),
    },
  });

  if (isPending) {
    return <Loader />;
  }

  return (
    <div className="mx-auto w-full max-w-md py-8">
      <div className="mb-6 flex flex-col items-center text-center">
        <span className="mb-3 flex size-10 items-center justify-center rounded-xl bg-primary text-primary-foreground shadow-md">
          <Sparkles className="size-5" />
        </span>
        <h1 className="font-serif text-3xl font-bold tracking-tight">Welcome back</h1>
        <p className="mt-1 text-sm text-muted-foreground">Sign in to your constellations</p>
      </div>

      <Card className="rounded-[1.25rem] border-border/60 shadow-xl">
        <CardContent className="p-6 sm:p-7">
          <form
            onSubmit={(e) => {
              e.preventDefault();
              e.stopPropagation();
              form.handleSubmit();
            }}
            className="space-y-4"
          >
            <form.Field name="email">
              {(field) => (
                <div className="space-y-2">
                  <Label htmlFor={field.name} className="text-xs font-semibold tracking-wide">
                    Email
                  </Label>
                  <Input
                    id={field.name}
                    name={field.name}
                    type="email"
                    placeholder="you@example.com"
                    className="h-11 rounded-xl bg-background"
                    value={field.state.value}
                    onBlur={field.handleBlur}
                    onChange={(e) => field.handleChange(e.target.value)}
                  />
                  {field.state.meta.errors.map((error) => (
                    <p key={error?.message} className="text-xs text-destructive">
                      {error?.message}
                    </p>
                  ))}
                </div>
              )}
            </form.Field>

            <form.Field name="password">
              {(field) => (
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Label htmlFor={field.name} className="text-xs font-semibold tracking-wide">
                      Password
                    </Label>
                    <span className="text-xs text-muted-foreground">Min 8 characters</span>
                  </div>
                  <Input
                    id={field.name}
                    name={field.name}
                    type="password"
                    placeholder="••••••••"
                    className="h-11 rounded-xl bg-background"
                    value={field.state.value}
                    onBlur={field.handleBlur}
                    onChange={(e) => field.handleChange(e.target.value)}
                  />
                  {field.state.meta.errors.map((error) => (
                    <p key={error?.message} className="text-xs text-destructive">
                      {error?.message}
                    </p>
                  ))}
                </div>
              )}
            </form.Field>

            <form.Subscribe selector={(state) => state.canSubmit}>
              {(canSubmit) => (
                <Button
                  type="submit"
                  className="h-11 w-full gap-2 rounded-full text-sm font-semibold shadow-md"
                  disabled={!canSubmit}
                >
                  Sign in <ArrowRight className="size-4" />
                </Button>
              )}
            </form.Subscribe>
          </form>

          <div className="mt-6 flex items-center gap-3 text-xs text-muted-foreground">
            <span className="h-px flex-1 bg-border" />
            demo accounts inside
            <span className="h-px flex-1 bg-border" />
          </div>
          <div className="mt-3 grid grid-cols-2 gap-2 rounded-xl bg-muted p-2.5 font-mono text-[11px]">
            <span className="truncate">demo-nav@zentryx.dev</span>
            <span className="truncate text-right font-semibold">zentryx-demo-1</span>
          </div>

          <div className="mt-6 text-center">
            <button
              type="button"
              onClick={onSwitchToSignUp}
              className="text-sm font-medium text-foreground underline decoration-border underline-offset-4 hover:decoration-foreground"
            >
              Need an account? Create one
            </button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
