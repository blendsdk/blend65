import { execFile } from "node:child_process";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, it, vi } from "vitest";

type ExecutionTier = "frontend" | "compiler-api" | "cli" | "emit" | "acme" | "vice";

type ExecutionStage =
  | "input"
  | "capability"
  | "frontend"
  | "compiler-api"
  | "cli"
  | "emit"
  | "acme"
  | "vice-launch"
  | "vice-handshake"
  | "fixture"
  | "run"
  | "observe"
  | "compare"
  | "cleanup";

type ExecutionResultCode =
  | "pass"
  | "invalid-evidence-input"
  | "unbound-capability"
  | "execution-plan-capacity"
  | "tier-unavailable"
  | "diagnostic-mismatch"
  | "unexpected-emission"
  | "compiler-ice"
  | "emission-failure"
  | "assembler-failure"
  | "emulator-launch-failure"
  | "emulator-handshake-failure"
  | "instruction-exhaustion"
  | "cycle-exhaustion"
  | "wall-time-exhaustion"
  | "output-exhaustion"
  | "evidence-exhaustion"
  | "emulator-lease-recovery-blocked"
  | "semantic-mismatch";

interface ExecutionBudget {
  readonly operationMs: number;
  readonly launchAttemptMs: number;
  readonly routeMs: number;
  readonly cleanupGraceMs: number;
  readonly outputBytes: number;
  readonly evidenceBytes: number;
  readonly instructions: number;
  readonly cycles: number;
  readonly launchAttempts: number;
}

interface ExecutionPolicy {
  readonly revision: "execution-policy-v1";
  readonly budget: ExecutionBudget;
}

interface ExecutionUsage {
  readonly wallMs: number;
  readonly outputBytes: number;
  readonly evidenceBytes: number;
  readonly instructions: number;
  readonly cycles: number;
  readonly launchAttempts: number;
}

interface ExecutionEvidenceSummary {
  readonly digest: string;
  readonly retainedBytes: number;
  readonly truncated: boolean;
}

interface ExecutionCleanupBlocker {
  readonly code: "emulator-lease-recovery-blocked";
  readonly evidenceDigest: string;
}

interface ExecutionTerminalBase {
  readonly tier: ExecutionTier;
  readonly stage: ExecutionStage;
  readonly usage: ExecutionUsage;
  readonly evidence: ExecutionEvidenceSummary;
}

interface ExecutionTerminalCandidate {
  readonly stage: ExecutionStage;
  readonly code: Exclude<ExecutionResultCode, "pass">;
  readonly usage: ExecutionUsage;
  readonly evidence: ExecutionEvidenceSummary;
  readonly cleanupBlocker?: ExecutionCleanupBlocker;
}

type ExecutionResult =
  | {
      readonly status: "pass";
      readonly tier: ExecutionTier;
      readonly stage: ExecutionStage;
      readonly code: "pass";
      readonly usage: ExecutionUsage;
      readonly evidence: ExecutionEvidenceSummary;
    }
  | {
      readonly status: "failure";
      readonly tier: ExecutionTier;
      readonly stage: ExecutionStage;
      readonly code: Exclude<ExecutionResultCode, "pass">;
      readonly usage: ExecutionUsage;
      readonly evidence: ExecutionEvidenceSummary;
      readonly cleanupBlocker?: ExecutionCleanupBlocker;
    };

interface OperationIssue {
  readonly code: string;
  readonly path: string;
  readonly message: string;
}

type OperationResult<T> =
  | { readonly ok: true; readonly value: T }
  | { readonly ok: false; readonly issues: readonly [OperationIssue, ...OperationIssue[]] };

interface ExecutionContracts {
  readonly revision: "execution-contracts-v1";
  readonly tiers: readonly ExecutionTier[];
  readonly capabilities: readonly ExecutionTier[];
  readonly stages: readonly ExecutionStage[];
  readonly resultCodes: readonly ExecutionResultCode[];
  readonly policy: ExecutionPolicy;
}

interface CapabilityProjection {
  readonly capabilityId: ExecutionTier;
  readonly state: "bound";
}

interface RuleProjection {
  readonly ruleId: string;
  readonly applicability:
    | "mandatory-c64"
    | "not-applicable-c64"
    | "out-of-claim-target"
    | "blocked-errata";
  readonly evidenceObligations: readonly ExecutionTier[];
  readonly boundaryFamilyIds: readonly string[];
}

