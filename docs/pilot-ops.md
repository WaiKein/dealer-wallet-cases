# Pilot operations runbook

Operational guide for the production reliability pilot. Complements the
high-level notes in `README.md`.

## Environment checklist

| Variable | Required in prod | Notes |
| --- | --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL` | Yes | Project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Yes | Browser/client key |
| `SUPABASE_SERVICE_ROLE_KEY` | Yes | Server-only; never expose to the browser |
| `JOBS_TICK_SECRET` | Yes | Shared secret for `POST /api/jobs/tick` |
| `ENABLE_TEST_CONTROL` | **Must be unset / false** | Enables simulator + clock APIs |
| `TEST_CONTROL_SECRET` | Local/CI only | Ignored when test-control is off |
| `SIMULATOR_BASE_URL` | Local/CI only | Simulator CLI target |
| `JOBS_WORKER_ID` | Optional | Defaults to `worker-<pid>` |
| `JOBS_BATCH_SIZE` | Optional | Claim batch size (default `10`) |
| `JOBS_POLL_INTERVAL_MS` | Optional | If `> 0`, `npm run jobs:worker` loops |

## Deploy checklist

1. Apply migrations through `20260101000008_reliability_pilot.sql` (and keep
   `supabase/rollbacks/20260101000008_reliability_pilot_down.sql` handy).
2. Set production env vars from the table above.
3. Confirm `ENABLE_TEST_CONTROL` is **not** `true` so `/simulator` and
   `/api/test-control/*` redirect away.
4. Start the app (`npm run start` or your host).
5. Start a job drain path (worker loop **or** HTTP cron) — see below.
6. Smoke-check health endpoints.

## Background jobs

Jobs live in Postgres (`background_jobs`, `background_job_attempts`). Claim uses
`FOR UPDATE SKIP LOCKED` so multiple workers are safe.

**Documented system actions** (service-role, org-scoped, no status transitions):

- `sla.refresh_case`
- `notification.dispatch`

### Option A — long-running worker

```bash
# One-shot drain (default)
npm run jobs:worker

# Continuous poll every 15s (pilot-friendly)
JOBS_POLL_INTERVAL_MS=15000 JOBS_BATCH_SIZE=10 npm run jobs:worker
```

Requires the same server env as the app (`SUPABASE_*`, etc.).

### Option B — HTTP cron → tick endpoint

Schedule every 30–60 seconds:

```bash
curl -sS -X POST "$APP_URL/api/jobs/tick" \
  -H "content-type: application/json" \
  -H "x-jobs-tick-secret: $JOBS_TICK_SECRET" \
  -d '{"limit":10,"workerId":"cron-1"}'
```

Unauthorized requests return `401` with a standard API error body.

## Health endpoints

| Path | Meaning |
| --- | --- |
| `GET /api/health/live` | Process is up (liveness) |
| `GET /api/health/ready` | Required env is present (readiness) |
| `GET /api/health/database` | Can reach Postgres via Supabase |

Use `live` for load balancer liveness, `ready`/`database` for readiness gates.

## Correlation IDs

- Clients may send `x-correlation-id`; otherwise the server mints one.
- Responses include `correlationId` in JSON and echo the header.
- Audit history, notifications, and jobs store the ID for support tracing.
- Dashboard conflict errors show the correlation ID as `Ref: …`.

## Failure modes

| Symptom | Where to look | Action |
| --- | --- | --- |
| SLA / notifications lag | `background_jobs` with `status=pending\|running\|failed` | Ensure worker/cron is running; check attempts |
| Dead-letter jobs | `status=dead` after max attempts | Inspect `background_job_attempts.last_error`; fix payload/handler; re-enqueue if safe |
| HTTP 409 `VERSION_CONFLICT` | Concurrent case edits | Client refreshes `cases.version` and retries |
| HTTP 409 `IDEMPOTENCY_KEY_REUSE` | Same key, different body | Use a new Idempotency-Key |
| Tick returns 401 | Missing/wrong `x-jobs-tick-secret` | Align cron secret with `JOBS_TICK_SECRET` |

## Rollback (migration 008)

If you must undo the reliability schema on a non-production database:

```bash
# Review then apply the down script against the DB (manual / DBA)
# File: supabase/rollbacks/20260101000008_reliability_pilot_down.sql
```

Prefer forward-fix in production. Rolling back drops job/idempotency tables and
the `cases.version` column — only do this when you accept data loss for those
structures.

## Security constraints (pilot)

- Never enable `ENABLE_TEST_CONTROL` in production.
- Service-role key stays on the server (API routes, jobs worker, server actions).
- Public errors use safe messages (no stack traces / SQL internals).
- Job handlers must remain org-scoped and must not perform arbitrary status
  transitions outside documented actions.
