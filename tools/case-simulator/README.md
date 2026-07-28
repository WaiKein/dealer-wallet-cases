# Case workflow simulator

API-driven scenario runner under `tools/case-simulator`.

## Prerequisites

1. Supabase local running with migrations applied
2. Next.js app running with test-control enabled:

```env
ENABLE_TEST_CONTROL=true
TEST_CONTROL_SECRET=local-simulator-secret
SUPABASE_SERVICE_ROLE_KEY=...
```

3. Install deps: `npm install`

## Commands

```bash
npm run simulate:smoke
npm run simulate:workflow
npm run simulate:security
npm run simulate:sla
npm run simulate:wallet
npm run simulate:exceptions
npm run simulate:email
npm run simulate:views
npm run simulate:management
npm run simulate:phase9
npm run simulate:approvals
npm run simulate:all
```

Phase 9 coverage map: [docs/simulator-expansion.md](../../docs/simulator-expansion.md).

### Wallet mock API scenarios

Tags: `wallet` / `integration`. These call test-control wallet endpoints (not Phase 4 case execution):

| Scenario | Covers |
| --- | --- |
| `17-wallet-mock-success` | Configure + execute → `SUCCESS` |
| `18-wallet-mock-temporary-failure` | `TEMPORARY_FAILURE` + retryable |
| `19-wallet-mock-retry-then-success` | Fail then succeed on 2nd attempt |
| `20-wallet-mock-uncertain-status-inquiry` | Uncertain timeout → status inquiry → safe retry |
| `21-integration-execution-success` | Approve → job → `case_integration_executions` SUCCEEDED |

Simulator actions: `reset_wallet_mock`, `configure_wallet_mock`, `execute_wallet_adjustment`, `inquire_wallet_status`.

Assertions: `wallet_execute_outcome`, `wallet_status_outcome`, `integration_execution_status`.

Reports are written to `tools/case-simulator/reports/` (console + JSON + JUnit).

## UI

With the Next.js app running and test-control enabled, open **Simulator** in the
header (or go to `/simulator`) while signed in. From there you can:

- Browse scenarios and filter by tag
- Run all / by tag / a single scenario
- Inspect the latest pass/fail steps, timings, and console output

The UI is disabled when `ENABLE_TEST_CONTROL` is not `true` or `NODE_ENV` is
`production`.

## Notes

- Business actions use each actor's bearer token against `/api/v1/*`.
- Clock/SLA/cleanup use `/api/test-control/*` with `x-test-control-secret`.
- Test control is refused when `NODE_ENV=production` or `ENABLE_TEST_CONTROL` is not `true`.
