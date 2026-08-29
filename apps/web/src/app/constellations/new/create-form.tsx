"use client";

import { useForm } from "@tanstack/react-form";
import { useMutation } from "@tanstack/react-query";
import { Button } from "@zentryx/ui/components/button";
import { Card, CardContent } from "@zentryx/ui/components/card";
import { Input } from "@zentryx/ui/components/input";
import { Label } from "@zentryx/ui/components/label";
import { Textarea } from "@zentryx/ui/components/textarea";
import { ArrowRight, Hash, Layers, Sparkles, Type } from "lucide-react";
import { useRouter } from "next/navigation";
import type { Route } from "next";
import { useState } from "react";
import { toast } from "sonner";
import z from "zod";

import { trpc } from "@/utils/trpc";

const categories = [
  { value: "coding", label: "Coding" },
  { value: "design", label: "Design" },
  { value: "trading", label: "Trading" },
  { value: "languages", label: "Languages" },
  { value: "fitness", label: "Fitness" },
  { value: "other", label: "Other" },
];

function slugify(value: string) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

const selectClasses =
  "h-11 w-full rounded-xl border border-input bg-background px-3 py-2 text-sm transition-colors outline-none focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/20";

export default function CreateForm() {
  const router = useRouter();
  const [slugEdited, setSlugEdited] = useState(false);

  const createConstellation = useMutation(
    trpc.constellation.create.mutationOptions({
      onSuccess: (data) => {
        toast.success("Constellation created");
        router.push(`/c/${data.slug}` as Route);
      },
      onError: (error) => {
        if (error.data?.code === "CONFLICT") {
          toast.error("That slug is already taken");
          return;
        }
        toast.error(error.message || "Failed to create constellation");
      },
    }),
  );

  const form = useForm({
    defaultValues: {
      name: "",
      slug: "",
      description: "",
      category: "other",
    },
    validators: {
      onSubmit: z.object({
        name: z.string().min(3, "Name must be at least 3 characters").max(80),
        slug: z
          .string()
          .min(3, "Slug must be at least 3 characters")
          .max(63)
          .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "Use lowercase letters, numbers, and hyphens"),
        description: z.string().max(1000),
        category: z.string(),
      }),
    },
    onSubmit: ({ value }) => {
      createConstellation.mutate(value);
    },
  });

  return (
    <Card className="overflow-hidden rounded-[1.5rem] border-border/60 shadow-xl">
      <div className="h-1.5 w-full bg-gradient-to-r from-primary via-accent to-primary" />
      <CardContent className="p-6 sm:p-7">
        <div className="mb-6 flex items-center gap-3">
          <span className="flex size-9 items-center justify-center rounded-xl bg-primary text-primary-foreground">
            <Sparkles className="size-4" />
          </span>
          <div>
            <p className="text-sm font-semibold leading-none">New constellation</p>
            <p className="text-xs text-muted-foreground">Draft until you publish</p>
          </div>
          <span className="ml-auto hidden rounded-full bg-muted px-2.5 py-1 text-xs font-medium sm:inline-flex">
            M1 • 3 steps
          </span>
        </div>

        <form
          onSubmit={(e) => {
            e.preventDefault();
            e.stopPropagation();
            form.handleSubmit();
          }}
          className="space-y-5"
        >
          <form.Field name="name">
            {(field) => (
              <div className="space-y-2">
                <Label
                  htmlFor={field.name}
                  className="flex items-center gap-1.5 text-xs font-semibold tracking-wide"
                >
                  <Type className="size-3.5" /> Name
                </Label>
                <Input
                  id={field.name}
                  name={field.name}
                  required
                  placeholder="Trading Fundamentals"
                  className="h-11 rounded-xl"
                  value={field.state.value}
                  onBlur={field.handleBlur}
                  onChange={(e) => {
                    field.handleChange(e.target.value);
                    if (!slugEdited) {
                      form.setFieldValue("slug", slugify(e.target.value));
                    }
                  }}
                />
                {field.state.meta.errors.map((error) => (
                  <p key={error?.message} className="text-xs text-destructive">
                    {error?.message}
                  </p>
                ))}
              </div>
            )}
          </form.Field>

          <form.Field name="slug">
            {(field) => (
              <div className="space-y-2">
                <Label
                  htmlFor={field.name}
                  className="flex items-center gap-1.5 text-xs font-semibold tracking-wide"
                >
                  <Hash className="size-3.5" /> Slug
                </Label>
                <div className="relative">
                  <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 font-mono text-xs text-muted-foreground">
                    /c/
                  </span>
                  <Input
                    id={field.name}
                    name={field.name}
                    required
                    placeholder="trading-fundamentals"
                    className="h-11 rounded-xl pl-9 font-mono text-sm"
                    value={field.state.value}
                    onBlur={field.handleBlur}
                    onChange={(e) => {
                      setSlugEdited(true);
                      field.handleChange(e.target.value);
                    }}
                  />
                </div>
                {field.state.meta.errors.map((error) => (
                  <p key={error?.message} className="text-xs text-destructive">
                    {error?.message}
                  </p>
                ))}
                <p className="text-xs text-muted-foreground">
                  Lowercase, numbers, hyphens. Unique before publish.
                </p>
              </div>
            )}
          </form.Field>

          <form.Field name="description">
            {(field) => (
              <div className="space-y-2">
                <Label htmlFor={field.name} className="text-xs font-semibold tracking-wide">
                  Description
                </Label>
                <Textarea
                  id={field.name}
                  name={field.name}
                  maxLength={1000}
                  placeholder="What is this community about? What will members learn together?"
                  className="min-h-[96px] rounded-xl"
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

          <form.Field name="category">
            {(field) => (
              <div className="space-y-2">
                <Label
                  htmlFor={field.name}
                  className="flex items-center gap-1.5 text-xs font-semibold tracking-wide"
                >
                  <Layers className="size-3.5" /> Category
                </Label>
                <select
                  id={field.name}
                  name={field.name}
                  className={selectClasses}
                  value={field.state.value}
                  onBlur={field.handleBlur}
                  onChange={(e) => field.handleChange(e.target.value)}
                >
                  {categories.map((category) => (
                    <option key={category.value} value={category.value}>
                      {category.label}
                    </option>
                  ))}
                </select>
              </div>
            )}
          </form.Field>

          <form.Subscribe selector={(state) => state.canSubmit}>
            {(canSubmit) => (
              <Button
                type="submit"
                className="h-11 w-full gap-2 rounded-full text-sm font-semibold shadow-md"
                disabled={!canSubmit || createConstellation.isPending}
              >
                {createConstellation.isPending ? "Creating…" : "Create constellation"}{" "}
                <ArrowRight className="size-4" />
              </Button>
            )}
          </form.Subscribe>

          <p className="text-center text-xs text-muted-foreground">
            Starts as <span className="font-medium text-foreground">draft</span> — only you can see
            it until you publish from the overview tab.
          </p>
        </form>
      </CardContent>
    </Card>
  );
}
