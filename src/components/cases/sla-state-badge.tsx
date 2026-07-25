import { Badge } from "@/components/ui/badge";
import type { SlaState } from "@/types";

const STATE_VARIANT: Record<
  SlaState,
  "default" | "secondary" | "destructive" | "outline"
> = {
  RUNNING: "secondary",
  DUE_SOON: "default",
  BREACHED: "destructive",
  PAUSED: "outline",
  COMPLETED: "outline",
};

export function SlaStateBadge({ state }: { state: SlaState }) {
  return (
    <Badge variant={STATE_VARIANT[state]} className="text-[10px]">
      {state.replace("_", " ")}
    </Badge>
  );
}
