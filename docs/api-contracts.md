# API contracts (Phase 10)

All `/api/v1` routes use bearer or cookie auth via `withActor`, return the standard
`{ success, data | error, correlationId }` envelope, and delegate to domain services.

## Admin resources

| Method | Path | Domain service |
| --- | --- | --- |
| GET, POST | `/api/v1/admin/teams` | `listAdminTeams`, `upsertAdminTeam` |
| GET, POST | `/api/v1/admin/team-memberships` | `listAdminTeamMemberships`, `upsertAdminTeamMembership` |
| GET, POST | `/api/v1/admin/taxonomy` | categories + subcategories (`?resource=categories\|subcategories\|all`) |
| GET, POST | `/api/v1/admin/assignment-rules` | `listAdminAssignmentRules`, `upsertAdminAssignmentRule` |
| GET, POST | `/api/v1/admin/sla-definitions` | `listAdminSlaDefinitions`, `upsertAdminSlaDefinition` |
| GET, POST | `/api/v1/admin/approval-rules` | `listAdminApprovalRules`, `upsertAdminApprovalRule` |
| GET, POST | `/api/v1/admin/notification-templates` | `listAdminNotificationTemplates`, `upsertAdminNotificationTemplate` |

Admin list endpoints accept `q`, `active`, `page`, and `pageSize` query parameters.
The consolidated `/api/v1/admin/config` route remains available for backward compatibility.

## Approvals and cases

| Method | Path | Notes |
| --- | --- | --- |
| GET | `/api/v1/approvals` | Pending approval queue for approver roles |
| GET | `/api/v1/cases/:id/approval` | Latest approval request + steps for a case |
| GET | `/api/v1/cases/:id/execution` | Latest execution + attempts for a case |
| POST | `/api/v1/cases/:id/execution/retry` | Retry by case (optimistic `expectedVersion`) |
| POST | `/api/v1/cases/:id/execution/inquire` | Status inquiry by case |

## Integration executions

| Method | Path | Notes |
| --- | --- | --- |
| GET | `/api/v1/integration-executions/:id` | Execution row + attempts |
| POST | `/api/v1/integration-executions/:id/retry` | Safe manual retry |
| POST | `/api/v1/integration-executions/:id/status-inquiry` | Enqueue provider status check |

## Operations and dashboard

| Method | Path | Notes |
| --- | --- | --- |
| GET | `/api/v1/exceptions` | Alias of `/api/v1/operations/exceptions` |
| POST | `/api/v1/exceptions/:id/resolve` | Resolve operational exception |
| GET | `/api/v1/saved-views` | Personal and shared case views |
| GET | `/api/v1/dashboard/management` | Alias of `/api/v1/management/dashboard` |

## Idempotency and locking

- Case transitions that change financial or approval state accept `Idempotency-Key`.
- Execution retry and status inquiry accept `expectedVersion` for optimistic locking.
- Admin upserts record configuration audit entries with `change_reason`.
