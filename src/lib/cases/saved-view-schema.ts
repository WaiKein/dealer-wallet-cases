import { z } from "zod";
import {
  casePriorities,
} from "@/lib/validations/case";

const caseStatuses = [
  "SUBMITTED",
  "UNDER_REVIEW",
  "WAITING_FOR_REQUESTER",
  "WAITING_FOR_EXTERNAL_PARTY",
  "PENDING_APPROVAL",
  "APPROVED",
  "REJECTED",
  "RESOLVED",
] as const;

const slaStates = ["RUNNING", "PAUSED", "DUE_SOON", "BREACHED", "COMPLETED"] as const;

const executionStatuses = [
  "NOT_STARTED",
  "QUEUED",
  "IN_PROGRESS",
  "SUCCEEDED",
  "FAILED_RETRYABLE",
  "FAILED_FINAL",
  "UNKNOWN",
  "CANCELLED",
] as const;

const exceptionStatuses = [
  "OPEN",
  "ASSIGNED",
  "IN_PROGRESS",
  "ESCALATED",
  "RESOLVED",
  "DISMISSED",
] as const;

const approvalStatuses = [
  "PENDING",
  "APPROVED",
  "REJECTED",
  "CANCELLED",
] as const;

/** Filters stored on saved views / applied to case list. Actor-scoped flags never bypass ACL. */
export const savedViewFiltersSchema = z
  .object({
    statuses: z.array(z.enum(caseStatuses)).max(20).optional(),
    status: z.enum(caseStatuses).optional(),
    priorities: z.array(z.enum(casePriorities)).max(10).optional(),
    priority: z.enum(casePriorities).optional(),
    categoryId: z.string().uuid().optional(),
    subcategoryId: z.string().uuid().optional(),
    assignedGroupId: z.string().uuid().optional(),
    assignedAgentId: z.string().uuid().optional(),
    requesterId: z.string().uuid().optional(),
    approvalStatuses: z.array(z.enum(approvalStatuses)).max(10).optional(),
    executionStatuses: z.array(z.enum(executionStatuses)).max(20).optional(),
    slaStatuses: z.array(z.enum(slaStates)).max(10).optional(),
    exceptionStatuses: z.array(z.enum(exceptionStatuses)).max(10).optional(),
    createdFrom: z.string().datetime({ offset: true }).optional(),
    createdTo: z.string().datetime({ offset: true }).optional(),
    updatedFrom: z.string().datetime({ offset: true }).optional(),
    updatedTo: z.string().datetime({ offset: true }).optional(),
    updatedWithinHours: z.number().int().positive().max(24 * 30).optional(),
    amountMin: z.number().nonnegative().optional(),
    amountMax: z.number().positive().optional(),
    search: z.string().max(100).optional(),
    accountId: z.string().max(64).optional(),
    referenceId: z.string().max(64).optional(),
    assignedToMe: z.boolean().optional(),
    unassignedInMyTeams: z.boolean().optional(),
    pendingMyApproval: z.boolean().optional(),
    openOnly: z.boolean().optional(),
  })
  .strict();

export type SavedViewFilters = z.infer<typeof savedViewFiltersSchema>;

export const savedViewSortingSchema = z.object({
  field: z
    .enum([
      "created_at",
      "updated_at",
      "priority",
      "status",
      "adjustment_amount",
      "case_number",
      "title",
    ])
    .default("updated_at"),
  direction: z.enum(["asc", "desc"]).default("desc"),
});

export type SavedViewSorting = z.infer<typeof savedViewSortingSchema>;

export const sharingScopes = [
  "personal",
  "team",
  "organization",
  "system",
] as const;

export const createSavedViewSchema = z
  .object({
    name: z.string().min(2).max(80),
    description: z.string().max(500).optional().nullable(),
    sharingScope: z.enum(["personal", "team", "organization"]),
    teamId: z.string().uuid().optional().nullable(),
    filters: savedViewFiltersSchema.default({}),
    sorting: savedViewSortingSchema.default({
      field: "updated_at",
      direction: "desc",
    }),
    visibleColumns: z.array(z.string().max(40)).max(30).optional(),
    columnOrder: z.array(z.string().max(40)).max(30).optional(),
    pageSize: z.number().int().min(5).max(200).optional(),
    isDefault: z.boolean().optional(),
  })
  .superRefine((data, ctx) => {
    if (data.sharingScope === "team" && !data.teamId) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "teamId is required for team-shared views.",
        path: ["teamId"],
      });
    }
  });

export type CreateSavedViewInput = z.infer<typeof createSavedViewSchema>;

const savedViewFieldsSchema = z.object({
  name: z.string().min(2).max(80),
  description: z.string().max(500).optional().nullable(),
  sharingScope: z.enum(["personal", "team", "organization"]),
  teamId: z.string().uuid().optional().nullable(),
  filters: savedViewFiltersSchema.optional(),
  sorting: savedViewSortingSchema.optional(),
  visibleColumns: z.array(z.string().max(40)).max(30).optional(),
  columnOrder: z.array(z.string().max(40)).max(30).optional(),
  pageSize: z.number().int().min(5).max(200).optional(),
  isDefault: z.boolean().optional(),
  isActive: z.boolean().optional(),
});

export const updateSavedViewSchema = savedViewFieldsSchema.partial().superRefine((data, ctx) => {
  if (data.sharingScope === "team" && data.teamId === null) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: "teamId is required for team-shared views.",
      path: ["teamId"],
    });
  }
});

export type UpdateSavedViewInput = z.infer<typeof updateSavedViewSchema>;

/** Extended case list query (URL params + saved view merge). */
export const caseListFilterSchemaExtended = z.object({
  status: z.enum(caseStatuses).optional(),
  search: z.string().max(100).optional(),
  viewId: z.string().uuid().optional(),
  priority: z.enum(casePriorities).optional(),
  categoryId: z.string().uuid().optional(),
  subcategoryId: z.string().uuid().optional(),
  assignedGroupId: z.string().uuid().optional(),
  assignedAgentId: z.string().uuid().optional(),
  accountId: z.string().max(64).optional(),
  referenceId: z.string().max(64).optional(),
});

export type CaseListFilterExtended = z.infer<typeof caseListFilterSchemaExtended>;
