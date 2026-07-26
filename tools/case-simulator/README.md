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
npm run simulate:all
```

Reports are written to `tools/case-simulator/reports/` (console + JSON + JUnit).

## Notes

- Business actions use each actor's bearer token against `/api/v1/*`.
- Clock/SLA/cleanup use `/api/test-control/*` with `x-test-control-secret`.
- Test control is refused when `NODE_ENV=production` or `ENABLE_TEST_CONTROL` is not `true`.