interface CompositeProjection {
  readonly parentDigest: string;
  readonly executionDigest: string;
  readonly capabilities: readonly CapabilityProjection[];
  readonly rules: readonly RuleProjection[];
}

interface PlanningCase {
  readonly caseIdentity: string;
  readonly ruleId: string;
  readonly validity: "valid" | "invalid";
  readonly spellingTuple: readonly string[];
  readonly boundaryFamilyId: string;
}

interface CampaignProjection {
  readonly revision: "execution-campaign-projection-v1";
  readonly campaignDigest: string;
  readonly cases: readonly PlanningCase[];
}

interface RoutePlanItem {
  readonly caseIdentity: string;
  readonly ruleId: string;
  readonly obligation: string;
  readonly terminalTier: ExecutionTier;
  readonly prerequisiteTiers: readonly ExecutionTier[];
  readonly rankDigest: string;
}

interface RoutePlan {
  readonly revision: "execution-route-plan-v1";
  readonly parentDigest: string;
  readonly campaignDigest: string;
  readonly oracleDigest: string;
  readonly policy: ExecutionPolicy;
  readonly items: readonly RoutePlanItem[];
  readonly digest: string;
}

interface PlanInput {
  readonly parent: CompositeProjection;
  readonly campaign: CampaignProjection;
  readonly oracleDigest: string;
  readonly policy: ExecutionPolicy;
}

interface ReadinessApi {
  readonly parseExecutionContractsV1: (input: unknown) => OperationResult<ExecutionContracts>;
  readonly parseExecutionPolicyV1: (input: unknown) => OperationResult<ExecutionPolicy>;
  readonly reduceExecutionTerminalV1: (
    base: ExecutionTerminalBase,
    candidates: readonly ExecutionTerminalCandidate[],
  ) => ExecutionResult;
  readonly serializeExecutionRoutePlanV1: (plan: RoutePlan) => Uint8Array;
}

interface ExecutionApi {
  readonly planExecutionRoutesV1: (input: unknown) => OperationResult<RoutePlan>;
}

const TIERS = ["frontend", "compiler-api", "cli", "emit", "acme", "vice"] as const;

const STAGES = [
  "input",
  "capability",
  "frontend",
  "compiler-api",
  "cli",
  "emit",
  "acme",
  "vice-launch",
  "vice-handshake",
  "fixture",
  "run",
  "observe",
  "compare",
  "cleanup",
] as const;

const RESULT_CODES = [
  "pass",
  "invalid-evidence-input",
  "unbound-capability",
  "execution-plan-capacity",
  "tier-unavailable",
  "diagnostic-mismatch",
  "unexpected-emission",
  "compiler-ice",
  "emission-failure",
  "assembler-failure",
  "emulator-launch-failure",
  "emulator-handshake-failure",
  "instruction-exhaustion",
  "cycle-exhaustion",
  "wall-time-exhaustion",
  "output-exhaustion",
  "evidence-exhaustion",
  "emulator-lease-recovery-blocked",
  "semantic-mismatch",
] as const;

const MAXIMUM_BUDGET: ExecutionBudget = {
  operationMs: 60_000,
  launchAttemptMs: 15_000,
  routeMs: 120_000,
  cleanupGraceMs: 3_000,
  outputBytes: 1_048_576,
  evidenceBytes: 16_777_216,
  instructions: 10_000_000,
  cycles: 100_000_000,
  launchAttempts: 8,
};

const POLICY: ExecutionPolicy = {
  revision: "execution-policy-v1",
  budget: MAXIMUM_BUDGET,
};

const ORACLE_DIGEST = digest("c");

function digest(character: string): string {
  return `sha256:${character.repeat(64)}`;
}

function indexedDigest(index: number): string {
  return `sha256:${index.toString(16).padStart(64, "0")}`;
}

function requireSuccess<T>(result: OperationResult<T>): T {
  expect(result.ok).toBe(true);
  if (!result.ok) {
    throw new TypeError(JSON.stringify(result.issues));
  }
  return result.value;
}

