"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

function toLocalInputValue(iso: string | null, fallbackDaysAgo?: number): string {
  const date = iso
    ? new Date(iso)
    : new Date(Date.now() - (fallbackDaysAgo ?? 0) * 24 * 3600 * 1000);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

export function ManagementFilters() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const from = searchParams.get("from");
  const to = searchParams.get("to");

  return (
    <form
      className="flex w-full flex-col gap-3 md:flex-row md:items-end"
      onSubmit={(event) => {
        event.preventDefault();
        const form = new FormData(event.currentTarget);
        const nextFrom = String(form.get("from") ?? "");
        const nextTo = String(form.get("to") ?? "");
        const params = new URLSearchParams();
        if (nextFrom) params.set("from", new Date(nextFrom).toISOString());
        if (nextTo) params.set("to", new Date(nextTo).toISOString());
        const query = params.toString();
        router.push(
          query ? `/dashboard/management?${query}` : "/dashboard/management"
        );
      }}
    >
      <div className="space-y-2">
        <label htmlFor="from" className="text-sm font-medium">
          From
        </label>
        <Input
          id="from"
          name="from"
          type="datetime-local"
          defaultValue={toLocalInputValue(from, 30)}
        />
      </div>
      <div className="space-y-2">
        <label htmlFor="to" className="text-sm font-medium">
          To
        </label>
        <Input
          id="to"
          name="to"
          type="datetime-local"
          defaultValue={toLocalInputValue(to, 0)}
        />
      </div>
      <Button type="submit">Apply range</Button>
      <Button asChild type="button" variant="outline">
        <a
          href={`/api/v1/management/dashboard/export?${new URLSearchParams({
            ...(from ? { from } : {}),
            ...(to ? { to } : {}),
          }).toString()}`}
        >
          Export CSV
        </a>
      </Button>
    </form>
  );
}
