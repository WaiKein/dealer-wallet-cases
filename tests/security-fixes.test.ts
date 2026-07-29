import { describe, expect, it } from "vitest";
import { escapeCsvCell } from "@/lib/csv";
import { hashRequestPayload } from "@/lib/api/idempotency";

describe("CSV formula injection", () => {
  it("prefixes formula-leading cells with a single quote and quotes them", () => {
    expect(escapeCsvCell("=cmd|' /C calc'!A0")).toBe(`"'=cmd|' /C calc'!A0"`);
    expect(escapeCsvCell("+1234")).toBe(`"'+1234"`);
    expect(escapeCsvCell("-1+1")).toBe(`"'-1+1"`);
    expect(escapeCsvCell("@SUM(A1)")).toBe(`"'@SUM(A1)"`);
  });

  it("still escapes commas and quotes in normal cells", () => {
    expect(escapeCsvCell('Hello, "world"')).toBe('"Hello, ""world"""');
    expect(escapeCsvCell("plain")).toBe("plain");
  });
});

describe("idempotency request hashing", () => {
  it("produces stable hashes for identical payloads", () => {
    const a = hashRequestPayload({ title: "Case", amount: 10 });
    const b = hashRequestPayload({ title: "Case", amount: 10 });
    expect(a).toBe(b);
    expect(a).toHaveLength(64);
  });

  it("changes hash when the payload changes", () => {
    expect(hashRequestPayload({ title: "A" })).not.toBe(
      hashRequestPayload({ title: "B" })
    );
  });

  it("exports a positive lease window for stale claim takeover", async () => {
    const { IDEMPOTENCY_LEASE_SECONDS } = await import("@/lib/api/idempotency");
    expect(IDEMPOTENCY_LEASE_SECONDS).toBeGreaterThanOrEqual(5);
  });
});
