import { CaseForm } from "@/components/cases/case-form";
import { requireRole } from "@/lib/auth/session";

export default async function NewCasePage() {
  await requireRole(["requester"]);

  return (
    <div className="mx-auto max-w-3xl">
      <CaseForm />
    </div>
  );
}