function expectFailure(result: OperationResult<unknown>, code?: string): void {
  expect(result.ok).toBe(false);
  if (result.ok) {
    throw new TypeError("expected a rejected operation");
  }
  if (code !== undefined) {
    expect(result.issues.some((issue) => issue.code === code)).toBe(true);
  }
  expect(result).not.toHaveProperty("value");
}

async function plannedApis(): Promise<{
  readonly readiness: ReadinessApi;
  readonly execution: ExecutionApi;
}> {
  const readiness = await vi.importActual<Partial<ReadinessApi>>("@blend65/readiness");
  const execution = await vi.importActual<Partial<ExecutionApi>>("./index.js");
  if (
    typeof readiness.parseExecutionContractsV1 !== "function" ||
    typeof readiness.parseExecutionPolicyV1 !== "function" ||
    typeof readiness.reduceExecutionTerminalV1 !== "function" ||
    typeof readiness.serializeExecutionRoutePlanV1 !== "function"
  ) {
    throw new TypeError("the passive execution contract exports are unavailable");
  }
  if (typeof execution.planExecutionRoutesV1 !== "function") {
    throw new TypeError("the execution route planner export is unavailable");
  }
  return {
    readiness: {
      parseExecutionContractsV1: readiness.parseExecutionContractsV1,
      parseExecutionPolicyV1: readiness.parseExecutionPolicyV1,
      reduceExecutionTerminalV1: readiness.reduceExecutionTerminalV1,
      serializeExecutionRoutePlanV1: readiness.serializeExecutionRoutePlanV1,
    },
    execution: { planExecutionRoutesV1: execution.planExecutionRoutesV1 },
  };
}

function completeContracts(): ExecutionContracts {
  return {
    revision: "execution-contracts-v1",
    tiers: [...TIERS].reverse(),
    capabilities: [...TIERS].reverse(),
    stages: [...STAGES].reverse(),
    resultCodes: [...RESULT_CODES].reverse(),
    policy: POLICY,
  };
}

function boundCapabilities(): readonly CapabilityProjection[] {
  return TIERS.map((capabilityId) => ({ capabilityId, state: "bound" }));
}

function rule(
  ruleId: string,
  obligation: ExecutionTier,
  boundaryFamilyIds: readonly string[] = ["ordinary"],
): RuleProjection {
  return {
    ruleId,
    applicability: "mandatory-c64",
    evidenceObligations: [obligation],
    boundaryFamilyIds,
  };
}

function planningCase(
  caseIdentity: string,
  ruleId: string,
  overrides: Partial<PlanningCase> = {},
): PlanningCase {
  return {
    caseIdentity,
    ruleId,
    validity: "valid",
    spellingTuple: ["literal"],
    boundaryFamilyId: "ordinary",
    ...overrides,
  };
}

function planInput(rules: readonly RuleProjection[], cases: readonly PlanningCase[]): PlanInput {
  return {
    parent: {
      parentDigest: digest("a"),
      executionDigest: digest("b"),
      capabilities: boundCapabilities(),
      rules,
    },
    campaign: {
      revision: "execution-campaign-projection-v1",
      campaignDigest: digest("d"),
      cases,
    },
    oracleDigest: ORACLE_DIGEST,
    policy: POLICY,
  };
}

function terminalBase(): ExecutionTerminalBase {
  return {
    tier: "vice",
    stage: "compare",
    usage: {
      wallMs: 40,
      outputBytes: 50,
      evidenceBytes: 60,
      instructions: 70,
      cycles: 80,
      launchAttempts: 1,
    },
    evidence: { digest: digest("e"), retainedBytes: 60, truncated: false },
  };
}

function candidate(
  stage: ExecutionStage,
  code: Exclude<ExecutionResultCode, "pass">,
  cleanupBlocker?: ExecutionCleanupBlocker,
): ExecutionTerminalCandidate {
  const base = terminalBase();
  return {
    stage,
    code,
    usage: base.usage,
    evidence: base.evidence,
    ...(cleanupBlocker === undefined ? {} : { cleanupBlocker }),
  };
}

