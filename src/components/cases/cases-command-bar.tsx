"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useMemo, useState, useTransition } from "react";
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
import type { SavedCaseView } from "@/lib/cases/saved-views-access";
import type { CaseStatus } from "@/types";
import { cn } from "@/lib/utils";
import Link from "next/link";

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

export function CasesCommandBar({ views }: { views: SavedCaseView[] }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [pending, startTransition] = useTransition();
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [saveName, setSaveName] = useState("");
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const currentViewId = searchParams.get("viewId") ?? "";
  const currentStatus = searchParams.get("status") ?? "all";
  const currentSearch = searchParams.get("search") ?? "";
  const appliedFilterCount =
    (currentStatus !== "all" ? 1 : 0) + (currentSearch ? 1 : 0);

  const grouped = useMemo(() => {
    const system = views.filter((v) => v.sharing_scope === "system");
    const personal = views.filter((v) => v.sharing_scope === "personal");
    const shared = views.filter(
      (v) => v.sharing_scope === "team" || v.sharing_scope === "organization"
    );
    return { system, personal, shared };
  }, [views]);

  function pushParams(next: {
    status?: string;
    search?: string;
    viewId?: string | null;
  }) {
    const params = new URLSearchParams();
    const viewId =
      next.viewId === null
        ? ""
        : next.viewId !== undefined
          ? next.viewId
          : currentViewId;
    const status = next.status ?? currentStatus;
    const search = next.search !== undefined ? next.search : currentSearch;
    if (viewId) params.set("viewId", viewId);
    if (status && status !== "all") params.set("status", status);
    if (search.trim()) params.set("search", search.trim());
    const query = params.toString();
    startTransition(() => {
      router.push(query ? `/cases?${query}` : "/cases");
    });
  }

  async function saveCurrentAsPersonal() {
    const name = saveName.trim();
    if (name.length < 2) {
      setSaveError("Name must be at least 2 characters.");
      return;
    }
    setSaving(true);
    setSaveError(null);
    try {
      const filters: Record<string, unknown> = {};
      if (currentStatus !== "all") filters.statuses = [currentStatus];
      if (currentSearch) filters.search = currentSearch;
      const response = await fetch("/api/v1/saved-views", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          name,
          sharingScope: "personal",
          filters,
          sorting: { field: "updated_at", direction: "desc" },
        }),
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok || payload.success === false) {
        setSaveError(
          payload?.error?.message ?? payload?.error ?? "Failed to save view."
        );
        return;
      }
      const viewId = payload?.data?.view?.id as string | undefined;
      setSaveName("");
      if (viewId) pushParams({ viewId, status: "all", search: "" });
      else router.refresh();
    } catch {
      setSaveError("Failed to save view.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-3">
      <form
        className="ops-panel flex flex-col gap-2 p-3 sm:flex-row sm:items-center"
        onSubmit={(event) => {
          event.preventDefault();
          const form = new FormData(event.currentTarget);
          pushParams({
            search: String(form.get("search") ?? ""),
            viewId: null,
          });
        }}
      >
        <Input
          name="search"
          defaultValue={currentSearch}
          placeholder="Search case, dealer, account…"
          className="h-9 flex-1"
          disabled={pending}
        />
        <Select
          value={currentViewId || "none"}
          onValueChange={(value) => {
            if (value === "none") pushParams({ viewId: null });
            else pushParams({ viewId: value, status: "all", search: "" });
          }}
          disabled={pending}
        >
          <SelectTrigger className="h-9 w-full sm:w-48">
            <SelectValue placeholder="Saved view" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="none">All matching cases</SelectItem>
            {grouped.system.map((view) => (
              <SelectItem key={view.id} value={view.id}>
                {view.name}
              </SelectItem>
            ))}
            {grouped.shared.map((view) => (
              <SelectItem key={view.id} value={view.id}>
                Shared · {view.name}
              </SelectItem>
            ))}
            {grouped.personal.map((view) => (
              <SelectItem key={view.id} value={view.id}>
                Mine · {view.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Button
          type="button"
          variant="outline"
          className="h-9"
          onClick={() => setFiltersOpen((v) => !v)}
        >
          Filters{appliedFilterCount ? ` ${appliedFilterCount}` : ""}
        </Button>
        <Button type="submit" className="h-9" disabled={pending}>
          Search
        </Button>
      </form>

      <div className="flex flex-wrap gap-2">
        <QuickPill href="/cases" label="Open" active={!currentStatus || currentStatus === "all"} />
        <QuickPill
          href="/cases?status=PENDING_APPROVAL"
          label="Pending approval"
          active={currentStatus === "PENDING_APPROVAL"}
        />
        <QuickPill
          href="/workspace?queue=breached"
          label="SLA at risk"
          active={false}
          tone="warning"
        />
        <button
          type="button"
          className="rounded-full border border-dashed px-3 py-1 text-xs font-medium text-muted-foreground hover:bg-muted"
          onClick={() => setFiltersOpen(true)}
        >
          + Save view
        </button>
      </div>

      {filtersOpen ? (
        <div className="ops-panel space-y-3 p-3">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
            <div className="w-full space-y-1 sm:w-56">
              <label className="text-xs font-medium" htmlFor="status-filter">
                Status
              </label>
              <Select
                value={currentStatus}
                onValueChange={(value) =>
                  pushParams({ status: value, viewId: null })
                }
              >
                <SelectTrigger id="status-filter" className="h-9">
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
            <div className="flex-1 space-y-1">
              <label className="text-xs font-medium" htmlFor="save-view-name">
                Save current filters
              </label>
              <Input
                id="save-view-name"
                value={saveName}
                onChange={(e) => setSaveName(e.target.value)}
                placeholder="e.g. My open queue"
                className="h-9"
              />
            </div>
            <Button
              type="button"
              variant="secondary"
              className="h-9"
              disabled={saving}
              onClick={() => void saveCurrentAsPersonal()}
            >
              {saving ? "Saving…" : "Save personal view"}
            </Button>
          </div>
          {saveError ? (
            <p className="text-sm text-destructive">{saveError}</p>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

function QuickPill({
  href,
  label,
  active,
  tone,
}: {
  href: string;
  label: string;
  active: boolean;
  tone?: "warning";
}) {
  return (
    <Link
      href={href}
      className={cn(
        "rounded-full border px-3 py-1 text-xs font-medium",
        active
          ? "border-primary bg-accent text-accent-foreground"
          : tone === "warning"
            ? "border-amber-300 text-amber-800"
            : "text-muted-foreground hover:bg-muted"
      )}
    >
      {label}
    </Link>
  );
}
