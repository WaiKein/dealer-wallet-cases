import { signOut } from "@/lib/auth/actions";
import { getCurrentProfile } from "@/lib/auth/session";
import { ROLE_LABELS } from "@/lib/auth/roles";
import { Button } from "@/components/ui/button";
import Link from "next/link";

export async function AppHeader() {
  const profile = await getCurrentProfile();

  return (
    <header className="border-b bg-background">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4">
        <div className="flex items-center gap-6">
          <Link href="/dashboard" className="text-lg font-semibold">
            Case Management
          </Link>
          <nav className="hidden gap-4 text-sm md:flex">
            <Link href="/dashboard" className="text-muted-foreground hover:text-foreground">
              Dashboard
            </Link>
            <Link href="/cases" className="text-muted-foreground hover:text-foreground">
              Cases
            </Link>
            {profile?.role === "requester" && (
              <Link
                href="/cases/new"
                className="text-muted-foreground hover:text-foreground"
              >
                New Case
              </Link>
            )}
          </nav>
        </div>

        {profile && (
          <div className="flex items-center gap-3">
            <div className="hidden text-right text-sm sm:block">
              <p className="font-medium">{profile.full_name}</p>
              <p className="text-muted-foreground">
                {ROLE_LABELS[profile.role]}
              </p>
            </div>
            <form action={signOut}>
              <Button type="submit" variant="outline" size="sm">
                Sign out
              </Button>
            </form>
          </div>
        )}
      </div>
    </header>
  );
}
