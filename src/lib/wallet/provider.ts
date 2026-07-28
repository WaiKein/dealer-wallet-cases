import { MockWalletAdjustmentProvider } from "@/lib/wallet/mock-provider";
import type { WalletAdjustmentProvider } from "@/lib/wallet/types";

let cached: WalletAdjustmentProvider | null = null;

/**
 * Resolve the active wallet provider.
 * Pilot always uses the mock provider. A future env switch can select Real*.
 */
export function getWalletAdjustmentProvider(): WalletAdjustmentProvider {
  if (cached) return cached;

  const mode = (process.env.WALLET_PROVIDER ?? "mock").toLowerCase();
  if (mode === "real") {
    throw new Error(
      "WALLET_PROVIDER=real is not supported in this phase. Use mock."
    );
  }

  cached = new MockWalletAdjustmentProvider();
  return cached;
}

/** Test helper to clear the singleton. */
export function resetWalletAdjustmentProviderCache() {
  cached = null;
}