function runChildVitest(outputPath: string): Promise<void> {
  const sourceDirectory = dirname(fileURLToPath(import.meta.url));
  const packageRoot = resolve(sourceDirectory, "..");
  const vitestCli = resolve(packageRoot, "../../node_modules/vitest/vitest.mjs");
  const specPath = fileURLToPath(import.meta.url);
  return new Promise((resolveChild, rejectChild) => {
    execFile(
      process.execPath,
      [vitestCli, "run", specPath, "-t", FRESH_PROCESS_TEST_NAME, "--reporter=dot"],
      {
        cwd: packageRoot,
        env: { ...process.env, BLEND65_ROUTE_PLAN_OUTPUT: outputPath },
      },
      (error, stdout, stderr) => {
        if (error === null) {
          resolveChild();
          return;
        }
        rejectChild(
          new Error(`fresh-process planner failed\n${stdout}\n${stderr}`, { cause: error }),
        );
      },
    );
  });
}

const FRESH_PROCESS_TEST_NAME =
  "produces byte-identical plans from the same passive inputs in fresh processes";

describe("closed execution contracts", () => {
  it("accepts and canonicalizes the complete closed contract vocabulary", async () => {
    const { readiness } = await plannedApis();
    const parsed = requireSuccess(readiness.parseExecutionContractsV1(completeContracts()));

    expect(parsed).toEqual({
      revision: "execution-contracts-v1",
      tiers: TIERS,
      capabilities: TIERS,
      stages: STAGES,
      resultCodes: RESULT_CODES,
      policy: POLICY,
    });
  });

  it("rejects unknown, duplicate, and non-exact contract members", async () => {
    const { readiness } = await plannedApis();
    const exact = completeContracts();
    const mutants: readonly unknown[] = [
      { ...exact, tiers: [...exact.tiers, "native"] },
      { ...exact, stages: [...exact.stages, "link"] },
      { ...exact, resultCodes: [...exact.resultCodes, "unknown-failure"] },
      { ...exact, capabilities: [...exact.capabilities, "frontend"] },
      { ...exact, extension: true },
    ];

    for (const mutant of mutants) {
      expectFailure(readiness.parseExecutionContractsV1(mutant));
    }
  });

  it("enforces every positive safe inclusive budget maximum before planning", async () => {
    const { readiness } = await plannedApis();
    const coherentMinimum: ExecutionPolicy = {
      revision: "execution-policy-v1",
      budget: {
        operationMs: 1,
        launchAttemptMs: 1,
        routeMs: 3_001,
        cleanupGraceMs: 3_000,
        outputBytes: 1,
        evidenceBytes: 1,
        instructions: 1,
        cycles: 1,
        launchAttempts: 1,
      },
    };
    expect(requireSuccess(readiness.parseExecutionPolicyV1(coherentMinimum))).toEqual(
      coherentMinimum,
    );

    for (const [field, maximum] of Object.entries(MAXIMUM_BUDGET)) {
      const accepted = {
        ...POLICY,
        budget: { ...MAXIMUM_BUDGET, [field]: maximum },
      };
      expect(requireSuccess(readiness.parseExecutionPolicyV1(accepted))).toEqual(accepted);

      const invalidValues = [0, -1, 1.5, Number.MAX_SAFE_INTEGER + 1, maximum + 1];
      for (const value of invalidValues) {
        expectFailure(
          readiness.parseExecutionPolicyV1({
            ...POLICY,
            budget: { ...MAXIMUM_BUDGET, [field]: value },
          }),
        );
      }
    }
  });
});

