import { describe, expect, it } from "vitest";
import { sanitizePublicMessage } from "@/lib/api/errors";
import { backoffMs } from "@/lib/jobs/enqueue";

describe("api error sanitization", () => {
  it("hides postgres internals", () => {
    expect(
      sanitizePublicMessage(
        "INTERNAL_ERROR",
        "new row violates row-level security policy for table \"cases\""
      )
    ).toBe("An unexpected error occurred.");
  });

  it("keeps safe domain messages", () => {
    expect(
      sanitizePublicMessage("FORBIDDEN", "You are not allowed to perform this status change.")
    ).toBe("You are not allowed to perform this status change.");
  });
});

describe("job backoff", () => {
  it("grows exponentially and caps", () => {
    expect(backoffMs(1)).toBe(1000);
    expect(backoffMs(2)).toBe(2000);
    expect(backoffMs(3)).toBe(4000);
    expect(backoffMs(20)).toBe(15 * 60 * 1000);
  });
});
