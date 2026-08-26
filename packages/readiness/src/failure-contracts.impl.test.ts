import { describe, expect, it } from "vitest";

import {
  chargeFailureCampaignBudgetV1,
  classifyExecutionFailureV1,
  createFailureCampaignBudgetAuthorityV1,
  FAILURE_REDUCTION_DEFAULT_POLICY_V1,
  FAILURE_REDUCTION_MAXIMUM_BUDGET_V1,
  getFailureCampaignBudgetSnapshotV1,
  parseFailureReductionPolicyV1,
} from "./index.js";

import type {
  ExecutionResultV1,
  ExecutionRoutePlanItemV1,
  FailureCampaignBudgetAuthorityV1,
  FailureReductionPolicyV1,
} from "./index.js";

const DIGEST = `sha256:${"a".repeat(64)}`;

function route(): ExecutionRoutePlanItemV1 {
  return {
    caseIdentity: DIGEST,
    ruleId: "rule.primary",
    obligation: "runtime-state",
    terminalTier: "vice",
    prerequisiteTiers: ["frontend", "compiler-api", "cli", "emit", "acme"],
    rankDigest: DIGEST,
  };
}

function failure(
  code: Extract<ExecutionResultV1, { status: "failure" }>["code"] = "semantic-mismatch",
  stage: Extract<ExecutionResultV1, { status: "failure" }>["stage"] = "compare",
): Extract<ExecutionResultV1, { status: "failure" }> {
  return {
    status: "failure",
    tier: "vice",
    stage,
    code,
    usage: {
      wallMs: 0,
      outputBytes: 0,
      evidenceBytes: 0,
      instructions: 0,
      cycles: 0,
      launchAttempts: 0,
    },
    evidence: { digest: DIGEST, retainedBytes: 0, truncated: false },
  };
}

function selectedPolicy(
  budget: Partial<FailureReductionPolicyV1["budget"]>,
): FailureReductionPolicyV1 {
  return {
    ...FAILURE_REDUCTION_DEFAULT_POLICY_V1,
    budget: { ...FAILURE_REDUCTION_DEFAULT_POLICY_V1.budget, ...budget },
  };
}

function requireAuthority(
  result: ReturnType<typeof createFailureCampaignBudgetAuthorityV1>,
): FailureCampaignBudgetAuthorityV1 {
  expect(result.ok).toBe(true);
  if (!result.ok) throw new TypeError(result.issues[0].message);
  return result.value;
}

