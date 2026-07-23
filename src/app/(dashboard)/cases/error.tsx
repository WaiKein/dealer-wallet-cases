"use client";

import { useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";

export default function CasesError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <Alert className="border-destructive/50 bg-destructive/10">
      <AlertTitle>Something went wrong</AlertTitle>
      <AlertDescription className="space-y-3">
        <p>We could not load the case list. Please try again.</p>
        <Button type="button" variant="outline" onClick={reset}>
          Retry
        </Button>
      </AlertDescription>
    </Alert>
  );
}
