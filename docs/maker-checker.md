# Maker-checker controls

Enforced in `src/lib/approvals/maker-checker.ts` and `decideApprovalForCase`.

| Rule | Behaviour |
| --- | --- |
| Requester cannot approve own case | Deny `SELF_APPROVAL_REQUESTER` |
| Creator cannot approve own request | Same as requester in this domain |
| Assigned agent cannot approve | Deny `MAKER_CHECKER_ASSIGNED_AGENT` |
| Required role / team | Direct role or valid delegation + team membership |
| Approval limit | Requested amount ≤ effective limit |
| Approved amount | ≤ requested amount |
| Rejection reason | Required |
| Immutable decisions | Step update requires `status=PENDING` + matching `version` |

Approval success does **not** imply wallet execution success. After final approval, Phase 4 creates a `case_integration_executions` row and enqueues a background job (see `docs/integration-execution.md`).
