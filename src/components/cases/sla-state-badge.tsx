import { Badge } from "@/components/ui/badge";
import type { SlaState } from "@/types";

const STATE_VARIANT: Record<
  SlaState,
  "default" | "secondary" | "destructive" | "outline" | "warning" | "success"
> = {
  RUNNING: "secondary",
  DUE_SOON: "warning",
  BREACHED: "destructive",
  PAUSED: "outline",
  COMPLETED: "success",
};

const STATE_LABEL: Record<SlaState, string> = {
  RUNNING: "Active",
  DUE_SOON: "At risk",
  BREACHED: "Breached",
  PAUSED: "Paused",
  COMPLETED: "Met",
};

export function SlaStateBadge({ state }: { state: SlaState }) {
  return (
    <Badge variant={STATE_VARIANT[state]} className="text-[10px]">
      {STATE_LABEL[state]}
    </Badge>
  );
}
