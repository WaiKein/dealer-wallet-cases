# Approval matrix (Phase 2)

## Runtime model

Case status stays on `cases.status`. Approval is tracked separately:

- `approval_requests` — overall request (`PENDING` / `APPROVED` / `REJECTED` / …)
- `approval_steps` — per-level decisions
- `approval_rules` — organisation-scoped matching matrix (admin CRUD in Phase 1)
- `approval_delegations` — time-bounded approver → delegate authority

## Matching

`matchApprovalRule` picks the first active, in-effect rule by `sequence` using case
category, subcategory, amount bounds, priority, requester role/team, assignment
group, risk level, and case type.

Cases snapshot `approval_rule_id` + `approval_rule_version` when approval is requested.

## Maker-checker

Server-side checks reject:

- Requester / creator self-approval
- Assigned operations agent approval
- Missing required role (unless valid delegation)
- Amount above limit
- Approved amount above requested
- Rejection without reason

Decisions are immutable (optimistic lock on step + request `version` → HTTP 409).

## Delegation

Approvers may create time-bounded delegations (`/admin/delegations`). Limits cannot
exceed the delegator’s authority. Delegation use is recorded on the step
(`decided_as_delegate_of`).

## API

- `GET /api/v1/cases/:id/approval` — latest request + steps
- Existing `POST /api/v1/cases/:id/transition` with `APPROVED` / `REJECTED` runs
  the approval engine when the case is `PENDING_APPROVAL`
- Optional body: `expectedApprovalVersion`, `approved_amount`

## Multi-level

Sequential rules keep later steps `SKIPPED` until the prior level is approved.
The case remains `PENDING_APPROVAL` until the final level completes.
