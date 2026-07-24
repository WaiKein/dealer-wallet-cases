"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { createCase } from "@/lib/cases/actions";
import { createCaseSchema } from "@/lib/validations/case";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

export function CaseForm() {
  const router = useRouter();
  const [formError, setFormError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [adjustmentType, setAdjustmentType] = useState<string>("");
  const [isPending, startTransition] = useTransition();

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setFormError(null);
    setFieldErrors({});

    const formData = new FormData(event.currentTarget);
    const raw = {
      title: formData.get("title"),
      description: formData.get("description"),
      dealer_id: formData.get("dealer_id"),
      wallet_id: formData.get("wallet_id"),
      adjustment_amount: formData.get("adjustment_amount"),
      adjustment_type: adjustmentType,
      currency: formData.get("currency") || "USD",
    };

    const parsed = createCaseSchema.safeParse(raw);
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
      const result = await createCase(parsed.data);
      if (result?.error) {
        setFormError(result.error);
      }
    });
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>New case</CardTitle>
        <CardDescription>
          Submit a request for a credit or debit adjustment.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          {formError && (
            <Alert className="border-destructive/50 bg-destructive/10">
              <AlertTitle>Unable to create case</AlertTitle>
              <AlertDescription>{formError}</AlertDescription>
            </Alert>
          )}

          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2 md:col-span-2">
              <Label htmlFor="title">Title</Label>
              <Input id="title" name="title" disabled={isPending} />
              {fieldErrors.title && (
                <p className="text-sm text-destructive">{fieldErrors.title}</p>
              )}
            </div>

            <div className="space-y-2 md:col-span-2">
              <Label htmlFor="description">Description</Label>
              <Textarea id="description" name="description" rows={4} disabled={isPending} />
              {fieldErrors.description && (
                <p className="text-sm text-destructive">{fieldErrors.description}</p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="dealer_id">Account ID</Label>
              <Input id="dealer_id" name="dealer_id" placeholder="ACC-10042" disabled={isPending} />
              {fieldErrors.dealer_id && (
                <p className="text-sm text-destructive">{fieldErrors.dealer_id}</p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="wallet_id">Reference ID</Label>
              <Input id="wallet_id" name="wallet_id" placeholder="REF-88421" disabled={isPending} />
              {fieldErrors.wallet_id && (
                <p className="text-sm text-destructive">{fieldErrors.wallet_id}</p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="adjustment_amount">Adjustment amount</Label>
              <Input
                id="adjustment_amount"
                name="adjustment_amount"
                type="number"
                step="0.01"
                min="0.01"
                disabled={isPending}
              />
              {fieldErrors.adjustment_amount && (
                <p className="text-sm text-destructive">{fieldErrors.adjustment_amount}</p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="adjustment_type">Adjustment type</Label>
              <Select
                value={adjustmentType}
                onValueChange={setAdjustmentType}
                disabled={isPending}
              >
                <SelectTrigger id="adjustment_type">
                  <SelectValue placeholder="Select type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="credit">Credit</SelectItem>
                  <SelectItem value="debit">Debit</SelectItem>
                </SelectContent>
              </Select>
              {fieldErrors.adjustment_type && (
                <p className="text-sm text-destructive">{fieldErrors.adjustment_type}</p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="currency">Currency</Label>
              <Input id="currency" name="currency" defaultValue="USD" maxLength={3} disabled={isPending} />
              {fieldErrors.currency && (
                <p className="text-sm text-destructive">{fieldErrors.currency}</p>
              )}
            </div>
          </div>

          <div className="flex gap-3">
            <Button type="submit" disabled={isPending}>
              {isPending ? "Submitting..." : "Submit case"}
            </Button>
            <Button
              type="button"
              variant="outline"
              disabled={isPending}
              onClick={() => router.push("/cases")}
            >
              Cancel
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
