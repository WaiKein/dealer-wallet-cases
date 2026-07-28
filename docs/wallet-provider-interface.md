# Wallet provider interface

Domain code depends on `WalletAdjustmentProvider`, not a vendor SDK.

```ts
interface WalletAdjustmentProvider {
  executeAdjustment(command: WalletAdjustmentCommand): Promise<WalletAdjustmentResult>;
  getAdjustmentStatus(request: WalletAdjustmentStatusRequest): Promise<WalletAdjustmentStatusResult>;
}
```

## Command requirements

Every execute command must include:

- `idempotencyKey`
- `correlationId`
- `caseId`
- `approvalRequestId`
- `organizationId`
- `requestedAmount` / `approvedAmount`
- `accountId` / `referenceId`
- `requestHash` (SHA-256 of the canonical financial payload)

Use `buildWalletAdjustmentCommand()` / `hashWalletRequest()` in `src/lib/wallet/`.

## Retry safety

| Situation | Action |
| --- | --- |
| Timeout with `processingCertainty=NOT_PROCESSED` | May schedule execute retry |
| Timeout / unknown with `requiresStatusInquiry=true` | **Do not** retry execute; run status inquiry first |
| Status inquiry confirms `NOT_PROCESSED` + `safeToRetryExecute` | Execute retry allowed |
| Status inquiry `PROCESSED` / `UNCERTAIN` | Do not retry execute |

Helpers: `canScheduleExecuteRetry`, `canRetryAfterStatusInquiry`.

## Implementations

| Class | Status |
| --- | --- |
| `MockWalletAdjustmentProvider` | Active (pilot) |
| `RealWalletAdjustmentProvider` | Stub only — throws; no credentials |

Factory: `getWalletAdjustmentProvider()` (`WALLET_PROVIDER=mock` only in this phase).

Logging must mask account IDs (`maskAccountId`) and never store secrets or full sensitive payloads.
