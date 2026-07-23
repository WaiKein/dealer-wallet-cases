"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { transitionCaseStatus } from "@/lib/cases/actions";
import { getAvailableTransitions } from "@/lib/auth/permissions";
import { STATUS_LABELS } from "@/lib/auth/roles";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Alert, AlertDescription } from "@/components/ui/alert";
import type { CaseStatus, UserRole } from "@/types";

interface StatusActionButtonsProps {
  caseId: string;
  currentStatus: CaseStatus;
  role: UserRole;
}

export function StatusActionButtons({
  caseId,
  currentStatus,
  role,
}: StatusActionButtonsProps) {
  const router = useRouter();
  const transitions = getAvailableTransitions(currentStatus, role);
  const [selectedStatus, setSelectedStatus] = useState<CaseStatus | null>(null);
  const [comment, setComment] = useState("");
  const [rejectionReason, setRejectionReason] = useState("");
  const [resolutionNotes, setResolutionNotes] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  if (transitions.length === 0) {
    return null;
  }

  const selectedTransition = transitions.find(
    (transition) => transition.to === selectedStatus
  );

  function handleAction(nextStatus: CaseStatus) {
    setSelectedStatus(nextStatus);
    setError(null);
  }

  function handleSubmit() {
    if (!selectedStatus) {
      return;
    }

    startTransition(async () => {
      const result = await transitionCaseStatus({
        caseId,
        nextStatus: selectedStatus as Extract<
          CaseStatus,
          "UNDER_REVIEW" | "PENDING_APPROVAL" | "APPROVED" | "REJECTED" | "RESOLVED"
        >,
        comment: comment || undefined,
        rejection_reason: rejectionReason || undefined,
        resolution_notes: resolutionNotes || undefined,
      });

      if (result.error) {
        setError(result.error);
        return;
      }

      setSelectedStatus(null);
      setComment("");
      setRejectionReason("");
      setResolutionNotes("");
      router.refresh();
    });
  }

  return (
    <div className="space-y-4 rounded-lg border bg-card p-4">
      <div>
        <h3 className="font-medium">Workflow actions</h3>
        <p className="text-sm text-muted-foreground">
          Available transitions for your role at the current status.
        </p>
      </div>

      {error && (
        <Alert className="border-destructive/50 bg-destructive/10">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      <div className="flex flex-wrap gap-2">
        {transitions.map((transition) => (
          <Button
            key={transition.to}
            type="button"
            variant={selectedStatus === transition.to ? "default" : "outline"}
            disabled={isPending}
            onClick={() => handleAction(transition.to)}
          >
            Move to {STATUS_LABELS[transition.to]}
          </Button>
        ))}
      </div>

      {selectedStatus && (
        <div className="space-y-3 border-t pt-4">
          <p className="text-sm font-medium">
            Confirm transition to {STATUS_LABELS[selectedStatus]}
          </p>

          <div className="space-y-2">
            <Label htmlFor="comment">Comment</Label>
            <Textarea
              id="comment"
              value={comment}
              onChange={(event) => setComment(event.target.value)}
              placeholder="Optional context for the audit log"
              disabled={isPending}
            />
          </div>

          {selectedStatus === "REJECTED" && (
            <div className="space-y-2">
              <Label htmlFor="rejection_reason">Rejection reason</Label>
              <Textarea
                id="rejection_reason"
                value={rejectionReason}
                onChange={(event) => setRejectionReason(event.target.value)}
                disabled={isPending}
              />
            </div>
          )}

          {selectedStatus === "RESOLVED" && (
            <div className="space-y-2">
              <Label htmlFor="resolution_notes">Resolution notes</Label>
              <Textarea
                id="resolution_notes"
                value={resolutionNotes}
                onChange={(event) => setResolutionNotes(event.target.value)}
                disabled={isPending}
              />
            </div>
          )}

          {selectedTransition?.requiresComment && (
            <p className="text-xs text-muted-foreground">
              A comment is required when rejecting from this stage.
            </p>
          )}

          <div className="flex gap-2">
            <Button type="button" disabled={isPending} onClick={handleSubmit}>
              {isPending ? "Updating..." : "Confirm status change"}
            </Button>
            <Button
              type="button"
              variant="ghost"
              disabled={isPending}
              onClick={() => setSelectedStatus(null)}
            >
              Cancel
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
