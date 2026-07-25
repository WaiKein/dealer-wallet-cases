"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { createCase } from "@/lib/cases/actions";
import { suggestReferenceIds } from "@/lib/cases/ids";
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
import type { Category, Subcategory } from "@/types";

interface CaseFormProps {
  categories: Category[];
  subcategories: Subcategory[];
}

export function CaseForm({ categories, subcategories }: CaseFormProps) {
  const router = useRouter();
  const [formError, setFormError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [adjustmentType, setAdjustmentType] = useState<string>("");
  const [categoryId, setCategoryId] = useState<string>("");
  const [subcategoryId, setSubcategoryId] = useState<string>("");
  const [priority, setPriority] = useState<string>("medium");
  const [referenceId, setReferenceId] = useState("");
  const [referenceSuggestions, setReferenceSuggestions] = useState<string[]>([]);
  const [isPending, startTransition] = useTransition();

  useEffect(() => {
    setReferenceSuggestions(suggestReferenceIds(3));
  }, []);

  const filteredSubcategories = useMemo(
    () => subcategories.filter((item) => item.category_id === categoryId),
    [subcategories, categoryId]
  );

  function refreshSuggestions() {
    setReferenceSuggestions(suggestReferenceIds(3));
  }

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setFormError(null);
    setFieldErrors({});

    const formData = new FormData(event.currentTarget);
    const raw = {
      title: formData.get("title"),
      description: formData.get("description"),
      wallet_id: referenceId,
      adjustment_amount: formData.get("adjustment_amount"),
      adjustment_type: adjustmentType,
      currency: formData.get("currency") || "USD",
      category_id: categoryId,
      subcategory_id: subcategoryId,
      priority,
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
          Submit a request for a credit or debit adjustment. Account ID is
          assigned by the system. Reference ID is optional until external
          integrations are available.
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
              <Label>Category</Label>
              <Select
                value={categoryId}
                onValueChange={(value) => {
                  setCategoryId(value);
                  setSubcategoryId("");
                }}
                disabled={isPending}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select category" />
                </SelectTrigger>
                <SelectContent>
                  {categories.map((category) => (
                    <SelectItem key={category.id} value={category.id}>
                      {category.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {fieldErrors.category_id && (
                <p className="text-sm text-destructive">{fieldErrors.category_id}</p>
              )}
            </div>

            <div className="space-y-2">
              <Label>Subcategory</Label>
              <Select
                value={subcategoryId}
                onValueChange={setSubcategoryId}
                disabled={isPending || !categoryId}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select subcategory" />
                </SelectTrigger>
                <SelectContent>
                  {filteredSubcategories.map((subcategory) => (
                    <SelectItem key={subcategory.id} value={subcategory.id}>
                      {subcategory.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {fieldErrors.subcategory_id && (
                <p className="text-sm text-destructive">{fieldErrors.subcategory_id}</p>
              )}
            </div>

            <div className="space-y-2">
              <Label>Priority</Label>
              <Select value={priority} onValueChange={setPriority} disabled={isPending}>
                <SelectTrigger>
                  <SelectValue placeholder="Select priority" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="low">Low</SelectItem>
                  <SelectItem value="medium">Medium</SelectItem>
                  <SelectItem value="high">High</SelectItem>
                  <SelectItem value="critical">Critical</SelectItem>
                </SelectContent>
              </Select>
              {fieldErrors.priority && (
                <p className="text-sm text-destructive">{fieldErrors.priority}</p>
              )}
            </div>

            <div className="space-y-2 md:col-span-2 rounded-lg border bg-muted/30 p-3">
              <p className="text-sm font-medium">Account ID</p>
              <p className="text-sm text-muted-foreground">
                Assigned automatically by the system when you submit (mandatory).
              </p>
            </div>

            <div className="space-y-2 md:col-span-2">
              <Label htmlFor="wallet_id">Reference ID (optional)</Label>
              <Input
                id="wallet_id"
                name="wallet_id"
                value={referenceId}
                onChange={(event) => setReferenceId(event.target.value)}
                placeholder="External system ID, or leave blank to auto-generate"
                disabled={isPending}
              />
              <p className="text-xs text-muted-foreground">
                Use an external system reference when available. In SILO mode,
                leave blank or pick a generated local reference below.
              </p>
              {fieldErrors.wallet_id && (
                <p className="text-sm text-destructive">{fieldErrors.wallet_id}</p>
              )}
              <div className="flex flex-wrap items-center gap-2 pt-1">
                {referenceSuggestions.map((suggestion) => (
                  <Button
                    key={suggestion}
                    type="button"
                    variant={referenceId === suggestion ? "default" : "outline"}
                    size="sm"
                    disabled={isPending}
                    onClick={() => setReferenceId(suggestion)}
                  >
                    {suggestion}
                  </Button>
                ))}
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  disabled={isPending}
                  onClick={refreshSuggestions}
                >
                  Refresh suggestions
                </Button>
              </div>
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
