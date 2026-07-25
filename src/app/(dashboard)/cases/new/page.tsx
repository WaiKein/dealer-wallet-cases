import { CaseForm } from "@/components/cases/case-form";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { requireRole } from "@/lib/auth/session";
import { listCategories, listSubcategories } from "@/lib/cases/queries";

export default async function NewCasePage() {
  const profile = await requireRole(["requester"]);

  if (!profile.organization_id) {
    return (
      <Alert className="border-destructive/50 bg-destructive/10">
        <AlertTitle>Organization required</AlertTitle>
        <AlertDescription>
          Your profile is not linked to an organization.
        </AlertDescription>
      </Alert>
    );
  }

  const [categories, subcategories] = await Promise.all([
    listCategories(profile.organization_id),
    listSubcategories(profile.organization_id),
  ]);

  return (
    <div className="mx-auto max-w-3xl">
      <CaseForm
        categories={categories.data}
        subcategories={subcategories.data}
      />
    </div>
  );
}
