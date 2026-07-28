import { describe, expect, it } from "vitest";
import {
  EXCEPTION_QUEUE_LABELS,
  OPEN_EXCEPTION_STATUSES,
} from "@/lib/exceptions/types";
import {
  canAccessExceptionQueues,
  canManageExceptions,
} from "@/lib/auth/permissions";

describe("exception queues", () => {
  it("exposes labels for every queue type", () => {
    expect(Object.keys(EXCEPTION_QUEUE_LABELS)).toHaveLength(10);
    expect(EXCEPTION_QUEUE_LABELS.integration_unknown).toMatch(/unknown/i);
  });

  it("treats escalated items as open", () => {
    expect(OPEN_EXCEPTION_STATUSES).toContain("ESCALATED");
    expect(OPEN_EXCEPTION_STATUSES).not.toContain("RESOLVED");
  });

  it("gates access and manage permissions", () => {
    expect(canAccessExceptionQueues("operations_agent")).toBe(true);
    expect(canAccessExceptionQueues("approver")).toBe(true);
    expect(canAccessExceptionQueues("requester")).toBe(false);
    expect(canManageExceptions("operations_agent")).toBe(true);
    expect(canManageExceptions("approver")).toBe(false);
  });
});
