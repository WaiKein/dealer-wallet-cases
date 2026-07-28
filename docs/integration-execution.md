# Integration execution tracking

Phase 4 persists wallet adjustment attempts separately from case status.

## Model

- `case_integration_executions` — one row per approved case / approval request
- `case_integration_attempts` — append-only execute / status-inquiry attempts

### Execution statuses

`NOT_STARTED` → `QUEUED` → `IN_PROGRESS` → `SUCCEEDED` | `FAILED_RETRYABLE` | `FAILED_FINAL` | `UNKNOWN` | `CANCELLED`

## Workflow

1. Final approval moves the case to `APPROVED`
2. Domain creates an execution (idempotent) and enqueues `integration.execute_wallet`
3. Worker calls `getWalletAdjustmentProvider().executeAdjustment`
4. Outcome is mapped, attempt row appended, execution updated
5. Retryable failures enqueue another execute job (backoff)
6. Uncertain outcomes enqueue `integration.inquire_wallet_status` — **never** blind execute retry
7. Case status is **not** auto-changed by jobs (resolve remains a deliberate agent action)

## Resolve gate

Feature flag `require_execution_before_resolve` (seeded **off**):

- Off: agents can resolve after approval without waiting for wallet success (existing sims keep working)
- On: `APPROVED → RESOLVED` is blocked until execution status is `SUCCEEDED`

## APIs

- `GET /api/v1/cases/:id/execution`
- `POST /api/v1/cases/:id/execution/retry`
- `POST /api/v1/cases/:id/execution/inquire`

## UI

Case detail shows a **Wallet execution** panel with status, attempts, and manual retry / status inquiry when allowed.

## Jobs

| Job type | Purpose |
| --- | --- |
| `integration.execute_wallet` | Call provider execute |
| `integration.inquire_wallet_status` | Call provider status inquiry |

Handlers update execution tables only; they do not mutate case workflow status.
