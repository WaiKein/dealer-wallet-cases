import { SimulatorConsole } from "@/components/simulator/simulator-console";
import { PageHeader } from "@/components/layout/page-header";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { isTestControlEnabled } from "@/lib/clock";
import { requireProfile } from "@/lib/auth/session";

export default async function SimulatorPage() {
  await requireProfile();

  if (!isTestControlEnabled()) {
    return (
      <div className="space-y-6">
        <PageHeader
          eyebrow="UAT"
          title="Case simulator"
          description="Run YAML scenarios against the public APIs and inspect pass/fail steps."
        />
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
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="UAT"
        title="Case simulator"
        description="Run YAML scenarios against the public APIs and inspect pass/fail steps, timings, and correlation IDs."
      />
      <SimulatorConsole />
    </div>
  );
}
