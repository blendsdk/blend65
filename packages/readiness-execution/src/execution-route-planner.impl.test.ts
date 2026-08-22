import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";

import { describe, expect, it } from "vitest";

import {
  EXECUTION_MAXIMUM_BUDGET_V1,
  serializeExecutionRoutePlanPreimageV1,
  type CompositeReadinessProjectionV1,
  type ExecutionCampaignProjectionV1,
  type ExecutionCapabilityProjectionV1,
  type ExecutionOperationResultV1,
  type ExecutionPlanningCaseV1,
  type ExecutionPolicyV1,
  type ExecutionRuleProjectionV1,
  type ExecutionTierV1,
} from "@blend65/readiness";

import { planExecutionRoutesV1 } from "./execution-route-planner.js";
import { compareExecutionTierV1 } from "./execution-route-tiers.js";

const TIERS: readonly ExecutionTierV1[] = [
  "frontend",
  "compiler-api",
  "cli",
  "emit",
  "acme",
  "vice",
];

const POLICY: ExecutionPolicyV1 = {
  revision: "execution-policy-v1",
  budget: EXECUTION_MAXIMUM_BUDGET_V1,
};

describe("execution tier ordering", () => {
  it("sorts known tiers and remains total for hostile runtime values", () => {
    expect(compareExecutionTierV1("frontend", "vice")).toBeLessThan(0);
    expect(
      Reflect.apply(compareExecutionTierV1, undefined, ["future", "frontend"]),
    ).toBeGreaterThan(0);
    expect(Reflect.apply(compareExecutionTierV1, undefined, ["frontend", "future"])).toBeLessThan(
      0,
    );
  });
});

function digest(character: string): string {
  return `sha256:${character.repeat(64)}`;
}

function indexedDigest(index: number): string {
  return `sha256:${index.toString(16).padStart(64, "0")}`;
}

function capabilities(unbound?: ExecutionTierV1): readonly ExecutionCapabilityProjectionV1[] {
  return TIERS.map((capabilityId) =>
    capabilityId === unbound
      ? {
          capabilityId,
          state: "unbound" as const,
          blocker: "unbound-evidence-capability" as const,
        }
      : { capabilityId, state: "bound" as const },
  );
}

function rule(
  ruleId = "rule.byte",
  obligations: readonly ExecutionTierV1[] = ["frontend"],
  boundaryFamilyIds: readonly string[] = ["ordinary"],
): ExecutionRuleProjectionV1 {
  return {
    ruleId,
    applicability: "mandatory-c64",
    evidenceObligations: obligations,
    boundaryFamilyIds,
  };
}

function planningCase(
  identity = digest("1"),
  ruleId = "rule.byte",
  overrides: Partial<ExecutionPlanningCaseV1> = {},
): ExecutionPlanningCaseV1 {
  return {
    caseIdentity: identity,
    ruleId,
    validity: "valid",
    spellingTuple: ["literal"],
    boundaryFamilyId: "ordinary",
    ...overrides,
  };
}

function input(
  rules: readonly ExecutionRuleProjectionV1[] = [rule()],
  cases: readonly ExecutionPlanningCaseV1[] = [planningCase()],
  capabilityRows: readonly ExecutionCapabilityProjectionV1[] = capabilities(),
): {
  readonly parent: CompositeReadinessProjectionV1;
  readonly campaign: ExecutionCampaignProjectionV1;
  readonly oracleDigest: string;
  readonly policy: ExecutionPolicyV1;
} {
  return {
    parent: {
      parentDigest: digest("a"),
      executionDigest: digest("b"),
      capabilities: capabilityRows,
      rules,
    },
    campaign: {
      revision: "execution-campaign-projection-v1",
      campaignDigest: digest("c"),
      cases,
    },
    oracleDigest: digest("d"),
    policy: POLICY,
  };
}

function requireSuccess<T>(result: ExecutionOperationResultV1<T>): T {
  expect(result.ok).toBe(true);
  if (!result.ok) throw new TypeError(JSON.stringify(result.issues));
  return result.value;
}

