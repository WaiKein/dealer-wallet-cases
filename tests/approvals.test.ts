import { describe, expect, it } from "vitest";
import { evaluateMakerChecker } from "@/lib/approvals/maker-checker";
import { matchApprovalRule } from "@/lib/approvals/matching";
import {
  isDelegationActive,
  selectDelegation,
  validateDelegationAuthority,
} from "@/lib/approvals/delegation";
import type { ApprovalRule, Profile } from "@/types";

const baseRule = (overrides: Partial<ApprovalRule> = {}): ApprovalRule => ({
  id: "11111111-1111-1111-1111-111111111111",
  organization_id: "org",
  code: "R1",
  name: "Rule 1",
  sequence: 10,
  case_type: null,
  category_id: null,
  subcategory_id: null,
  min_amount: null,
  max_amount: null,
  priority: null,
  requester_role: null,
  requester_team_id: null,
  assignment_group_id: null,
  risk_level: null,
  required_approver_role: "approver",
  required_approver_team_id: null,
  approval_levels: 1,
  sequential_required: true,
  approver_limit: null,
  is_active: true,
  version: 1,
  created_at: new Date().toISOString(),
  ...overrides,
});

describe("approval rule matching", () => {
  it("selects the first matching rule by sequence", () => {
    const rules = [
      baseRule({ sequence: 20, code: "HIGH", min_amount: 1000 }),
      baseRule({ sequence: 10, code: "DEFAULT" }),
    ];
    const matched = matchApprovalRule(rules, {
      categoryId: null,
      subcategoryId: null,
      amount: 50,
      priority: "medium",
      requesterRole: "requester",
    });
    expect(matched?.code).toBe("DEFAULT");
  });

  it("respects amount bounds", () => {
    const rules = [
      baseRule({ sequence: 1, code: "MID", min_amount: 100, max_amount: 500 }),
    ];
    expect(
      matchApprovalRule(rules, {
        categoryId: null,
        subcategoryId: null,
        amount: 50,
        priority: "low",
        requesterRole: "requester",
      })
    ).toBeNull();
    expect(
      matchApprovalRule(rules, {
        categoryId: null,
        subcategoryId: null,
        amount: 250,
        priority: "low",
        requesterRole: "requester",
      })?.code
    ).toBe("MID");
  });
});

describe("maker-checker", () => {
  const actor = (overrides: Partial<Profile> = {}): Profile => ({
    id: "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa",
    email: "a@example.com",
    full_name: "Actor",
    role: "approver",
    organization_id: "org",
    created_at: new Date().toISOString(),
    ...overrides,
  });

  it("blocks requester self-approval", () => {
    const result = evaluateMakerChecker({
      actor: actor({ id: "req", role: "requester" }),
      caseRequesterId: "req",
      caseAssignedAgentId: "agent",
      requiredRole: "approver",
      requestedAmount: 100,
      isRejection: false,
    });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.code).toBe("SELF_APPROVAL_REQUESTER");
  });

  it("blocks assigned agent approval", () => {
    const result = evaluateMakerChecker({
      actor: actor({ id: "agent", role: "approver" }),
      caseRequesterId: "req",
      caseAssignedAgentId: "agent",
      requiredRole: "approver",
      requestedAmount: 100,
      isRejection: false,
    });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.code).toBe("MAKER_CHECKER_ASSIGNED_AGENT");
  });

  it("enforces approval limits and rejection reason", () => {
    expect(
      evaluateMakerChecker({
        actor: actor(),
        caseRequesterId: "req",
        caseAssignedAgentId: "agent",
        requiredRole: "approver",
        requestedAmount: 500,
        effectiveLimit: 100,
        isRejection: false,
      }).ok
    ).toBe(false);

    expect(
      evaluateMakerChecker({
        actor: actor(),
        caseRequesterId: "req",
        caseAssignedAgentId: "agent",
        requiredRole: "approver",
        requestedAmount: 50,
        isRejection: true,
      }).ok
    ).toBe(false);
  });
});

describe("delegation", () => {
  it("validates same-org and non-self delegation", () => {
    const delegator = {
      id: "d1",
      email: "d1@example.com",
      full_name: "D1",
      role: "approver" as const,
      organization_id: "org",
      created_at: "",
    };
    expect(
      validateDelegationAuthority({
        delegator,
        delegate: { ...delegator, id: "d1" },
        approvalLimit: 100,
        delegatorLimit: 200,
      }).ok
    ).toBe(false);
  });

  it("selects an active in-limit delegation", () => {
    const now = new Date("2026-01-15T00:00:00Z");
    const selected = selectDelegation({
      actorId: "delegate",
      allowedDelegatorIds: ["boss"],
      requestedAmount: 80,
      now,
      delegations: [
        {
          id: "1",
          organization_id: "org",
          delegator_id: "boss",
          delegate_id: "delegate",
          approval_limit: 50,
          is_active: true,
          effective_from: "2026-01-01T00:00:00Z",
          effective_to: null,
        },
        {
          id: "2",
          organization_id: "org",
          delegator_id: "boss",
          delegate_id: "delegate",
          approval_limit: 100,
          is_active: true,
          effective_from: "2026-01-01T00:00:00Z",
          effective_to: null,
        },
      ],
    });
    expect(selected?.id).toBe("2");
    expect(
      isDelegationActive(
        {
          id: "x",
          organization_id: "org",
          delegator_id: "boss",
          delegate_id: "delegate",
          approval_limit: null,
          is_active: true,
          effective_from: "2026-01-01T00:00:00Z",
          effective_to: "2026-01-10T00:00:00Z",
        },
        now
      )
    ).toBe(false);
  });
});