describe("deterministic route planning", () => {
  it(FRESH_PROCESS_TEST_NAME, async () => {
    const { readiness, execution } = await plannedApis();
    const input = planInput(
      [rule("rule.byte", "frontend")],
      [planningCase(digest("1"), "rule.byte")],
    );
    const childOutput = process.env.BLEND65_ROUTE_PLAN_OUTPUT;
    if (childOutput !== undefined) {
      const plan = requireSuccess(execution.planExecutionRoutesV1(input));
      const bytes = readiness.serializeExecutionRoutePlanV1(plan);
      await writeFile(
        childOutput,
        JSON.stringify({ digest: plan.digest, bytes: Buffer.from(bytes).toString("hex") }),
        "utf8",
      );
      return;
    }

    const temporaryRoot = await mkdtemp(resolve(tmpdir(), "blend65-route-plan-"));
    const firstPath = resolve(temporaryRoot, "first.json");
    const secondPath = resolve(temporaryRoot, "second.json");
    try {
      await runChildVitest(firstPath);
      await runChildVitest(secondPath);
      expect(await readFile(firstPath, "utf8")).toBe(await readFile(secondPath, "utf8"));
    } finally {
      await rm(temporaryRoot, { recursive: true });
    }
  });

  it("records exact prerequisites without exposing an adapter invocation seam", async () => {
    const { execution } = await plannedApis();
    const rules = [
      rule("rule.frontend", "frontend"),
      rule("rule.acme", "acme"),
      rule("rule.vice", "vice"),
    ];
    const input = planInput(rules, [
      planningCase(digest("1"), "rule.frontend"),
      planningCase(digest("2"), "rule.acme"),
      planningCase(digest("3"), "rule.vice"),
    ]);
    expect(Object.keys(input).sort()).toEqual(["campaign", "oracleDigest", "parent", "policy"]);

    const plan = requireSuccess(execution.planExecutionRoutesV1(input));
    const byRule = new Map(plan.items.map((item) => [item.ruleId, item]));
    expect(byRule.get("rule.frontend")).toMatchObject({
      terminalTier: "frontend",
      prerequisiteTiers: [],
    });
    expect(byRule.get("rule.acme")).toMatchObject({
      terminalTier: "acme",
      prerequisiteTiers: ["frontend", "compiler-api", "emit"],
    });
    expect(byRule.get("rule.vice")).toMatchObject({
      terminalTier: "vice",
      prerequisiteTiers: ["frontend", "compiler-api", "emit", "acme"],
    });
  });

  it("selects the same lexical strata after campaign input is shuffled", async () => {
    const { execution } = await plannedApis();
    const boundaryFamilies = ["lower", "upper"];
    const cases = ["valid", "invalid"].flatMap((validity, validityIndex) =>
      ["decimal", "hex"].flatMap((spelling) =>
        boundaryFamilies.map((boundary, ordinal) =>
          planningCase(
            indexedDigest(validityIndex * 4 + (spelling === "decimal" ? 0 : 2) + ordinal + 1),
            "rule.strata",
            {
              validity: validity === "valid" ? "valid" : "invalid",
              spellingTuple: [spelling],
              boundaryFamilyId: boundary,
            },
          ),
        ),
      ),
    );
    const rules = [rule("rule.strata", "acme", boundaryFamilies)];
    const first = requireSuccess(execution.planExecutionRoutesV1(planInput(rules, cases)));
    const second = requireSuccess(
      execution.planExecutionRoutesV1(planInput(rules, [...cases].reverse())),
    );

    expect(second).toEqual(first);
    const selected = first.items.filter((item) => item.obligation === "acme");
    const selectedCases = new Set(selected.map((item) => item.caseIdentity));
    const selectedStrata = new Set(
      cases
        .filter((entry) => selectedCases.has(entry.caseIdentity))
        .map(
          (entry) => `${entry.validity}/${entry.spellingTuple.join("+")}/${entry.boundaryFamilyId}`,
        ),
    );
    expect(selectedStrata).toEqual(
      new Set([
        "invalid/decimal/lower",
        "invalid/decimal/upper",
        "invalid/hex/lower",
        "invalid/hex/upper",
        "valid/decimal/lower",
        "valid/decimal/upper",
        "valid/hex/lower",
        "valid/hex/upper",
      ]),
    );
    expect(selected.every((item) => /^sha256:[0-9a-f]{64}$/u.test(item.rankDigest))).toBe(true);
  });

  it("selects a valid VICE case for every mandatory runtime rule", async () => {
    const { execution } = await plannedApis();
    const ruleIds = ["runtime.peek", "runtime.peekw", "runtime.poke", "runtime.pokew"];
    const rules = ruleIds.map((ruleId) => rule(ruleId, "vice"));
    const cases = ruleIds.flatMap((ruleId, index) => [
      planningCase(digest(String(index + 1)), ruleId, { validity: "invalid" }),
      planningCase(digest(String(index + 5)), ruleId),
    ]);
    const plan = requireSuccess(execution.planExecutionRoutesV1(planInput(rules, cases)));

    for (const ruleId of ruleIds) {
      const selected = plan.items.filter(
        (item) => item.ruleId === ruleId && item.terminalTier === "vice",
      );
      expect(selected.length).toBeGreaterThanOrEqual(1);
      expect(
        selected.some((item) => {
          const source = cases.find((entry) => entry.caseIdentity === item.caseIdentity);
          return source?.validity === "valid";
        }),
      ).toBe(true);
    }
  });

  it("fails without a partial plan when selection minima exceed either capacity", async () => {
    const { execution } = await plannedApis();
    const boundaries = Array.from({ length: 17 }, (_, index) => `boundary-${index}`);
    const perObligation = planInput(
      [rule("rule.overfull", "vice", boundaries)],
      boundaries.map((boundary, index) =>
        planningCase(indexedDigest(index + 1), "rule.overfull", {
          boundaryFamilyId: boundary,
        }),
      ),
    );
    expectFailure(execution.planExecutionRoutesV1(perObligation), "execution-plan-capacity");

    const campaignRules = Array.from({ length: 257 }, (_, index) =>
      rule(`rule.campaign-${index}`, "acme"),
    );
    const campaignCases = campaignRules.map((entry, index) =>
      planningCase(indexedDigest(index + 1_000), entry.ruleId),
    );
    expectFailure(
      execution.planExecutionRoutesV1(planInput(campaignRules, campaignCases)),
      "execution-plan-capacity",
    );
  });

  it("does not accept external outcomes as a heuristic planning input", async () => {
    const { execution } = await plannedApis();
    const input = planInput(
      [rule("rule.stable", "acme")],
      [planningCase(digest("9"), "rule.stable")],
    );
    const externalOutcomes = new Map([[digest("9"), "pass"]]);
    const first = requireSuccess(execution.planExecutionRoutesV1(input));
    externalOutcomes.set(digest("9"), "semantic-mismatch");
    const second = requireSuccess(execution.planExecutionRoutesV1(input));

    expect(externalOutcomes.get(digest("9"))).toBe("semantic-mismatch");
    expect(second).toEqual(first);
    expectFailure(execution.planExecutionRoutesV1({ ...input, priorOutcomes: externalOutcomes }));
  });
});

