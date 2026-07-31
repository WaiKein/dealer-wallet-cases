"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  acknowledgeCaseAction,
  claimCaseAction,
} from "@/lib/cases/collaboration";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";

interface CaseActionButtonsProps {
  caseId: string;
  canClaim: boolean;
  canAcknowledge: boolean;
}

export function CaseActionButtons({
  caseId,
  canClaim,
  canAcknowledge,
}: CaseActionButtonsProps) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  if (!canClaim && !canAcknowledge) {
    return null;
  }

  function run(action: "claim" | "acknowledge") {
    setError(null);
    startTransition(async () => {
      const result =
        action === "claim"
          ? await claimCaseAction({ caseId })
          : await acknowledgeCaseAction({ caseId });
      if (result.error) {
        setError(result.error);
        return;
      }
      router.refresh();
    });
  }

  return (
    <div className="space-y-3">
      {error && (
        <Alert className="border-destructive/50 bg-destructive/10">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}
      <div className="flex flex-wrap gap-2">
        {canClaim && (
          <Button type="button" disabled={isPending} onClick={() => run("claim")}>
            Claim case
          </Button>
        )}
        {canAcknowledge && (
          <Button
            type="button"
            variant="outline"
            disabled={isPending}
            onClick={() => run("acknowledge")}
          >
            Acknowledge
          </Button>
        )}
      </div>
    </div>
  );
}
