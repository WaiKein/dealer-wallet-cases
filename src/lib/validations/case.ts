import { z } from "zod";

export const adjustmentTypes = ["credit", "debit"] as const;
export const casePriorities = ["low", "medium", "high", "critical"] as const;

export const createCaseSchema = z.object({
  title: z
    .string()
    .min(5, "Title must be at least 5 characters")
    .max(120, "Title must be at most 120 characters"),
  description: z
    .string()
    .min(20, "Description must be at least 20 characters")
    .max(2000, "Description must be at most 2000 characters"),
  dealer_id: z
    .string()
    .min(3, "Account ID is required")
    .max(32, "Account ID is too long"),
  wallet_id: z
    .string()
    .min(3, "Reference ID is required")
    .max(32, "Reference ID is too long"),
  adjustment_amount: z.coerce
    .number({ invalid_type_error: "Enter a valid amount" })
    .positive("Amount must be greater than zero")
    .max(999999999.99, "Amount exceeds maximum allowed"),
  adjustment_type: z.enum(adjustmentTypes, {
    required_error: "Select an adjustment type",
  }),
  currency: z.string().length(3, "Currency must be a 3-letter code").default("USD"),
  category_id: z.string().uuid("Select a category"),
  subcategory_id: z.string().uuid("Select a subcategory"),
  priority: z.enum(casePriorities, {
    required_error: "Select a priority",
  }),
});

export type CreateCaseInput = z.infer<typeof createCaseSchema>;

export const statusTransitionSchema = z
  .object({
    caseId: z.string().uuid("Invalid case ID"),
    nextStatus: z.enum([
      "UNDER_REVIEW",
      "WAITING_FOR_REQUESTER",
      "WAITING_FOR_EXTERNAL_PARTY",
      "PENDING_APPROVAL",
      "APPROVED",
      "REJECTED",
      "RESOLVED",
    ]),
    comment: z.string().max(1000, "Comment is too long").optional(),
    rejection_reason: z.string().max(1000, "Reason is too long").optional(),
    resolution_notes: z.string().max(1000, "Notes are too long").optional(),
  })
  .superRefine((data, ctx) => {
    if (data.nextStatus === "REJECTED" && !data.rejection_reason?.trim()) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Rejection reason is required",
        path: ["rejection_reason"],
      });
    }
    if (data.nextStatus === "RESOLVED" && !data.resolution_notes?.trim()) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Resolution notes are required",
        path: ["resolution_notes"],
      });
    }
  });

export type StatusTransitionInput = z.infer<typeof statusTransitionSchema>;

export const caseListFilterSchema = z.object({
  status: z
    .enum([
      "SUBMITTED",
      "UNDER_REVIEW",
      "WAITING_FOR_REQUESTER",
      "WAITING_FOR_EXTERNAL_PARTY",
      "PENDING_APPROVAL",
      "APPROVED",
      "REJECTED",
      "RESOLVED",
    ])
    .optional(),
  search: z.string().max(100).optional(),
});

export type CaseListFilterInput = z.infer<typeof caseListFilterSchema>;

export const reassignAgentSchema = z.object({
  caseId: z.string().uuid("Invalid case ID"),
  agentId: z.string().uuid("Select an agent"),
});

export type ReassignAgentInput = z.infer<typeof reassignAgentSchema>;

export const caseIdSchema = z.object({
  caseId: z.string().uuid("Invalid case ID"),
});

export const addCommentSchema = z.object({
  caseId: z.string().uuid("Invalid case ID"),
  body: z
    .string()
    .min(1, "Comment cannot be empty")
    .max(2000, "Comment is too long"),
});

export type AddCommentInput = z.infer<typeof addCommentSchema>;
