import { describe, expect, it } from "vitest";
import {
  generateAccountId,
  generateReferenceId,
  suggestReferenceIds,
} from "@/lib/cases/ids";

describe("system ID generation", () => {
  it("generates account IDs with ACC prefix", () => {
    expect(generateAccountId()).toMatch(/^ACC-\d{4}-[A-F0-9]{8}$/);
  });

  it("generates reference IDs with REF prefix", () => {
    expect(generateReferenceId()).toMatch(/^REF-\d{4}-[A-F0-9]{8}$/);
  });

  it("suggests a set of distinct SILO reference IDs", () => {
    const suggestions = suggestReferenceIds(3);
    expect(suggestions).toHaveLength(3);
    expect(new Set(suggestions).size).toBe(3);
  });
});
