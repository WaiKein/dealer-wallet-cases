import { SimulatorConsole } from "@/components/simulator/simulator-console";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { isTestControlEnabled } from "@/lib/clock";
import { requireProfile } from "@/lib/auth/session";

export default async function SimulatorPage() {
  await requireProfile();

  if (!isTestControlEnabled()) {
    return (
      <Alert className="border-amber-500/40 bg-amber-50">
        <AlertTitle>Simulator UI disabled</AlertTitle>
        <AlertDescription>
          Enable local test control in <code>.env.local</code> with{" "}
          <code>ENABLE_TEST_CONTROL=true</code>,{" "}
          <code>TEST_CONTROL_SECRET</code>, and{" "}
          <code>SUPABASE_SERVICE_ROLE_KEY</code>, then restart{" "}
          <code>npm run dev</code>.
        </AlertDescription>
      </Alert>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Case simulator</h1>
        <p className="text-muted-foreground">
          Run YAML scenarios against the public APIs and inspect pass/fail
          steps, timings, and correlation IDs.
        </p>
      </div>
      <SimulatorConsole />
    </div>
  );
}
