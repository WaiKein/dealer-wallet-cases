/** System-generated IDs for SILO mode (no external account/wallet APIs yet). */

function yearPrefix(): string {
  return String(new Date().getFullYear());
}

function shortToken(length = 8): string {
  return crypto.randomUUID().replace(/-/g, "").slice(0, length).toUpperCase();
}

/** Mandatory account identifier — always assigned by the system. */
export function generateAccountId(): string {
  return `ACC-${yearPrefix()}-${shortToken()}`;
}

/**
 * SILO / local reference when no external system ID is supplied.
 * When integrations exist, callers may pass an external reference instead.
 */
export function generateReferenceId(): string {
  return `REF-${yearPrefix()}-${shortToken()}`;
}

/** Offer a small set of SILO reference suggestions for optional selection. */
export function suggestReferenceIds(count = 3): string[] {
  return Array.from({ length: count }, () => generateReferenceId());
}
