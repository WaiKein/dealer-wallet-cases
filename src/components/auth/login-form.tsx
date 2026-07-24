"use client";

import { useState, useTransition } from "react";
import { useSearchParams } from "next/navigation";
import { signIn } from "@/lib/auth/actions";
import { loginSchema } from "@/lib/validations/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";

export function LoginForm() {
  const searchParams = useSearchParams();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setFieldErrors({});
    setFormError(null);

    const parsed = loginSchema.safeParse({ email, password });
    if (!parsed.success) {
      const errors: Record<string, string> = {};
      parsed.error.issues.forEach((issue) => {
        const key = issue.path[0]?.toString() ?? "form";
        errors[key] = issue.message;
      });
      setFieldErrors(errors);
      return;
    }

    startTransition(async () => {
      const result = await signIn(parsed.data.email, parsed.data.password);
      if (result?.error) {
        setFormError(result.error);
      }
    });
  }

  const authError = searchParams.get("error");

  return (
    <Card className="w-full max-w-md border-slate-200 bg-white shadow-md">
      <CardHeader>
        <CardTitle>Case Management</CardTitle>
        <CardDescription>
          Sign in to manage cases through the workflow.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          {formError && (
            <Alert className="border-destructive/50 bg-destructive/10">
              <AlertTitle>Sign in failed</AlertTitle>
              <AlertDescription>{formError}</AlertDescription>
            </Alert>
          )}

          {authError && (
            <Alert className="border-destructive/50 bg-destructive/10">
              <AlertTitle>Session expired</AlertTitle>
              <AlertDescription>
                Please sign in again to continue.
              </AlertDescription>
            </Alert>
          )}

          {searchParams.get("redirectTo") && !authError && (
            <Alert>
              <AlertDescription>
                Please sign in to continue to the requested page.
              </AlertDescription>
            </Alert>
          )}

          <div className="space-y-2">
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              type="email"
              autoComplete="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              disabled={isPending}
              placeholder="requester@example.com"
            />
            {fieldErrors.email && (
              <p className="text-sm text-destructive">{fieldErrors.email}</p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="password">Password</Label>
            <Input
              id="password"
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              disabled={isPending}
              placeholder="Password123!"
            />
            {fieldErrors.password && (
              <p className="text-sm text-destructive">{fieldErrors.password}</p>
            )}
          </div>

          <Button type="submit" className="w-full" disabled={isPending}>
            {isPending ? "Signing in..." : "Sign in"}
          </Button>

          <p className="text-xs text-muted-foreground">
            Seed users: requester@example.com, agent@example.com,
            approver@example.com (password: Password123!)
          </p>
        </form>
      </CardContent>
    </Card>
  );
}
