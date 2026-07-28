# Operational exception queues

Phase 5 adds an operations triage workspace at `/operations/exceptions`.

## Queues

| Queue | Source |
| --- | --- |
| Integration failed permanently | Execution `FAILED_FINAL` |
| Integration retry pending | Execution `FAILED_RETRYABLE` |
| Integration result unknown | Execution `UNKNOWN` |
| Approval rejected | Case moved to `REJECTED` |
| Approval expired | Reserved (no auto-expiry yet) |
| SLA breached | SLA processor breach event |
| Unassigned case | Case created without assigned agent |
| Duplicate transaction suspected | Provider `DUPLICATE_REQUEST` |
| Manual reconciliation required | Ops “Mark reconciliation” |
| Dead-letter background job | Job enters `dead_letter` |

## Safety

Unknown financial results **must not** be retried until a status inquiry confirms non-processing (`FAILED_RETRYABLE` / safe retry). The UI only shows **Retry** for retry-pending failures and **Status inquiry** for unknown results.

## Actions (audited)

Assign owner, add internal note, escalate, mark reconciliation, resolve/dismiss exception, open case, view attempts, retry (when safe), status inquiry, export selected CSV.

Every action writes `case_audit_history` with `event_type = exception_action` when a case is linked.

## API

`GET /api/v1/operations/exceptions?queueType=&includeResolved=`

## Table

`operational_exceptions` — org-scoped, upserted by `source_ref` so re-breaches reopen resolved items.
