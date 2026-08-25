"use client";

import { useForm } from "@tanstack/react-form";
import { useMutation } from "@tanstack/react-query";
import { Button } from "@zentryx/ui/components/button";
import { Card, CardContent } from "@zentryx/ui/components/card";
import { Input } from "@zentryx/ui/components/input";
import { Label } from "@zentryx/ui/components/label";
import { Textarea } from "@zentryx/ui/components/textarea";
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
  "h-8 w-full rounded-none border border-input bg-transparent px-2.5 py-1 text-xs transition-colors outline-none focus-visible:border-ring focus-visible:ring-1 focus-visible:ring-ring/50 disabled:cursor-not-allowed disabled:opacity-50 dark:bg-input/30";

export default function CreateForm() {
  const router = useRouter();
  const [slugEdited, setSlugEdited] = useState(false);

  const createConstellation = useMutation(
    trpc.constellation.create.mutationOptions({
      onSuccess: (data) => {
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
        name: z
          .string()
          .min(3, "Name must be at least 3 characters")
          .max(80, "Name must be at most 80 characters"),
        slug: z
          .string()
          .min(3, "Slug must be at least 3 characters")
          .max(63, "Slug must be at most 63 characters")
          .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "Use lowercase letters, numbers, and hyphens"),
        description: z.string().max(1000, "Description must be at most 1000 characters"),
        category: z.string(),
      }),
    },
    onSubmit: ({ value }) => {
      createConstellation.mutate(value);
    },
  });

  return (
    <Card>
      <CardContent>
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
                <Label htmlFor={field.name}>Name</Label>
                <Input
                  id={field.name}
                  name={field.name}
                  required
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
                  <p key={error?.message} className="text-red-500">
                    {error?.message}
                  </p>
                ))}
              </div>
            )}
          </form.Field>

          <form.Field name="slug">
            {(field) => (
              <div className="space-y-2">
                <Label htmlFor={field.name}>Slug</Label>
                <Input
                  id={field.name}
                  name={field.name}
                  required
                  value={field.state.value}
                  onBlur={field.handleBlur}
                  onChange={(e) => {
                    setSlugEdited(true);
                    field.handleChange(e.target.value);
                  }}
                />
                {field.state.meta.errors.map((error) => (
                  <p key={error?.message} className="text-red-500">
                    {error?.message}
                  </p>
                ))}
              </div>
            )}
          </form.Field>

          <form.Field name="description">
            {(field) => (
              <div className="space-y-2">
                <Label htmlFor={field.name}>Description</Label>
                <Textarea
                  id={field.name}
                  name={field.name}
                  maxLength={1000}
                  value={field.state.value}
                  onBlur={field.handleBlur}
                  onChange={(e) => field.handleChange(e.target.value)}
                />
                {field.state.meta.errors.map((error) => (
                  <p key={error?.message} className="text-red-500">
                    {error?.message}
                  </p>
                ))}
              </div>
            )}
          </form.Field>

          <form.Field name="category">
            {(field) => (
              <div className="space-y-2">
                <Label htmlFor={field.name}>Category</Label>
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
                {field.state.meta.errors.map((error) => (
                  <p key={error?.message} className="text-red-500">
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
                className="w-full"
                disabled={!canSubmit || createConstellation.isPending}
              >
                {createConstellation.isPending ? "Creating..." : "Create"}
              </Button>
            )}
          </form.Subscribe>
        </form>
      </CardContent>
    </Card>
  );
}
