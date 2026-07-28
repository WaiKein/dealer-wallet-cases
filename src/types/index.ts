export type UserRole =
  | "requester"
  | "operations_agent"
  | "approver"
  | "team_lead"
  | "admin";

export type CaseStatus =
  | "SUBMITTED"
  | "UNDER_REVIEW"
  | "WAITING_FOR_REQUESTER"
  | "WAITING_FOR_EXTERNAL_PARTY"
  | "PENDING_APPROVAL"
  | "APPROVED"
  | "REJECTED"
  | "RESOLVED";

export type AdjustmentType = "credit" | "debit";

export type CasePriority = "low" | "medium" | "high" | "critical";

export type LeadAuthorizationMode = "role" | "membership" | "both";

export type SlaType = "first_response" | "resolution";

export type SlaState =
  | "RUNNING"
  | "DUE_SOON"
  | "BREACHED"
  | "PAUSED"
  | "COMPLETED";

export type AuditEventType =
  | "status_change"
  | "assignment"
  | "reassignment"
  | "claim"
  | "acknowledge"
  | "sla_due_soon"
  | "sla_breach"
  | "sla_completed"
  | "sla_paused"
  | "sla_resumed"
  | "case_reopened"
  | "exception_action";

export type NotificationType =
  | "case_assignment"
  | "case_reassignment"
  | "approval_request"
  | "approval_decision"
  | "sla_due_soon"
  | "sla_breach"
  | "case_resolution"
  | "case_reopening"
  | "integration_execution";

export interface ConfigMetadata {
  version?: number;
  effective_from?: string;
  effective_to?: string | null;
  created_by?: string | null;
  updated_by?: string | null;
  change_reason?: string | null;
  updated_at?: string;
}

export interface Organization extends ConfigMetadata {
  id: string;
  name: string;
  lead_authorization_mode: LeadAuthorizationMode;
  is_active?: boolean;
  created_at: string;
}

export interface Profile {
  id: string;
  email: string;
  full_name: string;
  role: UserRole;
  organization_id: string | null;
  is_active?: boolean;
  created_at: string;
  updated_at?: string;
  updated_by?: string | null;
  change_reason?: string | null;
}

export interface Category extends ConfigMetadata {
  id: string;
  organization_id: string;
  code: string;
  name: string;
  is_active: boolean;
  created_at: string;
}

export interface Subcategory extends ConfigMetadata {
  id: string;
  organization_id: string;
  category_id: string;
  code: string;
  name: string;
  is_active: boolean;
  created_at: string;
}

export interface AssignmentGroup extends ConfigMetadata {
  id: string;
  organization_id: string;
  code: string;
  name: string;
  description: string | null;
  is_active: boolean;
  created_at: string;
}

export interface AssignmentGroupMember extends ConfigMetadata {
  id: string;
  group_id: string;
  user_id: string;
  is_lead: boolean;
  is_active?: boolean;
  created_at: string;
  profile?: Pick<Profile, "id" | "full_name" | "email" | "role">;
}

export interface AssignmentRule extends ConfigMetadata {
  id: string;
  organization_id: string;
  sequence: number;
  is_active: boolean;
  category_id: string | null;
  subcategory_id: string | null;
  priority: CasePriority | null;
  assignment_group_id: string;
  created_at: string;
}

export interface SlaDefinition extends ConfigMetadata {
  id: string;
  organization_id: string;
  priority: CasePriority;
  sla_type: SlaType;
  duration_minutes: number;
  is_active?: boolean;
  created_at: string;
}

export interface ApprovalRule extends ConfigMetadata {
  id: string;
  organization_id: string;
  code: string;
  name: string;
  sequence: number;
  case_type: string | null;
  category_id: string | null;
  subcategory_id: string | null;
  min_amount: number | null;
  max_amount: number | null;
  priority: CasePriority | null;
  requester_role: UserRole | null;
  requester_team_id: string | null;
  assignment_group_id: string | null;
  risk_level: string | null;
  required_approver_role: UserRole | null;
  required_approver_team_id: string | null;
  approval_levels: number;
  sequential_required: boolean;
  approver_limit: number | null;
  is_active: boolean;
  created_at: string;
}

