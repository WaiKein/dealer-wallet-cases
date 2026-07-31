"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

/** List-first create/edit disclosure used by admin maintenance pages. */
export function AdminEditorPanel({
  title,
  triggerLabel = "New item",
  defaultOpen = false,
  children,
  className,
}: {
  title: string;
  triggerLabel?: string;
  defaultOpen?: boolean;
  children: React.ReactNode;
  className?: string;
}) {
  const [open, setOpen] = useState(defaultOpen);

  return (
    <div className={cn("space-y-3", className)}>
      <div className="flex items-center justify-end">
        <Button type="button" onClick={() => setOpen((value) => !value)}>
          {open ? "Close editor" : triggerLabel}
        </Button>
      </div>
      {open ? (
        <div className="ops-panel p-4">
          <h2 className="mb-3 text-sm font-semibold">{title}</h2>
          {children}
        </div>
      ) : null}
    </div>
  );
}
