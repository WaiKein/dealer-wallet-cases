import { z } from "zod";

const emptyToNull = (value: unknown) =>
  value === "" || value === undefined ? null : value;

const optionalUuid = z.preprocess(emptyToNull, z.string().uuid().nullable().optional());
const optionalNumber = z.preprocess(
  emptyToNull,
  z.coerce.number().nullable().optional()
);

export const changeReasonSchema = z
  .string()
  .trim()
  .min(3, "Change reason must be at least 3 characters.")
  .max(500);

export const paginationSchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  pageSize: z.coerce.number().int().positive().max(100).default(20),
  q: z.string().trim().optional(),
  active: z.enum(["all", "active", "inactive"]).default("all"),
});

export type PaginationInput = z.infer<typeof paginationSchema>;

export const organizationUpdateSchema = z.object({
  name: z.string().trim().min(2).max(120),
  lead_authorization_mode: z.enum(["role", "membership", "both"]),
  is_active: z.boolean().optional(),
  change_reason: changeReasonSchema,
});

export const profileUpdateSchema = z.object({
  id: z.string().uuid(),
  full_name: z.string().trim().min(2).max(120),
  role: z.enum([
    "requester",
    "operations_agent",
    "approver",
    "team_lead",
    "admin",
  ]),
  is_active: z.boolean(),
  change_reason: changeReasonSchema,
});

export const categoryUpsertSchema = z.object({
  id: z.string().uuid().optional(),
  code: z
    .string()
    .trim()
    .min(2)
    .max(40)
    .regex(/^[A-Z0-9_]+$/i, "Use letters, numbers, and underscores."),
  name: z.string().trim().min(2).max(120),
  is_active: z.boolean().default(true),
  effective_from: z.string().datetime().optional(),
  effective_to: z.string().datetime().nullable().optional(),
  change_reason: changeReasonSchema,
});

export const subcategoryUpsertSchema = categoryUpsertSchema.extend({
  category_id: z.string().uuid(),
});

export const teamUpsertSchema = z.object({
  id: z.string().uuid().optional(),
  code: z
    .string()
    .trim()
    .min(2)
    .max(40)
    .regex(/^[A-Z0-9_]+$/i, "Use letters, numbers, and underscores."),
  name: z.string().trim().min(2).max(120),
  description: z.string().trim().max(500).nullable().optional(),
  is_active: z.boolean().default(true),
  change_reason: changeReasonSchema,
});

export const teamMembershipUpsertSchema = z.object({
  id: z.string().uuid().optional(),
  group_id: z.string().uuid(),
  user_id: z.string().uuid(),
  is_lead: z.boolean().default(false),
  is_active: z.boolean().default(true),
  change_reason: changeReasonSchema,
});

export const assignmentRuleUpsertSchema = z.object({
  id: z.string().uuid().optional(),
  sequence: z.coerce.number().int().positive(),
  category_id: optionalUuid,
  subcategory_id: optionalUuid,
  priority: z.preprocess(
    emptyToNull,
    z.enum(["low", "medium", "high", "critical"]).nullable().optional()
  ),
  assignment_group_id: z.string().uuid(),
  is_active: z.boolean().default(true),
  change_reason: changeReasonSchema,
});

export const slaDefinitionUpsertSchema = z.object({
  id: z.string().uuid().optional(),
  priority: z.enum(["low", "medium", "high", "critical"]),
  sla_type: z.enum(["first_response", "resolution"]),
  duration_minutes: z.coerce.number().int().positive().max(525600),
  is_active: z.boolean().default(true),
  change_reason: changeReasonSchema,
});

export const approvalRuleUpsertSchema = z.object({
  id: z.string().uuid().optional(),
  code: z
    .string()
    .trim()
    .min(2)
    .max(60)
    .regex(/^[A-Z0-9_]+$/i, "Use letters, numbers, and underscores."),
  name: z.string().trim().min(2).max(120),
  sequence: z.coerce.number().int().positive(),
  case_type: z.preprocess(emptyToNull, z.string().trim().max(60).nullable().optional()),
  category_id: optionalUuid,
  subcategory_id: optionalUuid,
  min_amount: optionalNumber,
  max_amount: optionalNumber,
  priority: z.preprocess(
    emptyToNull,
    z.enum(["low", "medium", "high", "critical"]).nullable().optional()
  ),
  requester_role: z.preprocess(
    emptyToNull,
    z
      .enum(["requester", "operations_agent", "approver", "team_lead", "admin"])
      .nullable()
      .optional()
  ),
  requester_team_id: optionalUuid,
  assignment_group_id: optionalUuid,
  risk_level: z.preprocess(emptyToNull, z.string().trim().max(40).nullable().optional()),
  required_approver_role: z.preprocess(
    emptyToNull,
    z
      .enum(["requester", "operations_agent", "approver", "team_lead", "admin"])
      .nullable()
      .optional()
  ),
  required_approver_team_id: optionalUuid,
  approval_levels: z.coerce.number().int().min(1).max(10).default(1),
  sequential_required: z.boolean().default(true),
  approver_limit: optionalNumber,
  is_active: z.boolean().default(true),
  change_reason: changeReasonSchema,
});

export const notificationTemplateUpsertSchema = z.object({
  id: z.string().uuid().optional(),
  code: z
    .string()
    .trim()
    .min(2)
    .max(80)
    .regex(/^[A-Z0-9_]+$/i, "Use letters, numbers, and underscores."),
  name: z.string().trim().min(2).max(120),
  channel: z.enum(["email", "in_app"]).default("email"),
  event_type: z.string().trim().min(2).max(80),
  subject_template: z.string().trim().max(200).nullable().optional(),
  body_template: z.string().trim().min(1).max(8000),
  variables: z.array(z.string().trim().min(1)).default([]),
  is_active: z.boolean().default(true),
  change_reason: changeReasonSchema,
});

export const featureFlagUpsertSchema = z.object({
  id: z.string().uuid().optional(),
  code: z
    .string()
    .trim()
    .min(2)
    .max(80)
    .regex(/^[a-z0-9_]+$/, "Use lowercase letters, numbers, and underscores."),
  name: z.string().trim().min(2).max(120),
  description: z.string().trim().max(500).nullable().optional(),
  is_enabled: z.boolean().default(false),
  is_active: z.boolean().default(true),
  change_reason: changeReasonSchema,
});
