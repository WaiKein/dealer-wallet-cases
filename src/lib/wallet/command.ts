import { hashWalletRequest } from "@/lib/wallet/hash";
import type { WalletAdjustmentCommand } from "@/lib/wallet/types";

export function buildWalletAdjustmentCommand(
  input: Omit<WalletAdjustmentCommand, "requestHash"> & {
    requestHash?: string;
  }
): WalletAdjustmentCommand {
  const { correlationId, requestHash: providedHash, ...rest } = input;
  const requestHash =
    providedHash ??
    hashWalletRequest({
      ...rest,
    });

  return {
    ...rest,
    correlationId,
    requestHash,
  };
}
