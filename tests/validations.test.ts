import { describe, expect, it } from "vitest";
import {
  createCaseSchema,
  statusTransitionSchema,
  caseListFilterSchema,
} from "@/lib/validations/case";

describe("createCaseSchema", () => {
  it("accepts valid case input", () => {
    const result = createCaseSchema.safeParse({
      title: "Duplicate deposit correction",
      description: "Dealer reported a duplicate wallet credit from batch DEP-8842.",
      dealer_id: "DLR-10042",
      wallet_id: "WLT-88421",
      adjustment_amount: 1250,
      adjustment_type: "debit",
      currency: "USD",
    });

    expect(result.success).toBe(true);
  });

  it("rejects non-positive amounts", () => {
    const result = createCaseSchema.safeParse({
      title: "Invalid amount case",
      description: "This case should fail because the amount is zero.",
      dealer_id: "DLR-10042",
      wallet_id: "WLT-88421",
      adjustment_amount: 0,
      adjustment_type: "credit",
      currency: "USD",
    });

    expect(result.success).toBe(false);
  });
});

describe("statusTransitionSchema", () => {
  it("requires rejection reason when rejecting", () => {
    const result = statusTransitionSchema.safeParse({
      caseId: "11111111-1111-1111-1111-111111111111",
      nextStatus: "REJECTED",
    });

    expect(result.success).toBe(false);
  });

  it("requires resolution notes when resolving", () => {
    const result = statusTransitionSchema.safeParse({
      caseId: "11111111-1111-1111-1111-111111111111",
      nextStatus: "RESOLVED",
    });

    expect(result.success).toBe(false);
  });

  it("accepts valid approval transition", () => {
    const result = statusTransitionSchema.safeParse({
      caseId: "11111111-1111-1111-1111-111111111111",
      nextStatus: "APPROVED",
      comment: "Approved after review.",
    });

    expect(result.success).toBe(true);
  });
});

describe("caseListFilterSchema", () => {
  it("accepts optional filters", () => {
    const result = caseListFilterSchema.safeParse({
      status: "SUBMITTED",
      search: "DWC",
    });

    expect(result.success).toBe(true);
  });
});
