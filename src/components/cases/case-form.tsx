"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { createCase } from "@/lib/cases/actions";
import { suggestReferenceIds } from "@/lib/cases/ids";
import { createCaseSchema } from "@/lib/validations/case";
import { PageHeader } from "@/components/layout/page-header";
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
import { cn } from "@/lib/utils";
import type { Category, Subcategory } from "@/types";

interface CaseFormProps {
  categories: Category[];
  subcategories: Subcategory[];
}

const STEPS = ["Request", "Classification", "Adjustment", "Review"] as const;

export function CaseForm({ categories, subcategories }: CaseFormProps) {
  const router = useRouter();
  const [step, setStep] = useState(0);
  const [formError, setFormError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [adjustmentType, setAdjustmentType] = useState<string>("");
  const [adjustmentAmount, setAdjustmentAmount] = useState("");
  const [currency, setCurrency] = useState("USD");
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

  const categoryName =
    categories.find((item) => item.id === categoryId)?.name ?? "—";
  const subcategoryName =
    filteredSubcategories.find((item) => item.id === subcategoryId)?.name ??
    "—";

  function refreshSuggestions() {
    setReferenceSuggestions(suggestReferenceIds(3));
  }

  function validateStep(current: number): boolean {
    setFieldErrors({});
    const errors: Record<string, string> = {};
    if (current === 0) {
      if (title.trim().length < 3) errors.title = "Title is required.";
      if (description.trim().length < 3)
        errors.description = "Description is required.";
    }
    if (current === 1) {
      if (!categoryId) errors.category_id = "Category is required.";
      if (!subcategoryId) errors.subcategory_id = "Subcategory is required.";
      if (!priority) errors.priority = "Priority is required.";
    }
    if (current === 2) {
      if (!adjustmentType) errors.adjustment_type = "Type is required.";
      if (!adjustmentAmount || Number(adjustmentAmount) <= 0) {
        errors.adjustment_amount = "Enter a valid amount.";
      }
    }
    setFieldErrors(errors);
    return Object.keys(errors).length === 0;
  }

  function goNext() {
    if (!validateStep(step)) return;
    setStep((value) => Math.min(value + 1, STEPS.length - 1));
  }

  function goBack() {
    setStep((value) => Math.max(value - 1, 0));
  }

  function handleSubmit() {
    setFormError(null);
    setFieldErrors({});

    const raw = {
      title,
      description,
      wallet_id: referenceId,
      adjustment_amount: adjustmentAmount,
      adjustment_type: adjustmentType,
      currency: currency || "USD",
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
      setStep(0);
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
    <div className="mx-auto max-w-3xl space-y-6">
      <PageHeader
        title="New case"
        description="Four-step intake. Values are kept as you move between steps. Nothing is saved until you submit."
      />

      <ol className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        {STEPS.map((label, index) => (
          <li
            key={label}
            className={cn(
              "rounded-md border px-3 py-2 text-center text-xs font-medium",
              index === step
                ? "border-primary bg-accent text-accent-foreground"
                : index < step
                  ? "border-primary/40 text-foreground"
                  : "text-muted-foreground"
            )}
          >
            {index + 1}. {label}
          </li>
        ))}
      </ol>

      <div className="ops-panel space-y-4 p-4 sm:p-6">
        {formError && (
          <Alert className="border-destructive/50 bg-destructive/10">
            <AlertTitle>Unable to create case</AlertTitle>
            <AlertDescription>{formError}</AlertDescription>
          </Alert>
        )}

        {step === 0 ? (
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="title">Title</Label>
              <Input
                id="title"
                value={title}
                onChange={(event) => setTitle(event.target.value)}
                disabled={isPending}
              />
              {fieldErrors.title && (
                <p className="text-sm text-destructive">{fieldErrors.title}</p>
              )}
            </div>
            <div className="space-y-2">
              <Label htmlFor="description">Description</Label>
              <Textarea
                id="description"
                rows={4}
                value={description}
                onChange={(event) => setDescription(event.target.value)}
                disabled={isPending}
              />
              {fieldErrors.description && (
                <p className="text-sm text-destructive">
                  {fieldErrors.description}
                </p>
              )}
            </div>
          </div>
        ) : null}

        {step === 1 ? (
          <div className="grid gap-4 sm:grid-cols-2">
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
                <p className="text-sm text-destructive">
                  {fieldErrors.category_id}
                </p>
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
                <p className="text-sm text-destructive">
                  {fieldErrors.subcategory_id}
                </p>
              )}
            </div>
            <div className="space-y-2">
              <Label>Priority</Label>
              <Select
                value={priority}
                onValueChange={setPriority}
                disabled={isPending}
              >
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
            </div>
          </div>
        ) : null}

        {step === 2 ? (
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2 sm:col-span-2 rounded-lg border bg-muted/30 p-3">
              <p className="text-sm font-medium">Account ID</p>
              <p className="text-sm text-muted-foreground">
                Assigned automatically by the system when you submit.
              </p>
            </div>
            <div className="space-y-2 sm:col-span-2">
              <Label htmlFor="wallet_id">Reference ID (optional)</Label>
              <Input
                id="wallet_id"
                value={referenceId}
                onChange={(event) => setReferenceId(event.target.value)}
                placeholder="External system ID, or leave blank"
                disabled={isPending}
              />
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
                type="number"
                step="0.01"
                min="0.01"
                value={adjustmentAmount}
                onChange={(event) => setAdjustmentAmount(event.target.value)}
                disabled={isPending}
              />
              {fieldErrors.adjustment_amount && (
                <p className="text-sm text-destructive">
                  {fieldErrors.adjustment_amount}
                </p>
              )}
            </div>
            <div className="space-y-2">
              <Label>Adjustment type</Label>
              <Select
                value={adjustmentType}
                onValueChange={setAdjustmentType}
                disabled={isPending}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="credit">Credit</SelectItem>
                  <SelectItem value="debit">Debit</SelectItem>
                </SelectContent>
              </Select>
              {fieldErrors.adjustment_type && (
                <p className="text-sm text-destructive">
                  {fieldErrors.adjustment_type}
                </p>
              )}
            </div>
            <div className="space-y-2">
              <Label htmlFor="currency">Currency</Label>
              <Input
                id="currency"
                value={currency}
                maxLength={3}
                onChange={(event) => setCurrency(event.target.value)}
                disabled={isPending}
              />
            </div>
          </div>
        ) : null}

        {step === 3 ? (
          <div className="space-y-3 text-sm">
            <h3 className="font-semibold">Review before submit</h3>
            <dl className="grid gap-2 sm:grid-cols-2">
              <ReviewItem label="Title" value={title} />
              <ReviewItem label="Priority" value={priority} />
              <ReviewItem label="Category" value={categoryName} />
              <ReviewItem label="Subcategory" value={subcategoryName} />
              <ReviewItem
                label="Adjustment"
                value={`${adjustmentType || "—"} ${adjustmentAmount || "—"} ${currency}`}
              />
              <ReviewItem
                label="Reference"
                value={referenceId || "Auto-generated if blank"}
              />
              <ReviewItem
                label="Description"
                value={description}
                className="sm:col-span-2"
              />
            </dl>
            <p className="text-xs text-muted-foreground">
              This is not a draft. Submitting creates the case immediately.
            </p>
          </div>
        ) : null}

        <div className="flex flex-wrap gap-2 pt-2">
          {step > 0 ? (
            <Button type="button" variant="outline" onClick={goBack} disabled={isPending}>
              Back
            </Button>
          ) : (
            <Button
              type="button"
              variant="outline"
              disabled={isPending}
              onClick={() => router.push("/cases")}
            >
              Cancel
            </Button>
          )}
          {step < STEPS.length - 1 ? (
            <Button type="button" onClick={goNext} disabled={isPending}>
              Continue
            </Button>
          ) : (
            <Button type="button" onClick={handleSubmit} disabled={isPending}>
              {isPending ? "Submitting..." : "Submit case"}
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}

function ReviewItem({
  label,
  value,
  className,
}: {
  label: string;
  value: string;
  className?: string;
}) {
  return (
    <div className={cn("rounded-md border px-3 py-2", className)}>
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className="font-medium">{value}</dd>
    </div>
  );
}
