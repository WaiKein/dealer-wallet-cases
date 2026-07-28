"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  inquireCaseExecutionAction,
  retryCaseExecutionAction,
} from "@/lib/executions/actions";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";

export function ExecutionPanel({
  caseId,
  execution,
  attempts,
  canManage,
}: {
  caseId: string;
  execution: {
    id: string;
    status: string;
    provider: string;
    attempt_count: number;
    response_code: string | null;
    sanitised_response_summary: string | null;
    failure_category: string | null;
    requires_status_inquiry: boolean;
    external_transaction_ref: string | null;
    version: number;
  } | null;
  attempts: {
    id: string;
    attempt_no: number;
    kind: string;
    outcome: string | null;
    response_code: string | null;
    sanitised_error: string | null;
  }[];
  canManage: boolean;
}) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  if (!execution) {
    return null;
  }

  const canRetry =
    canManage &&
    (execution.status === "FAILED_RETRYABLE" ||
      (execution.status === "UNKNOWN" && !execution.requires_status_inquiry));
  const canInquire =
    canManage &&
    (execution.status === "UNKNOWN" || execution.requires_status_inquiry);

  async function handleRetry() {
    if (!execution || pending) return;
    setPending(true);
    setError(null);
    const result = await retryCaseExecutionAction({
      caseId,
      expectedVersion: execution.version,
    });
    setPending(false);
    if (result.error) {
      setError(result.error);
      return;
    }
    router.refresh();
  }

  async function handleInquire() {
    if (!execution || pending) return;
    setPending(true);
    setError(null);
    const result = await inquireCaseExecutionAction({
      caseId,
      expectedVersion: execution.version,
    });
    setPending(false);
    if (result.error) {
      setError(result.error);
      return;
    }
    router.refresh();
  }

  return (
    <Card id="execution">
      <CardHeader>
        <CardTitle>Wallet execution</CardTitle>
        <CardDescription>
          {execution.provider} · attempts {execution.attempt_count} · v
          {execution.version}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="flex flex-wrap items-center gap-2">
          <Badge
            variant={
              execution.status === "SUCCEEDED" ? "default" : "outline"
            }
          >
            {execution.status}
          </Badge>
          {execution.response_code ? (
            <span className="text-sm text-muted-foreground">
              code {execution.response_code}
            </span>
          ) : null}
        </div>
        {execution.sanitised_response_summary ? (
          <p className="text-sm text-muted-foreground">
            {execution.sanitised_response_summary}
          </p>
        ) : null}
        {execution.external_transaction_ref ? (
          <p className="text-sm">
            External ref: {execution.external_transaction_ref}
          </p>
        ) : null}
        {execution.failure_category ? (
          <p className="text-sm text-muted-foreground">
            Category: {execution.failure_category}
          </p>
        ) : null}

        {attempts.length > 0 ? (
          <ul className="space-y-2">
            {attempts.map((attempt) => (
              <li
                key={attempt.id}
                className="rounded-md border p-3 text-sm"
              >
                #{attempt.attempt_no} · {attempt.kind}
                {attempt.outcome ? ` · ${attempt.outcome}` : ""}
                {attempt.response_code ? ` · ${attempt.response_code}` : ""}
                {attempt.sanitised_error ? (
                  <span className="mt-1 block text-muted-foreground">
                    {attempt.sanitised_error}
                  </span>
                ) : null}
              </li>
            ))}
          </ul>
        ) : null}

        {error ? (
          <Alert>
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        ) : null}

        {(canRetry || canInquire) && (
          <div className="flex flex-wrap gap-2">
            {canRetry ? (
              <Button
                type="button"
                size="sm"
                disabled={pending}
                onClick={handleRetry}
              >
                Retry execution
              </Button>
            ) : null}
            {canInquire ? (
              <Button
                type="button"
                size="sm"
                variant="outline"
                disabled={pending}
                onClick={handleInquire}
              >
                Run status inquiry
              </Button>
            ) : null}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
