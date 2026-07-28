# Simulator expansion (Phase 9)

Phase 9 extends the YAML case simulator with actions/assertions for approvals,
delegations, wallet execution, exceptions, email outbox, saved views, and the
management dashboard.

## New commands

```bash
npm run simulate:phase9
npm run simulate:approvals
```

## Coverage map (required → scenario)

| Requirement | Scenario(s) |
| --- | --- |
| Low-value one approval | `01-successful-wallet-adjustment` |
| High-value sequential | `26-high-value-sequential-approval` |
| Requester self-approval | `27-requester-self-approval-denied` |
| Agent maker-checker | `28-agent-maker-checker-denied` |
| Approver over limit | `29-approval-limit-exceeded` |
| Valid delegation | `30-valid-delegated-approval` |
| Expired delegation | `31-expired-delegation-denied` |
| Mock wallet success | `17-wallet-mock-success` |
| Temp failure + retry | `19-wallet-mock-retry-then-success` |
| Permanent failure | `18`, `22` |
| Timeout non-processing | `40-timeout-non-processing-safe-retry` |
| Timeout unknown + inquiry | `20-wallet-mock-uncertain-status-inquiry` |
| Duplicate execution | `32-duplicate-execution-idempotent` |
| Concurrent workers | `33-concurrent-integration-workers` |
| Approval email | `23-email-outbox-delivery` |
| Email dedupe | `34-email-dedupe` |
| Failed email / dead-letter | `15-dead-letter-job` (job bus; outbox has no SMTP fail path in pilot) |
| Exception queue | `22`, `37-resolve-operational-exception` |
| Personal view | `24-saved-case-views` |
| Team-shared view | `35-team-shared-view` |
| Cross-org view denial | `36-cross-org-view-denial` |
| Dashboard KPI | `25`, `39-dashboard-kpi-value` |
| Config version retained | `38-config-version-retained` |
| Admin config audit | `38` (`change_reason` + config upsert) |

## Notable actions

`create_approval_rule`, `approve_level`, `create_delegation`, `retry_safe_execution`,
`resolve_operational_exception`, `load_saved_view`, `get_management_dashboard`,
`advance_mock_provider_state`, `run_integration_worker`, `run_notification_worker`
