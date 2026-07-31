import { Suspense } from "react";
import { LoginForm } from "@/components/auth/login-form";
import { Skeleton } from "@/components/ui/skeleton";
import { FolderKanban, ShieldCheck } from "lucide-react";

function LoginFormFallback() {
  return <Skeleton className="h-[360px] w-full max-w-md rounded-lg" />;
}

export default function LoginPage() {
  return (
    <main className="grid min-h-screen lg:grid-cols-2">
      <section className="relative hidden flex-col justify-between bg-primary px-10 py-12 text-primary-foreground lg:flex">
        <div className="flex items-center gap-2">
          <span className="flex h-9 w-9 items-center justify-center rounded-md bg-white/15">
            <FolderKanban className="h-5 w-5" aria-hidden />
          </span>
          <span className="text-lg font-semibold tracking-tight">CaseOps</span>
        </div>

        <div className="max-w-lg space-y-6">
          <h1 className="text-4xl font-semibold leading-tight tracking-tight">
            Case Management System
          </h1>
          <p className="text-base text-primary-foreground/90">
            One secure workspace for case intake, assignments, approvals, SLA
            monitoring, and audit evidence.
          </p>
          <ul className="grid gap-3 text-sm text-primary-foreground/90 sm:grid-cols-2">
            {[
              "Role-based workflows",
              "SLA and exception control",
              "End-to-end audit trail",
              "Organisation-scoped access",
            ].map((item) => (
              <li key={item} className="flex items-start gap-2">
                <span className="mt-0.5 text-primary-foreground">✓</span>
                {item}
              </li>
            ))}
          </ul>
        </div>

        <p className="flex items-center gap-2 text-sm text-primary-foreground/80">
          <ShieldCheck className="h-4 w-4" aria-hidden />
          Secure, traceable, and built for operational teams
        </p>
      </section>

      <section className="flex items-center justify-center bg-background px-6 py-12">
        <div className="w-full max-w-md space-y-8">
          <div className="space-y-2 lg:hidden">
            <div className="flex items-center gap-2 text-primary">
              <FolderKanban className="h-5 w-5" aria-hidden />
              <span className="font-semibold">CaseOps</span>
            </div>
            <h1 className="text-2xl font-semibold">Case Management System</h1>
            <p className="text-sm text-muted-foreground">
              One secure workspace for case intake, assignments, approvals, SLA
              monitoring, and audit evidence.
            </p>
          </div>
          <Suspense fallback={<LoginFormFallback />}>
            <LoginForm />
          </Suspense>
        </div>
      </section>
    </main>
  );
}
