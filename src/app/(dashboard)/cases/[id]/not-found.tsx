import Link from "next/link";
import { Button } from "@/components/ui/button";

export default function CaseNotFound() {
  return (
    <div className="rounded-lg border border-dashed p-10 text-center">
      <h1 className="text-xl font-semibold">Case not found</h1>
      <p className="mt-2 text-muted-foreground">
        The case you requested does not exist or you do not have access to it.
      </p>
      <Button asChild className="mt-4">
        <Link href="/cases">Back to cases</Link>
      </Button>
    </div>
  );
}
