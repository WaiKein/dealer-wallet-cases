"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

export function ActiveBadge({ active }: { active?: boolean }) {
  return (
    <Badge variant={active === false ? "outline" : "success"}>
      {active === false ? "Inactive" : "Active"}
    </Badge>
  );
}

export function AdminFilterBar({
  q,
  active,
}: {
  q?: string;
  active?: string;
}) {
  return (
    <form className="flex flex-wrap items-end gap-3" method="get">
      <div className="space-y-1">
        <Label htmlFor="q">Search</Label>
        <Input id="q" name="q" defaultValue={q ?? ""} placeholder="Search…" />
      </div>
      <div className="space-y-1">
        <Label htmlFor="active">Status</Label>
        <select
          id="active"
          name="active"
          defaultValue={active ?? "all"}
          className="flex h-10 rounded-md border border-input bg-background px-3 text-sm"
        >
          <option value="all">All</option>
          <option value="active">Active</option>
          <option value="inactive">Inactive</option>
        </select>
      </div>
      <Button type="submit" variant="outline">
        Apply
      </Button>
    </form>
  );
}

export function ChangeReasonField({
  value,
  onChange,
  disabled,
}: {
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
}) {
  return (
    <div className="space-y-2">
      <Label htmlFor="change_reason">Change reason</Label>
      <Textarea
        id="change_reason"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        disabled={disabled}
        placeholder="Required audit reason for this configuration change"
      />
    </div>
  );
}

type Field =
  | {
      name: string;
      label: string;
      type?: "text" | "number" | "checkbox" | "textarea" | "select";
      options?: { value: string; label: string }[];
      required?: boolean;
    };

export function AdminUpsertForm({
  title,
  fields,
  initial,
  action,
  submitLabel = "Save",
}: {
  title: string;
  fields: Field[];
  initial?: Record<string, unknown>;
  action: (
    values: Record<string, unknown>
  ) => Promise<{ success: boolean; error?: string }>;
  submitLabel?: string;
}) {
  const router = useRouter();
  const [values, setValues] = useState<Record<string, unknown>>(() => {
    const seed: Record<string, unknown> = { change_reason: "" };
    for (const field of fields) {
      seed[field.name] =
        initial?.[field.name] ??
        (field.type === "checkbox" ? true : field.type === "number" ? "" : "");
    }
    if (initial?.id) seed.id = initial.id;
    return seed;
  });
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const confirmNeeded = useMemo(
    () => Boolean(initial?.id) && values.is_active === false,
    [initial?.id, values.is_active]
  );

  function setField(name: string, value: unknown) {
    setValues((prev) => ({ ...prev, [name]: value }));
  }

  function handleSubmit() {
    if (confirmNeeded) {
      const ok = window.confirm(
        "Deactivate this configuration? Existing cases keep their captured versions; new work will stop using it."
      );
      if (!ok) return;
    }

    startTransition(async () => {
      setError(null);
      const result = await action(values);
      if (!result.success) {
        setError(result.error ?? "Save failed.");
        return;
      }
      router.refresh();
    });
  }

  return (
    <div className="space-y-4 rounded-lg border bg-card p-4">
      <h3 className="font-medium">{title}</h3>
      {error && (
        <Alert className="border-destructive/50 bg-destructive/10">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}
      <div className="grid gap-3 sm:grid-cols-2">
        {fields.map((field) => (
          <div
            key={field.name}
            className={field.type === "textarea" ? "sm:col-span-2 space-y-2" : "space-y-2"}
          >
            <Label htmlFor={field.name}>{field.label}</Label>
            {field.type === "textarea" ? (
              <Textarea
                id={field.name}
                value={String(values[field.name] ?? "")}
                disabled={pending}
                onChange={(event) => setField(field.name, event.target.value)}
              />
            ) : field.type === "checkbox" ? (
              <div className="flex h-10 items-center gap-2">
                <input
                  id={field.name}
                  type="checkbox"
                  checked={Boolean(values[field.name])}
                  disabled={pending}
                  onChange={(event) => setField(field.name, event.target.checked)}
                />
                <span className="text-sm text-muted-foreground">Enabled / active</span>
              </div>
            ) : field.type === "select" ? (
              <select
                id={field.name}
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                value={String(values[field.name] ?? "")}
                disabled={pending}
                onChange={(event) => setField(field.name, event.target.value)}
              >
                <option value="">—</option>
                {(field.options ?? []).map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            ) : (
              <Input
                id={field.name}
                type={field.type === "number" ? "number" : "text"}
                value={String(values[field.name] ?? "")}
                disabled={pending}
                onChange={(event) =>
                  setField(
                    field.name,
                    field.type === "number"
                      ? event.target.value === ""
                        ? ""
                        : Number(event.target.value)
                      : event.target.value
                  )
                }
              />
            )}
          </div>
        ))}
      </div>
      <ChangeReasonField
        value={String(values.change_reason ?? "")}
        onChange={(value) => setField("change_reason", value)}
        disabled={pending}
      />
      <Button type="button" disabled={pending} onClick={handleSubmit}>
        {pending ? "Saving…" : submitLabel}
      </Button>
    </div>
  );
}

export function ConfigHistoryPanel({
  entries,
}: {
  entries: {
    id: string;
    created_at: string;
    change_reason: string | null;
    actor_id: string;
    correlation_id: string | null;
  }[];
}) {
  if (entries.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">No configuration history yet.</p>
    );
  }
  return (
    <div className="space-y-2">
      <h3 className="font-medium">Configuration history</h3>
      <ul className="space-y-2 text-sm">
        {entries.map((entry) => (
          <li key={entry.id} className="rounded-md border p-3">
            <p className="font-medium">{entry.change_reason ?? "Updated"}</p>
            <p className="text-muted-foreground">
              {new Date(entry.created_at).toLocaleString()} · actor {entry.actor_id.slice(0, 8)}
              {entry.correlation_id ? ` · corr ${entry.correlation_id.slice(0, 8)}` : ""}
            </p>
          </li>
        ))}
      </ul>
    </div>
  );
}

export function EmptyState({ message }: { message: string }) {
  return <p className="text-sm text-muted-foreground">{message}</p>;
}