describe("failure contract validation", () => {
  it("should preserve valid evidence for pass and route-relative mismatches", () => {
    const pass: ExecutionResultV1 = {
      ...failure(),
      status: "pass",
      code: "pass",
    };
    expect(classifyExecutionFailureV1(route(), pass)).toMatchObject({
      ok: true,
      value: { disposition: "unsupported", result: pass },
    });
    expect(
      classifyExecutionFailureV1({ ...route(), terminalTier: "acme" }, failure()),
    ).toMatchObject({
      ok: true,
      value: { disposition: "unsupported", cleanup: "cleanup-clear" },
    });
  });

  it("should omit unsafe evidence for extended and hostile values", () => {
    const extended = { ...failure(), extra: true };
    const classified = classifyExecutionFailureV1(route(), extended);
    expect(classified).toEqual({
      ok: true,
      value: {
        revision: "failure-disposition-v1",
        disposition: "unsupported",
        cleanup: "cleanup-clear",
      },
    });

    const hostileRoute = new Proxy(route(), {
      ownKeys() {
        throw new TypeError("must not escape");
      },
    });
    expect(() => classifyExecutionFailureV1(hostileRoute, failure())).not.toThrow();
    expect(classifyExecutionFailureV1(hostileRoute, failure())).toMatchObject({
      ok: true,
      value: { disposition: "unsupported" },
    });

    const hostileResult = new Proxy(failure(), {
      ownKeys() {
        throw new TypeError("must not escape");
      },
    });
    expect(classifyExecutionFailureV1(route(), hostileResult)).toMatchObject({
      ok: true,
      value: { disposition: "unsupported" },
    });
  });

  it("should reject malformed nested route and result evidence without retaining it", () => {
    const malformedValues = [
      { ...failure(), usage: { ...failure().usage, wallMs: -1 } },
      { ...failure(), evidence: { ...failure().evidence, digest: "invalid" } },
      { ...failure(), adapterSubcode: "" },
      {
        ...failure(),
        cleanupBlocker: { code: "emulator-lease-recovery-blocked", evidenceDigest: "invalid" },
      },
      { ...failure(), tier: "unknown" },
    ];
    for (const malformed of malformedValues) {
      expect(classifyExecutionFailureV1(route(), malformed)).toEqual({
        ok: true,
        value: {
          revision: "failure-disposition-v1",
          disposition: "unsupported",
          cleanup: "cleanup-clear",
        },
      });
    }
    expect(
      classifyExecutionFailureV1(
        { ...route(), prerequisiteTiers: ["frontend", "frontend"] },
        failure(),
      ),
    ).toMatchObject({ ok: true, value: { disposition: "unsupported" } });
  });

  it("should retain cleanup independently for supported and unsupported primary tuples", () => {
    const blocked: Extract<ExecutionResultV1, { status: "failure" }> = {
      ...failure("compiler-ice", "vice-launch"),
      cleanupBlocker: { code: "emulator-lease-recovery-blocked", evidenceDigest: DIGEST },
    };
    expect(classifyExecutionFailureV1(route(), blocked)).toMatchObject({
      ok: true,
      value: { disposition: "fresh-confirm", cleanup: "cleanup-blocked" },
    });
    expect(
      classifyExecutionFailureV1(route(), failure("assembler-failure", "input")),
    ).toMatchObject({ ok: true, value: { disposition: "unsupported", cleanup: "cleanup-clear" } });
  });

  it("should parse exact policies and reject revision, key, and maximum drift", () => {
    expect(parseFailureReductionPolicyV1(FAILURE_REDUCTION_DEFAULT_POLICY_V1)).toEqual({
      ok: true,
      value: FAILURE_REDUCTION_DEFAULT_POLICY_V1,
    });
    expect(
      parseFailureReductionPolicyV1({
        ...FAILURE_REDUCTION_DEFAULT_POLICY_V1,
        revision: "failure-reduction-policy-v2",
      }),
    ).toMatchObject({ ok: false });
    expect(
      parseFailureReductionPolicyV1({
        ...FAILURE_REDUCTION_DEFAULT_POLICY_V1,
        extra: true,
      }),
    ).toMatchObject({ ok: false });
    expect(
      parseFailureReductionPolicyV1(
        selectedPolicy({
          campaignOperations: FAILURE_REDUCTION_MAXIMUM_BUDGET_V1.campaignOperations + 1,
        }),
      ),
    ).toMatchObject({ ok: false });
    expect(
      parseFailureReductionPolicyV1({
        ...FAILURE_REDUCTION_DEFAULT_POLICY_V1,
        budget: { ...FAILURE_REDUCTION_DEFAULT_POLICY_V1.budget, extra: 1 },
      }),
    ).toMatchObject({ ok: false });
  });
});

