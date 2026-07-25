import { describe, expect, it } from "vitest";
import {
  createCaseSchema,
  statusTransitionSchema,
  caseListFilterSchema,
} from "@/lib/validations/case";

describe("createCaseSchema", () => {
  it("accepts valid case input without account or reference IDs", () => {
    const result = createCaseSchema.safeParse({
      title: "Duplicate deposit correction",
      description: "Dealer reported a duplicate wallet credit from batch DEP-8842.",
      adjustment_amount: 1250,
      adjustment_type: "debit",
      currency: "USD",
      category_id: "c1000000-0000-0000-0000-000000000001",
      subcategory_id: "c2000000-0000-0000-0000-000000000001",
      priority: "medium",
    });

    expect(result.success).toBe(true);
  });

  it("accepts an optional external reference ID", () => {
    const result = createCaseSchema.safeParse({
      title: "Duplicate deposit correction",
      description: "Dealer reported a duplicate wallet credit from batch DEP-8842.",
      wallet_id: "EXT-SYS-88901",
      adjustment_amount: 1250,
      adjustment_type: "debit",
      currency: "USD",
      category_id: "c1000000-0000-0000-0000-000000000001",
      subcategory_id: "c2000000-0000-0000-0000-000000000001",
      priority: "medium",
    });

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.wallet_id).toBe("EXT-SYS-88901");
    }
  });

  it("rejects non-positive amounts", () => {
    const result = createCaseSchema.safeParse({
      title: "Invalid amount case",
      description: "This case should fail because the amount is zero.",
      adjustment_amount: 0,
      adjustment_type: "credit",
      currency: "USD",
      category_id: "c1000000-0000-0000-0000-000000000001",
      subcategory_id: "c2000000-0000-0000-0000-000000000001",
      priority: "low",
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