export interface NotificationTemplate extends ConfigMetadata {
  id: string;
  organization_id: string;
  code: string;
  name: string;
  channel: string;
  event_type: string;
  subject_template: string | null;
  body_template: string;
  variables: string[];
  is_active: boolean;
  created_at: string;
}

export interface FeatureFlag extends ConfigMetadata {
  id: string;
  organization_id: string;
  code: string;
  name: string;
  description: string | null;
  is_enabled: boolean;
  is_active: boolean;
  created_at: string;
}

export interface ConfigurationAuditEntry {
  id: string;
  organization_id: string;
  configuration_type: string;
  configuration_id: string;
  previous_value: Record<string, unknown> | null;
  new_value: Record<string, unknown> | null;
  actor_id: string;
  change_reason: string | null;
  correlation_id: string | null;
  created_at: string;
}

export interface CaseSla {
  id: string;
  case_id: string;
  sla_type: SlaType;
  state: SlaState;
  due_at: string;
  started_at: string;
  completed_at: string | null;
  paused_at: string | null;
  paused_elapsed_seconds: number;
  breached_at: string | null;
  due_soon_notified_at: string | null;
  breach_notified_at: string | null;
  updated_at: string;
}

export interface CaseRecord {
  id: string;
  case_number: string;
  title: string;
  description: string;
  dealer_id: string;
  wallet_id: string;
  adjustment_amount: number;
  adjustment_type: AdjustmentType;
  currency: string;
  status: CaseStatus;
  priority: CasePriority;
  organization_id: string | null;
  category_id: string | null;
  subcategory_id: string | null;
  requester_id: string;
  assigned_group_id: string | null;
  assigned_agent_id: string | null;
  approver_id: string | null;
  rejection_reason: string | null;
  resolution_notes: string | null;
  acknowledged_at: string | null;
  first_responded_at: string | null;
  version: number;
  created_at: string;
  updated_at: string;
}

export interface CaseAuditEntry {
  id: string;
  case_id: string;
  event_type: AuditEventType;
  from_status: CaseStatus | null;
  to_status: CaseStatus | null;
  changed_by: string;
  comment: string | null;
  metadata: Record<string, unknown>;
  created_at: string;
}

export interface CaseComment {
  id: string;
  case_id: string;
  author_id: string;
  body: string;
  is_internal?: boolean;
  created_at: string;
  author?: Pick<Profile, "id" | "full_name" | "email" | "role">;
}

export interface CaseAttachment {
  id: string;
  case_id: string;
  uploaded_by: string;
  file_name: string;
  file_path: string;
  file_size: number;
  mime_type: string;
  created_at: string;
  uploader?: Pick<Profile, "id" | "full_name" | "email">;
  signed_url?: string | null;
}

export interface Notification {
  id: string;
  organization_id: string;
  user_id: string;
  case_id: string | null;
  type: NotificationType;
  title: string;
  body: string;
  dedupe_key: string;
  read_at: string | null;
  created_at: string;
}

export interface CaseWithRelations extends CaseRecord {
  requester?: Pick<Profile, "id" | "full_name" | "email">;
  assigned_agent?: Pick<Profile, "id" | "full_name" | "email"> | null;
  assigned_group?: Pick<AssignmentGroup, "id" | "name" | "code"> | null;
  category?: Pick<Category, "id" | "name" | "code"> | null;
  subcategory?: Pick<Subcategory, "id" | "name" | "code"> | null;
  approver?: Pick<Profile, "id" | "full_name" | "email"> | null;
  audit_history?: CaseAuditEntry[];
  comments?: CaseComment[];
  attachments?: CaseAttachment[];
  sla_records?: CaseSla[];
}

export interface ActionResult<T = void> {
  success: boolean;
  data?: T;
  error?: string;
  code?: string;
  details?: Record<string, unknown>;
  correlationId?: string;
}