describe("shared failure campaign budget", () => {
  it("should charge every closed operation kind through one authority", () => {
    const authority = requireAuthority(
      createFailureCampaignBudgetAuthorityV1(FAILURE_REDUCTION_DEFAULT_POLICY_V1, {
        nonPassResults: 1,
        resolvableNonPassResults: 1,
      }),
    );
    const charges = [
      { kind: "transformation-attempt" },
      { kind: "route-execution", purpose: "reduction" },
      { kind: "route-execution", purpose: "confirmation" },
      { kind: "route-execution", purpose: "control" },
      { kind: "oracle-evaluation" },
      { kind: "diagnostic-capture", bytes: 3 },
      { kind: "provenance-event-read" },
      { kind: "provenance-event-write" },
      { kind: "sequence-case" },
      { kind: "core-write", bytes: 5 },
      { kind: "terminal-envelope-write" },
      { kind: "terminal-run-write", bytes: 7 },
      { kind: "terminal-summary-write" },
    ] as const;
    for (const charge of charges) {
      expect(chargeFailureCampaignBudgetV1(authority, charge).ok).toBe(true);
    }
    expect(getFailureCampaignBudgetSnapshotV1(authority)).toMatchObject({
      ok: true,
      value: {
        used: {
          campaignOperations: charges.length,
          routeExecutions: 3,
          durableWrites: 5,
          coreBytes: 5,
          runBytes: 7,
        },
        terminalRemaining: { campaignOperations: 0, durableWrites: 0 },
      },
    });
    expect(
      chargeFailureCampaignBudgetV1(authority, { kind: "terminal-summary-write" }),
    ).toMatchObject({ ok: false });
  });

  it("should reserve terminal records while allowing exact ordinary aggregate capacity", () => {
    const authority = requireAuthority(
      createFailureCampaignBudgetAuthorityV1(
        selectedPolicy({ campaignOperations: 3, durableWrites: 1 }),
        { nonPassResults: 0, resolvableNonPassResults: 0 },
      ),
    );
    expect(chargeFailureCampaignBudgetV1(authority, { kind: "transformation-attempt" }).ok).toBe(
      true,
    );
    expect(chargeFailureCampaignBudgetV1(authority, { kind: "oracle-evaluation" }).ok).toBe(true);
    expect(chargeFailureCampaignBudgetV1(authority, { kind: "sequence-case" })).toMatchObject({
      ok: false,
    });
    expect(chargeFailureCampaignBudgetV1(authority, { kind: "terminal-summary-write" }).ok).toBe(
      true,
    );
  });

  it("should enforce core and run byte limits per complete record", () => {
    const authority = requireAuthority(
      createFailureCampaignBudgetAuthorityV1(
        selectedPolicy({
          campaignOperations: 5,
          durableWrites: 5,
          coreBytes: 3,
          runBytes: 3,
        }),
        { nonPassResults: 2, resolvableNonPassResults: 0 },
      ),
    );
    for (const charge of [
      { kind: "core-write", bytes: 3 },
      { kind: "core-write", bytes: 3 },
      { kind: "terminal-run-write", bytes: 3 },
      { kind: "terminal-run-write", bytes: 3 },
      { kind: "terminal-summary-write" },
    ] as const) {
      expect(chargeFailureCampaignBudgetV1(authority, charge).ok).toBe(true);
    }
    expect(getFailureCampaignBudgetSnapshotV1(authority)).toMatchObject({
      ok: true,
      value: { used: { coreBytes: 3, runBytes: 3 } },
    });

    const oversized = requireAuthority(
      createFailureCampaignBudgetAuthorityV1(
        selectedPolicy({ campaignOperations: 2, durableWrites: 2, runBytes: 3 }),
        { nonPassResults: 1, resolvableNonPassResults: 0 },
      ),
    );
    const before = getFailureCampaignBudgetSnapshotV1(oversized);
    expect(
      chargeFailureCampaignBudgetV1(oversized, { kind: "terminal-run-write", bytes: 4 }),
    ).toMatchObject({ ok: false });
    expect(getFailureCampaignBudgetSnapshotV1(oversized)).toEqual(before);
  });

  it("should reject undersized reservations, malformed charges, and copied authorities", () => {
    expect(
      createFailureCampaignBudgetAuthorityV1(
        selectedPolicy({ campaignOperations: 1, durableWrites: 1 }),
        { nonPassResults: 1, resolvableNonPassResults: 1 },
      ),
    ).toMatchObject({ ok: false });
    const authority = requireAuthority(
      createFailureCampaignBudgetAuthorityV1(FAILURE_REDUCTION_DEFAULT_POLICY_V1, {
        nonPassResults: 0,
        resolvableNonPassResults: 0,
      }),
    );
    expect(
      chargeFailureCampaignBudgetV1(authority, { kind: "diagnostic-capture", bytes: 0 }),
    ).toMatchObject({ ok: false });
    expect(chargeFailureCampaignBudgetV1(authority, { kind: "unknown" })).toMatchObject({
      ok: false,
    });
    expect(chargeFailureCampaignBudgetV1(authority, { kind: "unknown", bytes: 1 })).toMatchObject({
      ok: false,
    });
    expect(
      chargeFailureCampaignBudgetV1(authority, {
        kind: "diagnostic-capture",
        bytes: Number.MAX_SAFE_INTEGER,
      }),
    ).toMatchObject({ ok: false });
    expect(getFailureCampaignBudgetSnapshotV1(new Proxy(authority, {}))).toMatchObject({
      ok: false,
    });
    expect(
      createFailureCampaignBudgetAuthorityV1(
        { ...FAILURE_REDUCTION_DEFAULT_POLICY_V1, revision: "invalid" },
        { nonPassResults: 0, resolvableNonPassResults: 0 },
      ),
    ).toMatchObject({ ok: false });
    expect(
      createFailureCampaignBudgetAuthorityV1(FAILURE_REDUCTION_DEFAULT_POLICY_V1, {
        nonPassResults: 0,
        resolvableNonPassResults: 1,
      }),
    ).toMatchObject({ ok: false });
  });
});
