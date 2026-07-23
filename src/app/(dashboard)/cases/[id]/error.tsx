"use client";

import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";

export default function CaseDetailError({
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <Alert className="border-destructive/50 bg-destructive/10">
      <AlertTitle>Unable to display this case</AlertTitle>
      <AlertDescription className="space-y-3">
        <p>An unexpected error occurred while loading the case details.</p>
        <div className="flex gap-2">
          <Button type="button" variant="outline" onClick={reset}>
            Retry
          </Button>
          <Button asChild variant="ghost">
            <Link href="/cases">Back to cases</Link>
          </Button>
        </div>
      </AlertDescription>
    </Alert>
  );
}
