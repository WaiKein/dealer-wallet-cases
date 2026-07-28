# Mock wallet provider

`MockWalletAdjustmentProvider` simulates wallet adjustments for the pilot.

## Outcomes (execute)

- `SUCCESS`
- `TEMPORARY_FAILURE`
- `PERMANENT_FAILURE`
- `TIMEOUT_BEFORE_PROCESSING` → confirmed not processed (retryable)
- `TIMEOUT_AFTER_POSSIBLE_PROCESSING` → uncertain (status inquiry required)
- `DUPLICATE_REQUEST`
- `DELAYED_COMPLETION`
- `UNKNOWN_RESULT`
- `MALFORMED_RESPONSE`

## Status inquiry outcomes

- `STATUS_SUCCESS`
- `STATUS_NOT_FOUND` → safe to retry execute
- `STATUS_TEMPORARY_FAILURE`
- `STATUS_UNKNOWN`

## Configuring outcomes (test-control only)

Ordinary users cannot change outcomes.

Requires `ENABLE_TEST_CONTROL=true` and header `x-test-control-secret`.

```bash
# Default success
curl -X POST "$BASE/api/test-control/wallet/mock" \
  -H "content-type: application/json" \
  -H "x-test-control-secret: $TEST_CONTROL_SECRET" \
  -d '{"action":"set","scope":"default","executeOutcome":"SUCCESS"}'

# Temporary failure then success on 2nd attempt for a key
curl -X POST "$BASE/api/test-control/wallet/mock" \
  -H "content-type: application/json" \
  -H "x-test-control-secret: $TEST_CONTROL_SECRET" \
  -d '{
    "action":"set",
    "scope":"idempotencyKey",
    "idempotencyKey":"exec-1",
    "executeOutcome":"TEMPORARY_FAILURE",
    "afterAttempts":2,
    "thenExecuteOutcome":"SUCCESS"
  }'

# Reset
curl -X POST "$BASE/api/test-control/wallet/mock" \
  -H "content-type: application/json" \
  -H "x-test-control-secret: $TEST_CONTROL_SECRET" \
  -d '{"action":"reset"}'
```

Scopes: `default` | `idempotencyKey` | `caseId`.

Config is process-local (in-memory). Restarting the app clears it unless re-applied by the simulator.

## Direct execute / status (test-control)

For simulator and API tests without case-execution jobs:

```bash
# Execute adjustment against the mock provider
curl -X POST "$BASE/api/test-control/wallet/execute" \
  -H "content-type: application/json" \
  -H "x-test-control-secret: $TEST_CONTROL_SECRET" \
  -d '{
    "idempotencyKey":"exec-1",
    "caseId":"00000000-0000-4000-8000-000000000101",
    "approvalRequestId":"00000000-0000-4000-8000-000000000001",
    "organizationId":"<org-uuid>",
    "accountId":"ACCT-001",
    "referenceId":"REF-001",
    "requestedAmount":100,
    "approvedAmount":100
  }'

# Status inquiry (use requestHash from execute response)
curl -X POST "$BASE/api/test-control/wallet/status" \
  -H "content-type: application/json" \
  -H "x-test-control-secret: $TEST_CONTROL_SECRET" \
  -d '{
    "idempotencyKey":"exec-1",
    "caseId":"00000000-0000-4000-8000-000000000101",
    "approvalRequestId":"00000000-0000-4000-8000-000000000001",
    "organizationId":"<org-uuid>",
    "requestHash":"<from-execute>",
    "accountId":"ACCT-001",
    "referenceId":"REF-001"
  }'
```

## YAML simulator

```bash
npm run simulate:wallet
```

See `tools/case-simulator/scenarios/17-*.yaml` … `20-*.yaml` and `tools/case-simulator/README.md`.
