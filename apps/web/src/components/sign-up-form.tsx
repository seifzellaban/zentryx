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

export default function SignUpForm({ onSwitchToSignIn }: { onSwitchToSignIn: () => void }) {
  const router = useRouter();
  const { isPending } = authClient.useSession();

  const form = useForm({
    defaultValues: {
      email: "",
      password: "",
      name: "",
    },
    onSubmit: async ({ value }) => {
      await authClient.signUp.email(
        {
          email: value.email,
          password: value.password,
          name: value.name,
        },
        {
          onSuccess: () => {
            router.push("/dashboard");
            toast.success("Account created — welcome");
          },
          onError: (error) => {
            toast.error(error.error.message || error.error.statusText);
          },
        },
      );
    },
    validators: {
      onSubmit: z.object({
        name: z.string().min(2, "Name must be at least 2 characters"),
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
        <span className="mb-3 flex size-10 items-center justify-center rounded-xl bg-accent text-accent-foreground shadow-md">
          <Sparkles className="size-5" />
        </span>
        <h1 className="font-serif text-3xl font-bold tracking-tight">Create account</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Start your first constellation in seconds
        </p>
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
            <form.Field name="name">
              {(field) => (
                <div className="space-y-2">
                  <Label htmlFor={field.name} className="text-xs font-semibold tracking-wide">
                    Display name
                  </Label>
                  <Input
                    id={field.name}
                    name={field.name}
                    placeholder="Mason"
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
                  <Label htmlFor={field.name} className="text-xs font-semibold tracking-wide">
                    Password
                  </Label>
                  <Input
                    id={field.name}
                    name={field.name}
                    type="password"
                    placeholder="At least 8 characters"
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

            <form.Subscribe
              selector={(state) => ({
                canSubmit: state.canSubmit,
                isSubmitting: state.isSubmitting,
              })}
            >
              {({ canSubmit, isSubmitting }) => (
                <Button
                  type="submit"
                  className="h-11 w-full gap-2 rounded-full bg-primary text-primary-foreground shadow-md"
                  disabled={!canSubmit || isSubmitting}
                >
                  {isSubmitting ? "Creating…" : "Create account"} <ArrowRight className="size-4" />
                </Button>
              )}
            </form.Subscribe>
          </form>

          <p className="mt-4 text-center text-xs leading-relaxed text-muted-foreground">
            By creating an account you agree to the M1 localhost terms. No email verification
            required yet.
          </p>

          <div className="mt-6 text-center">
            <button
              type="button"
              onClick={onSwitchToSignIn}
              className="text-sm font-medium text-foreground underline decoration-border underline-offset-4 hover:decoration-foreground"
            >
              Already have an account? Sign in
            </button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