describe("terminal result reduction", () => {
  it("preserves a provisional pass when there are no terminal candidates", async () => {
    const { readiness } = await plannedApis();
    const base = terminalBase();
    expect(readiness.reduceExecutionTerminalV1(base, [])).toEqual({
      status: "pass",
      tier: base.tier,
      stage: base.stage,
      code: "pass",
      usage: base.usage,
      evidence: base.evidence,
    });
  });

  it("preserves the first pipeline failure and attaches cleanup evidence", async () => {
    const { readiness } = await plannedApis();
    const blocker: ExecutionCleanupBlocker = {
      code: "emulator-lease-recovery-blocked",
      evidenceDigest: digest("f"),
    };
    const result = readiness.reduceExecutionTerminalV1(terminalBase(), [
      candidate("compare", "semantic-mismatch"),
      candidate("run", "instruction-exhaustion", blocker),
    ]);
    expect(result).toMatchObject({
      status: "failure",
      stage: "run",
      code: "instruction-exhaustion",
      cleanupBlocker: blocker,
    });
  });

  it("turns an otherwise passing cleanup blocker into the primary failure", async () => {
    const { readiness } = await plannedApis();
    const blocker: ExecutionCleanupBlocker = {
      code: "emulator-lease-recovery-blocked",
      evidenceDigest: digest("f"),
    };
    expect(
      readiness.reduceExecutionTerminalV1(terminalBase(), [
        candidate("cleanup", "emulator-lease-recovery-blocked", blocker),
      ]),
    ).toMatchObject({
      status: "failure",
      stage: "cleanup",
      code: "emulator-lease-recovery-blocked",
      cleanupBlocker: blocker,
    });
  });

  it("gives instruction exhaustion precedence over simultaneous cycle exhaustion", async () => {
    const { readiness } = await plannedApis();
    const exhaustedUsage: ExecutionUsage = {
      ...terminalBase().usage,
      instructions: MAXIMUM_BUDGET.instructions,
      cycles: MAXIMUM_BUDGET.cycles,
    };
    const result = readiness.reduceExecutionTerminalV1(terminalBase(), [
      { ...candidate("run", "cycle-exhaustion"), usage: exhaustedUsage },
      { ...candidate("run", "instruction-exhaustion"), usage: exhaustedUsage },
    ]);
    expect(result).toMatchObject({
      status: "failure",
      stage: "run",
      code: "instruction-exhaustion",
      usage: exhaustedUsage,
    });
  });
});