function expectFailure(result: ExecutionOperationResultV1<unknown>, code?: string): void {
  expect(result.ok).toBe(false);
  if (result.ok) throw new TypeError("expected planner failure");
  if (code !== undefined) expect(result.issues.some((issue) => issue.code === code)).toBe(true);
}

describe("route planner input closure", () => {
  it("should reject hostile top-level records without invoking accessors", () => {
    let invoked = false;
    const accessor = {
      get parent(): unknown {
        invoked = true;
        return input().parent;
      },
      campaign: input().campaign,
      oracleDigest: digest("d"),
      policy: POLICY,
    };
    const proxy = new Proxy(input(), {
      ownKeys(): never {
        throw new Error("hostile ownKeys");
      },
    });

    expectFailure(planExecutionRoutesV1(accessor));
    expectFailure(planExecutionRoutesV1(proxy));
    expectFailure(planExecutionRoutesV1(null));
    expectFailure(planExecutionRoutesV1({ ...input(), extra: true }));
    expect(invoked).toBe(false);
  });

  it("should reject malformed parent digests and capability sets", () => {
    const valid = input();
    const mutants: readonly unknown[] = [
      { ...valid, parent: { ...valid.parent, parentDigest: "SHA256:bad" } },
      { ...valid, parent: { ...valid.parent, executionDigest: digest("A") } },
      { ...valid, parent: { ...valid.parent, capabilities: capabilities().slice(1) } },
      {
        ...valid,
        parent: {
          ...valid.parent,
          capabilities: [...capabilities().slice(0, 5), capabilities()[0]],
        },
      },
      {
        ...valid,
        parent: {
          ...valid.parent,
          capabilities: capabilities().map((entry, index) =>
            index === 0 ? { ...entry, extension: true } : entry,
          ),
        },
      },
      {
        ...valid,
        parent: {
          ...valid.parent,
          capabilities: capabilities().map((entry, index) =>
            index === 0
              ? { capabilityId: "frontend", state: "bound", blocker: "unbound-evidence-capability" }
              : entry,
          ),
        },
      },
      {
        ...valid,
        parent: {
          ...valid.parent,
          capabilities: capabilities().map((entry, index) =>
            index === 0 ? { capabilityId: "frontend", state: "unbound" } : entry,
          ),
        },
      },
      { ...valid, parent: { ...valid.parent, capabilities: "all" } },
    ];
    for (const mutant of mutants) expectFailure(planExecutionRoutesV1(mutant));
  });

  it("should reject malformed and duplicate rule declarations", () => {
    const valid = input();
    const invalidRules: readonly unknown[] = [
      { ...rule(), ruleId: "bad rule" },
      { ...rule(), applicability: "optional" },
      { ...rule(), evidenceObligations: [] },
      { ...rule(), evidenceObligations: ["frontend", "frontend"] },
      { ...rule(), evidenceObligations: ["native"] },
      { ...rule(), boundaryFamilyIds: [] },
      { ...rule(), boundaryFamilyIds: ["ordinary", "ordinary"] },
      { ...rule(), boundaryFamilyIds: ["bad boundary"] },
      { ...rule(), extension: true },
    ];
    for (const invalidRule of invalidRules) {
      expectFailure(
        planExecutionRoutesV1({
          ...valid,
          parent: { ...valid.parent, rules: [invalidRule] },
        }),
      );
    }
    expectFailure(
      planExecutionRoutesV1({
        ...valid,
        parent: { ...valid.parent, rules: [rule(), rule()] },
      }),
    );
  });

  it("should reject malformed campaign and case projections", () => {
    const valid = input();
    const invalidCases: readonly unknown[] = [
      { ...planningCase(), caseIdentity: "bad" },
      { ...planningCase(), ruleId: "bad rule" },
      { ...planningCase(), validity: "unknown" },
      { ...planningCase(), spellingTuple: [] },
      { ...planningCase(), spellingTuple: ["bad spelling"] },
      { ...planningCase(), boundaryFamilyId: "other" },
      { ...planningCase(), extension: true },
    ];
    for (const invalidCase of invalidCases) {
      expectFailure(
        planExecutionRoutesV1({
          ...valid,
          campaign: { ...valid.campaign, cases: [invalidCase] },
        }),
      );
    }
    const campaignMutants: readonly unknown[] = [
      { ...valid, campaign: { ...valid.campaign, revision: "future" } },
      { ...valid, campaign: { ...valid.campaign, campaignDigest: "bad" } },
      { ...valid, campaign: { ...valid.campaign, cases: "all" } },
      {
        ...valid,
        campaign: {
          ...valid.campaign,
          cases: [planningCase(), planningCase()],
        },
      },
    ];
    for (const mutant of campaignMutants) expectFailure(planExecutionRoutesV1(mutant));
  });

  it("should reject invalid policy, oracle, outcomes, and selected unbound capability", () => {
    const valid = input();
    expectFailure(planExecutionRoutesV1({ ...valid, oracleDigest: "bad" }));
    const invalidPolicy = planExecutionRoutesV1({
      ...valid,
      policy: { ...POLICY, budget: { ...POLICY.budget, routeMs: 3_000 } },
    });
    expectFailure(invalidPolicy);
    if (!invalidPolicy.ok) expect(invalidPolicy.issues[0].path).toBe("/policy/budget/routeMs");
    expectFailure(planExecutionRoutesV1({ ...valid, priorOutcomes: [] }));
    expectFailure(
      planExecutionRoutesV1(
        input([rule("rule.byte", ["acme"])], [planningCase()], capabilities("acme")),
      ),
      "unbound-capability",
    );
    const missingPrerequisite = planExecutionRoutesV1(
      input([rule("rule.byte", ["acme"])], [planningCase()], capabilities("frontend")),
    );
    expectFailure(missingPrerequisite, "unbound-capability");
    if (!missingPrerequisite.ok) {
      expect(missingPrerequisite.issues[0].path).toBe("/parent/capabilities/0/state");
    }

    const reversedCapabilities = planExecutionRoutesV1(
      input(
        [rule("rule.byte", ["acme"])],
        [planningCase()],
        [...capabilities("frontend")].reverse(),
      ),
    );
    expectFailure(reversedCapabilities, "unbound-capability");
    if (!reversedCapabilities.ok) {
      expect(reversedCapabilities.issues[0].path).toBe("/parent/capabilities/5/state");
    }
  });

  it("should accept empty non-runtime campaigns and reject missing mandatory VICE candidates", () => {
    const plan = requireSuccess(
      planExecutionRoutesV1(input([rule("rule.unrepresented", ["frontend"])], [])),
    );
    expect(plan.items).toEqual([]);
    const missingVice = planExecutionRoutesV1(input([rule("rule.runtime", ["vice"])], []));
    expectFailure(missingVice, "execution-plan-capacity");
    if (!missingVice.ok) {
      expect(missingVice.issues[0].path).toBe("/parent/rules/0/evidenceObligations/0");
    }
  });
});

