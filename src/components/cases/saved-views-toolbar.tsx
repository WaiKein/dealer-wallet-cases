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
import type { SavedCaseView } from "@/lib/cases/saved-views-access";

interface SavedViewsToolbarProps {
  views: SavedCaseView[];
}

export function SavedViewsToolbar({ views }: SavedViewsToolbarProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [pending, startTransition] = useTransition();
  const [saveName, setSaveName] = useState("");
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const currentViewId = searchParams.get("viewId") ?? "";
  const currentStatus = searchParams.get("status") ?? "";
  const currentSearch = searchParams.get("search") ?? "";

  const grouped = useMemo(() => {
    const system = views.filter((v) => v.sharing_scope === "system");
    const personal = views.filter((v) => v.sharing_scope === "personal");
    const shared = views.filter(
      (v) => v.sharing_scope === "team" || v.sharing_scope === "organization"
    );
    return { system, personal, shared };
  }, [views]);

  function applyView(viewId: string) {
    const params = new URLSearchParams();
    if (viewId && viewId !== "none") {
      params.set("viewId", viewId);
    }
    // Clear ad-hoc filters when switching views so the saved definition wins.
    startTransition(() => {
      const query = params.toString();
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
      if (currentStatus) filters.statuses = [currentStatus];
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
      if (viewId) {
        applyView(viewId);
      } else {
        router.refresh();
      }
    } catch {
      setSaveError("Failed to save view.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-3 rounded-lg border bg-card p-4">
      <div className="flex flex-col gap-3 md:flex-row md:items-end">
        <div className="flex-1 space-y-2">
          <label htmlFor="saved-view" className="text-sm font-medium">
            Saved view
          </label>
          <Select
            value={currentViewId || "none"}
            onValueChange={applyView}
            disabled={pending}
          >
            <SelectTrigger id="saved-view">
              <SelectValue placeholder="No saved view" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="none">No saved view</SelectItem>
              {grouped.system.length > 0 && (
                <>
                  {grouped.system.map((view) => (
                    <SelectItem key={view.id} value={view.id}>
                      System · {view.name}
                    </SelectItem>
                  ))}
                </>
              )}
              {grouped.shared.length > 0 &&
                grouped.shared.map((view) => (
                  <SelectItem key={view.id} value={view.id}>
                    Shared · {view.name}
                  </SelectItem>
                ))}
              {grouped.personal.length > 0 &&
                grouped.personal.map((view) => (
                  <SelectItem key={view.id} value={view.id}>
                    Mine · {view.name}
                  </SelectItem>
                ))}
            </SelectContent>
          </Select>
        </div>

        <div className="flex flex-1 flex-col gap-2 sm:flex-row sm:items-end">
          <div className="flex-1 space-y-2">
            <label htmlFor="save-view-name" className="text-sm font-medium">
              Save current filters
            </label>
            <Input
              id="save-view-name"
              value={saveName}
              onChange={(event) => setSaveName(event.target.value)}
              placeholder="e.g. My medium priority queue"
            />
          </div>
          <Button
            type="button"
            variant="secondary"
            disabled={saving}
            onClick={() => void saveCurrentAsPersonal()}
          >
            {saving ? "Saving…" : "Save personal view"}
          </Button>
        </div>
      </div>
      {saveError ? (
        <p className="text-sm text-destructive">{saveError}</p>
      ) : (
        <p className="text-xs text-muted-foreground">
          System and shared views are read-only here. Personal views save the
          current status/search filters. Case permissions still apply.
        </p>
      )}
    </div>
  );
}
