"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { STATUS_LABELS } from "@/lib/auth/roles";
import type { CaseStatus } from "@/types";

const ALL_STATUSES: CaseStatus[] = [
  "SUBMITTED",
  "UNDER_REVIEW",
  "WAITING_FOR_REQUESTER",
  "WAITING_FOR_EXTERNAL_PARTY",
  "PENDING_APPROVAL",
  "APPROVED",
  "REJECTED",
  "RESOLVED",
];

export function CaseFilters() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const currentStatus = searchParams.get("status") ?? "all";
  const currentSearch = searchParams.get("search") ?? "";

  function updateFilters(status: string, search: string) {
    const nextStatus = status || "all";
    const nextSearch = search.trim();
    // Avoid remount loops: Radix Select can fire onValueChange on mount.
    if (nextStatus === currentStatus && nextSearch === currentSearch) {
      return;
    }

    const params = new URLSearchParams();
    if (nextStatus !== "all") {
      params.set("status", nextStatus);
    }
    if (nextSearch) {
      params.set("search", nextSearch);
    }
    const query = params.toString();
    router.push(query ? `/cases?${query}` : "/cases");
  }

  return (
    <form
      className="flex flex-col gap-3 rounded-lg border bg-card p-4 md:flex-row md:items-end"
      onSubmit={(event) => {
        event.preventDefault();
        const formData = new FormData(event.currentTarget);
        updateFilters(
          String(formData.get("status") ?? "all"),
          String(formData.get("search") ?? "")
        );
      }}
    >
      <div className="flex-1 space-y-2">
        <label htmlFor="search" className="text-sm font-medium">
          Search
        </label>
        <Input
          id="search"
          name="search"
          defaultValue={currentSearch}
          placeholder="Case number, title, account, reference"
        />
      </div>

      <div className="w-full space-y-2 md:w-56">
        <label htmlFor="status" className="text-sm font-medium">
          Status
        </label>
        <Select name="status" defaultValue={currentStatus}>
          <SelectTrigger id="status">
            <SelectValue placeholder="All statuses" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All statuses</SelectItem>
            {ALL_STATUSES.map((status) => (
              <SelectItem key={status} value={status}>
                {STATUS_LABELS[status]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <Button type="submit">Apply filters</Button>
    </form>
  );
}