describe("route planner deterministic selection", () => {
  it("should preserve every independent stratum across a tenfold shuffled population", () => {
    const boundaries = ["lower", "upper"];
    const spellings = ["decimal", "hex"];
    const cases = Array.from({ length: 80 }, (_, index) =>
      planningCase(indexedDigest(index + 1), "rule.population", {
        validity: index % 2 === 0 ? "valid" : "invalid",
        spellingTuple: [spellings[Math.floor(index / 2) % spellings.length] ?? "decimal"],
        boundaryFamilyId: boundaries[Math.floor(index / 4) % boundaries.length] ?? "lower",
      }),
    );
    const rules = [
      rule("rule.population", ["frontend", "compiler-api", "emit", "acme", "vice"], boundaries),
    ];
    const first = requireSuccess(planExecutionRoutesV1(input(rules, cases)));
    const shuffled = requireSuccess(planExecutionRoutesV1(input(rules, [...cases].reverse())));

    expect(shuffled).toEqual(first);
    expect(first.items.filter((item) => item.obligation === "frontend")).toHaveLength(80);
    for (const obligation of ["compiler-api", "emit", "acme", "vice"] as const) {
      expect(first.items.filter((item) => item.obligation === obligation)).toHaveLength(8);
    }
  });

  it("should rank same-stratum candidates independently for each obligation", () => {
    const cases = Array.from({ length: 10 }, (_, index) =>
      planningCase(indexedDigest(index + 200), "rule.independent"),
    );
    const plan = requireSuccess(
      planExecutionRoutesV1(
        input([rule("rule.independent", ["frontend", "compiler-api", "emit"])], cases),
      ),
    );
    const compiler = plan.items.find((item) => item.obligation === "compiler-api");
    const emit = plan.items.find((item) => item.obligation === "emit");
    expect(compiler?.rankDigest).toMatch(/^sha256:[0-9a-f]{64}$/u);
    expect(emit?.rankDigest).toMatch(/^sha256:[0-9a-f]{64}$/u);
    expect(compiler?.rankDigest).not.toBe(emit?.rankDigest);
  });

  it("should fail when a mandatory VICE population has no valid candidate", () => {
    expectFailure(
      planExecutionRoutesV1(
        input(
          [rule("rule.runtime", ["frontend", "vice"])],
          [planningCase(digest("8"), "rule.runtime", { validity: "invalid" })],
        ),
      ),
      "execution-plan-capacity",
    );
  });

  it("should resolve capacity pointers against shuffled source rule and obligation rows", () => {
    const boundaries = Array.from({ length: 17 }, (_, index) => `boundary-${index}`);
    const cases = boundaries.map((boundaryFamilyId, index) =>
      planningCase(indexedDigest(index + 500), "rule.z-overfull", { boundaryFamilyId }),
    );
    const result = planExecutionRoutesV1(
      input(
        [rule("rule.z-overfull", ["vice", "frontend"], boundaries), rule("rule.a", ["frontend"])],
        cases,
      ),
    );
    expectFailure(result, "execution-plan-capacity");
    if (!result.ok) {
      expect(result.issues[0].path).toBe("/parent/rules/0/evidenceObligations/0");
    }
  });

  it("should keep CLI evidence distinct from compiler and emission routes", () => {
    const plan = requireSuccess(
      planExecutionRoutesV1(
        input([rule("rule.cli", ["cli"])], [planningCase(digest("9"), "rule.cli")]),
      ),
    );
    expect(plan.items).toEqual([
      expect.objectContaining({
        obligation: "cli",
        terminalTier: "cli",
        prerequisiteTiers: ["frontend"],
      }),
    ]);
  });

  it("should digest the exact shared canonical plan preimage", () => {
    const plan = requireSuccess(planExecutionRoutesV1(input()));
    const { digest: actualDigest, ...preimage } = plan;
    const expectedDigest = `sha256:${createHash("sha256")
      .update(serializeExecutionRoutePlanPreimageV1(preimage))
      .digest("hex")}`;
    expect(actualDigest).toBe(expectedDigest);
  });

  it("should retain linear uniqueness and one-pass rule indexing at campaign scale", async () => {
    const cases = Array.from({ length: 10_000 }, (_, index) =>
      planningCase(indexedDigest(index + 10_000), "rule.scale"),
    );
    const plan = requireSuccess(
      planExecutionRoutesV1(input([rule("rule.scale", ["frontend"])], cases)),
    );
    expect(plan.items).toHaveLength(10_000);

    const selectorSource = await readFile(
      new URL("./execution-selector.ts", import.meta.url),
      "utf8",
    );
    expect(selectorSource).toContain("indexCasesByRule(input.cases)");
    expect(selectorSource).not.toContain("input.cases.filter");
    expect(selectorSource.indexOf("preflightSelectionCapacityV1(input")).toBeLessThan(
      selectorSource.indexOf("materializeExecutionRoutesV1(input"),
    );
  });
});
