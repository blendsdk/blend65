import {
  createIdentityCollisionRegistry,
  type ExecutionOperationResultV1,
  type ExecutionResultCodeV1,
  type ExecutionResultV1,
  type ExecutionRoutePlanItemV1,
  type ExecutionStageV1,
  type ExecutionTierV1,
  type IdentityCollisionRegistry,
  type Sha256Digest,
} from "@blend65/readiness";
import { describe, expect, it, vi } from "vitest";

/** Closed failure handling selected from an authenticated execution result. */
type FailureDispositionV1 = "direct-shrink" | "fresh-confirm" | "campaign-only" | "unsupported";

/** Cleanup state retained independently from the primary failure class. */
type CleanupDispositionV1 = "cleanup-clear" | "cleanup-blocked";

/** Every bounded resource shared by one reduction campaign. */
interface FailureReductionBudgetV1 {
  readonly campaignOperations: number;
  readonly transformationAttempts: number;
  readonly routeExecutions: number;
  readonly oracleEvaluations: number;
  readonly diagnosticBytes: number;
  readonly provenanceEvents: number;
  readonly sequenceCases: number;
  readonly durableWrites: number;
  readonly coreBytes: number;
  readonly runBytes: number;
}

/** Versioned immutable reduction policy. */
interface FailureReductionPolicyV1 {
  readonly revision: "failure-reduction-policy-v1";
  readonly dispositionRevision: "failure-disposition-v1";
  readonly catalogRevision: "failure-reduction-catalog-v1";
  readonly normalizationRevision: "failure-normalization-v1";
  readonly budget: FailureReductionBudgetV1;
}

/** Successful failure classification with independent cleanup state. */
interface ClassifiedFailureV1 {
  readonly revision: "failure-disposition-v1";
  readonly disposition: FailureDispositionV1;
  readonly cleanup: CleanupDispositionV1;
  readonly result: ExecutionResultV1;
}

/** Observation identity included in a canonical failure predicate. */
type FailureObservationIdentityV1 =
  | { readonly kind: "observed"; readonly digest: Sha256Digest }
  | {
      readonly kind: "not-reached";
      readonly stage: ExecutionStageV1;
      readonly terminalReasonDigest: Sha256Digest;
    };

/** Route facts that determine whether the same failure was reproduced. */
interface FailureRouteContractV1 {
  readonly originalRouteKind: "valid-envelope" | "invalid-diagnostic";
  readonly terminalTier: ExecutionTierV1;
  readonly obligation: string;
  readonly prerequisiteTiers: readonly ExecutionTierV1[];
  readonly policyDigest: Sha256Digest;
  readonly fixtureDigest: Sha256Digest;
  readonly oracleContractDigest: Sha256Digest;
  readonly toolContractDigests: readonly Sha256Digest[];
}

/** Complete semantic identity of one reproducible failure. */
interface FailurePredicateV1 {
  readonly revision: "failure-predicate-v1";
  readonly resultCode: Exclude<ExecutionResultCodeV1, "pass">;
  readonly terminalTier: ExecutionTierV1;
  readonly terminalStage: ExecutionStageV1;
  readonly observation: FailureObservationIdentityV1;
  readonly cleanup: CleanupDispositionV1;
  readonly primaryRuleId: string;
  readonly requiredClaimedRuleIds: readonly string[];
  readonly target: "c64";
  readonly routeContract: FailureRouteContractV1;
}

/** Canonical bytes and digest derived from a closed failure predicate. */
interface FailurePredicateIdentityV1 {
  readonly revision: "failure-predicate-identity-v1";
  readonly predicate: FailurePredicateV1;
  readonly canonicalBytes: Uint8Array;
  readonly digest: Sha256Digest;
}

/** Stable promotion key for minimized content and its complete predicate. */
interface PromotedFailureKeyV1 {
  readonly revision: "promoted-failure-key-v1";
  readonly normalizationRevision: "failure-normalization-v1";
  readonly minimizedContentDigest: Sha256Digest;
  readonly predicateDigest: Sha256Digest;
  readonly digest: Sha256Digest;
}

/** Inputs that intentionally make one reduction run distinct. */
interface FailureReductionRunIdentityInputV1 {
  readonly historicalEnvelopeDigest: Sha256Digest;
  readonly predicateDigest: Sha256Digest;
  readonly policy: FailureReductionPolicyV1;
  readonly traceDigest: Sha256Digest;
}

/** Canonical identity of one policy-selected reduction run. */
interface FailureReductionRunIdentityV1 {
  readonly revision: "failure-reduction-run-identity-v1";
  readonly digest: Sha256Digest;
}

/** Terminal record population reserved before campaign work starts. */
interface FailureCampaignBudgetReservationV1 {
  readonly nonPassResults: number;
  readonly resolvableNonPassResults: number;
}

/** One atomic campaign budget charge. */
type FailureCampaignBudgetChargeV1 =
  | { readonly kind: "transformation-attempt" }
  | {
      readonly kind: "route-execution";
      readonly purpose: "reduction" | "confirmation" | "control";
    }
  | { readonly kind: "oracle-evaluation" }
  | { readonly kind: "diagnostic-capture"; readonly bytes: number }
  | { readonly kind: "provenance-event-read" }
  | { readonly kind: "sequence-case" }
  | { readonly kind: "core-write"; readonly bytes: number }
  | { readonly kind: "terminal-envelope-write" }
  | { readonly kind: "terminal-run-write"; readonly bytes: number }
  | { readonly kind: "terminal-summary-write" };

/** Aggregate usage and protected terminal capacity after an atomic charge. */
interface FailureCampaignBudgetSnapshotV1 {
  readonly revision: "failure-campaign-budget-snapshot-v1";
  readonly used: FailureReductionBudgetV1;
  readonly terminalRemaining: {
    readonly campaignOperations: number;
    readonly durableWrites: number;
    readonly envelopes: number;
    readonly runs: number;
    readonly summaries: number;
  };
}

/** Opaque authority shared by every case in one campaign. */
type FailureCampaignBudgetAuthorityV1 = object;

/** Planned public failure-reduction surface exercised by this specification. */
interface FailureReadinessApi {
  readonly FAILURE_REDUCTION_DEFAULT_POLICY_V1: FailureReductionPolicyV1;
  readonly FAILURE_REDUCTION_MAXIMUM_BUDGET_V1: Readonly<FailureReductionBudgetV1>;
  readonly classifyExecutionFailureV1: (
    route: ExecutionRoutePlanItemV1,
    result: ExecutionResultV1,
  ) => ExecutionOperationResultV1<ClassifiedFailureV1>;
  readonly parseFailureReductionPolicyV1: (
    input: unknown,
  ) => ExecutionOperationResultV1<FailureReductionPolicyV1>;
  readonly deriveFailurePredicateIdentityV1: (
    input: unknown,
    registry?: IdentityCollisionRegistry,
  ) => ExecutionOperationResultV1<FailurePredicateIdentityV1>;
  readonly derivePromotedFailureKeyV1: (
    minimizedContentDigest: unknown,
    predicate: unknown,
    registry?: IdentityCollisionRegistry,
  ) => ExecutionOperationResultV1<PromotedFailureKeyV1>;
  readonly deriveFailureReductionRunIdentityV1: (
    input: unknown,
    registry?: IdentityCollisionRegistry,
  ) => ExecutionOperationResultV1<FailureReductionRunIdentityV1>;
  readonly createFailureCampaignBudgetAuthorityV1: (
    policy: unknown,
    reservation: unknown,
  ) => ExecutionOperationResultV1<FailureCampaignBudgetAuthorityV1>;
  readonly chargeFailureCampaignBudgetV1: (
    authority: FailureCampaignBudgetAuthorityV1,
    charge: unknown,
  ) => ExecutionOperationResultV1<FailureCampaignBudgetSnapshotV1>;
  readonly getFailureCampaignBudgetSnapshotV1: (
    authority: FailureCampaignBudgetAuthorityV1,
  ) => ExecutionOperationResultV1<FailureCampaignBudgetSnapshotV1>;
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

const DEFAULT_BUDGET: FailureReductionBudgetV1 = {
  campaignOperations: 16_384,
  transformationAttempts: 1_024,
  routeExecutions: 1_024,
  oracleEvaluations: 2_048,
  diagnosticBytes: 262_144,
  provenanceEvents: 256,
  sequenceCases: 8,
  durableWrites: 32_768,
  coreBytes: 16_777_216,
  runBytes: 67_108_864,
};

const MAXIMUM_BUDGET: FailureReductionBudgetV1 = {
  campaignOperations: 65_536,
  transformationAttempts: 4_096,
  routeExecutions: 4_096,
  oracleEvaluations: 8_192,
  diagnosticBytes: 1_048_576,
  provenanceEvents: 4_096,
  sequenceCases: 64,
  durableWrites: 65_536,
  coreBytes: 67_108_864,
  runBytes: 268_435_456,
};

const POLICY: FailureReductionPolicyV1 = {
  revision: "failure-reduction-policy-v1",
  dispositionRevision: "failure-disposition-v1",
  catalogRevision: "failure-reduction-catalog-v1",
  normalizationRevision: "failure-normalization-v1",
  budget: DEFAULT_BUDGET,
};

const ALLOWED_STAGES: Readonly<
  Record<Exclude<ExecutionResultCodeV1, "pass">, readonly ExecutionStageV1[]>
> = {
  "invalid-evidence-input": ["input", "vice-launch", "fixture", "observe", "compare"],
  "unbound-capability": ["capability"],
  "execution-plan-capacity": ["capability"],
  "tier-unavailable": ["capability", "acme", "vice-launch"],
  "diagnostic-mismatch": ["frontend", "compiler-api", "cli", "emit"],
  "unexpected-emission": ["frontend", "compiler-api", "cli", "emit"],
  "compiler-ice": ["frontend", "compiler-api", "cli", "emit", "acme", "vice-launch"],
  "emission-failure": ["emit"],
  "assembler-failure": ["acme"],
  "emulator-launch-failure": ["vice-launch"],
  "emulator-handshake-failure": ["vice-handshake", "fixture", "run"],
  "instruction-exhaustion": ["run"],
  "cycle-exhaustion": ["run"],
  "wall-time-exhaustion": [
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
  ],
  "output-exhaustion": [
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
  ],
  "evidence-exhaustion": [
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
  ],
  "emulator-lease-recovery-blocked": ["vice-launch", "cleanup"],
  "semantic-mismatch": ["fixture", "observe", "compare"],
};

const DISPOSITIONS: Readonly<
  Record<Exclude<ExecutionResultCodeV1, "pass">, Exclude<FailureDispositionV1, "unsupported">>
> = {
  "diagnostic-mismatch": "direct-shrink",
  "unexpected-emission": "direct-shrink",
  "semantic-mismatch": "direct-shrink",
  "compiler-ice": "fresh-confirm",
  "emission-failure": "fresh-confirm",
  "assembler-failure": "fresh-confirm",
  "emulator-launch-failure": "fresh-confirm",
  "emulator-handshake-failure": "fresh-confirm",
  "instruction-exhaustion": "fresh-confirm",
  "cycle-exhaustion": "fresh-confirm",
  "wall-time-exhaustion": "fresh-confirm",
  "output-exhaustion": "fresh-confirm",
  "evidence-exhaustion": "fresh-confirm",
  "invalid-evidence-input": "campaign-only",
  "unbound-capability": "campaign-only",
  "execution-plan-capacity": "campaign-only",
  "tier-unavailable": "campaign-only",
  "emulator-lease-recovery-blocked": "campaign-only",
};

const ZERO_USAGE = Object.freeze({
  wallMs: 0,
  outputBytes: 0,
  evidenceBytes: 0,
  instructions: 0,
  cycles: 0,
  launchAttempts: 0,
});
const EVIDENCE = Object.freeze({
  digest: `sha256:${"e".repeat(64)}`,
  retainedBytes: 0,
  truncated: false,
});

function digest(character: string): Sha256Digest {
  return `sha256:${character.repeat(64)}`;
}

function requireSuccess<T>(result: ExecutionOperationResultV1<T>): T {
  expect(result.ok).toBe(true);
  if (!result.ok) throw new TypeError(result.issues.map((issue) => issue.code).join(","));
  return result.value;
}

function expectFailure(result: ExecutionOperationResultV1<unknown>): void {
  expect(result.ok).toBe(false);
  expect(result).not.toHaveProperty("value");
}

async function plannedApi(): Promise<FailureReadinessApi> {
  const api = await vi.importActual<Partial<FailureReadinessApi>>("@blend65/readiness");
  const requiredFunctions = [
    "classifyExecutionFailureV1",
    "parseFailureReductionPolicyV1",
    "deriveFailurePredicateIdentityV1",
    "derivePromotedFailureKeyV1",
    "deriveFailureReductionRunIdentityV1",
    "createFailureCampaignBudgetAuthorityV1",
    "chargeFailureCampaignBudgetV1",
    "getFailureCampaignBudgetSnapshotV1",
  ] as const;
  const missing: string[] = requiredFunctions.filter((name) => typeof api[name] !== "function");
  if (api.FAILURE_REDUCTION_DEFAULT_POLICY_V1 === undefined) {
    missing.push("FAILURE_REDUCTION_DEFAULT_POLICY_V1");
  }
  if (api.FAILURE_REDUCTION_MAXIMUM_BUDGET_V1 === undefined) {
    missing.push("FAILURE_REDUCTION_MAXIMUM_BUDGET_V1");
  }
  if (missing.length > 0) {
    throw new TypeError(
      `the failure reduction public surface is unavailable: ${missing.join(",")}`,
    );
  }
  return api as FailureReadinessApi;
}

function route(terminalTier: ExecutionTierV1): ExecutionRoutePlanItemV1 {
  const terminalIndex = TIERS.indexOf(terminalTier);
  return {
    caseIdentity: digest("1"),
    ruleId: "rule.primary",
    obligation: terminalTier,
    terminalTier,
    prerequisiteTiers: TIERS.slice(0, terminalIndex),
    rankDigest: digest("2"),
  };
}

function result(
  code: ExecutionResultCodeV1,
  tier: ExecutionTierV1,
  stage: ExecutionStageV1,
  cleanupBlocked = false,
): ExecutionResultV1 {
  if (code === "pass") {
    return { status: "pass", tier, stage, code, usage: ZERO_USAGE, evidence: EVIDENCE };
  }
  return {
    status: "failure",
    tier,
    stage,
    code,
    usage: ZERO_USAGE,
    evidence: EVIDENCE,
    ...(cleanupBlocked
      ? {
          cleanupBlocker: {
            code: "emulator-lease-recovery-blocked" as const,
            evidenceDigest: digest("f"),
          },
        }
      : {}),
  };
}

function stageOwner(stage: ExecutionStageV1): ExecutionTierV1 | undefined {
  if (stage === "input" || stage === "capability") return undefined;
  if (
    ["vice-launch", "vice-handshake", "fixture", "run", "observe", "compare", "cleanup"].includes(
      stage,
    )
  ) {
    return "vice";
  }
  return stage as ExecutionTierV1;
}

function expectedDisposition(
  plannedRoute: ExecutionRoutePlanItemV1,
  executionResult: ExecutionResultV1,
): FailureDispositionV1 {
  if (executionResult.code === "pass" || executionResult.tier !== plannedRoute.terminalTier) {
    return "unsupported";
  }
  const owner = stageOwner(executionResult.stage);
  const routePrefix = [...plannedRoute.prerequisiteTiers, plannedRoute.terminalTier];
  const reachable = owner === undefined || routePrefix.includes(owner);
  return reachable && ALLOWED_STAGES[executionResult.code].includes(executionResult.stage)
    ? DISPOSITIONS[executionResult.code]
    : "unsupported";
}

function predicate(overrides: Partial<FailurePredicateV1> = {}): FailurePredicateV1 {
  return {
    revision: "failure-predicate-v1",
    resultCode: "semantic-mismatch",
    terminalTier: "vice",
    terminalStage: "compare",
    observation: { kind: "observed", digest: digest("3") },
    cleanup: "cleanup-clear",
    primaryRuleId: "rule.primary",
    requiredClaimedRuleIds: ["rule.claimed-a", "rule.claimed-b"],
    target: "c64",
    routeContract: {
      originalRouteKind: "valid-envelope",
      terminalTier: "vice",
      obligation: "vice",
      prerequisiteTiers: ["frontend", "compiler-api", "emit", "acme"],
      policyDigest: digest("4"),
      fixtureDigest: digest("5"),
      oracleContractDigest: digest("6"),
      toolContractDigests: [digest("7"), digest("8")],
    },
    ...overrides,
  };
}

function policyWithBudget(changes: Partial<FailureReductionBudgetV1>): FailureReductionPolicyV1 {
  return { ...POLICY, budget: { ...DEFAULT_BUDGET, ...changes } };
}

describe("failure disposition and cleanup", () => {
  it("classifies every known code, tier, and stage only when authenticated route facts allow it", async () => {
    const api = await plannedApi();

    for (const terminalTier of TIERS) {
      const plannedRoute = route(terminalTier);
      for (const code of RESULT_CODES) {
        for (const tier of TIERS) {
          for (const stage of STAGES) {
            const executionResult = result(code, tier, stage);
            const classified = requireSuccess(
              api.classifyExecutionFailureV1(plannedRoute, executionResult),
            );
            expect(classified).toMatchObject({
              revision: "failure-disposition-v1",
              disposition: expectedDisposition(plannedRoute, executionResult),
              cleanup: "cleanup-clear",
              result: executionResult,
            });
          }
        }
      }
    }
  });

  it("fails closed for unknown or extended results and for stages outside the route prefix", async () => {
    const api = await plannedApi();
    const validRoute = route("vice");
    const validResult = result("semantic-mismatch", "vice", "compare");
    const mutants: readonly [unknown, unknown][] = [
      [validRoute, { ...validResult, code: "new-failure" }],
      [validRoute, { ...validResult, stage: "link" }],
      [{ ...validRoute, terminalTier: "native" }, validResult],
      [{ ...validRoute, extension: true }, validResult],
      [validRoute, { ...validResult, extension: true }],
      [route("acme"), validResult],
    ];

    for (const [plannedRoute, executionResult] of mutants) {
      const classified = requireSuccess(
        api.classifyExecutionFailureV1(
          plannedRoute as ExecutionRoutePlanItemV1,
          executionResult as ExecutionResultV1,
        ),
      );
      expect(classified.disposition).toBe("unsupported");
    }
  });

  it("keeps cleanup blockage separate without changing any primary disposition", async () => {
    const api = await plannedApi();
    const fixtures = [
      { route: route("vice"), code: "semantic-mismatch", stage: "compare" },
      { route: route("acme"), code: "assembler-failure", stage: "acme" },
      { route: route("acme"), code: "tier-unavailable", stage: "acme" },
      { route: route("acme"), code: "semantic-mismatch", stage: "compare" },
    ] as const;

    for (const fixture of fixtures) {
      const clear = requireSuccess(
        api.classifyExecutionFailureV1(
          fixture.route,
          result(fixture.code, fixture.route.terminalTier, fixture.stage),
        ),
      );
      const blocked = requireSuccess(
        api.classifyExecutionFailureV1(
          fixture.route,
          result(fixture.code, fixture.route.terminalTier, fixture.stage, true),
        ),
      );
      expect(blocked.disposition).toBe(clear.disposition);
      expect(clear.cleanup).toBe("cleanup-clear");
      expect(blocked.cleanup).toBe("cleanup-blocked");
    }
  });
});

describe("failure predicate and promotion identity", () => {
  it("changes canonical predicate bytes and digest for every independently varied semantic field", async () => {
    const api = await plannedApi();
    const baselineInput = predicate();
    const baseline = requireSuccess(api.deriveFailurePredicateIdentityV1(baselineInput));
    const mutations: readonly [string, (input: FailurePredicateV1) => unknown][] = [
      ["result code", (input) => ({ ...input, resultCode: "diagnostic-mismatch" })],
      ["terminal tier", (input) => ({ ...input, terminalTier: "acme" })],
      ["terminal stage", (input) => ({ ...input, terminalStage: "observe" })],
      [
        "observation digest",
        (input) => ({ ...input, observation: { kind: "observed", digest: digest("9") } }),
      ],
      [
        "observation kind",
        (input) => ({
          ...input,
          observation: {
            kind: "not-reached",
            stage: "observe",
            terminalReasonDigest: digest("a"),
          },
        }),
      ],
      ["cleanup", (input) => ({ ...input, cleanup: "cleanup-blocked" })],
      ["primary rule", (input) => ({ ...input, primaryRuleId: "rule.changed" })],
      ["claimed rules", (input) => ({ ...input, requiredClaimedRuleIds: ["rule.claimed-a"] })],
      [
        "route kind",
        (input) => ({
          ...input,
          routeContract: { ...input.routeContract, originalRouteKind: "invalid-diagnostic" },
        }),
      ],
      [
        "route terminal tier",
        (input) => ({
          ...input,
          routeContract: { ...input.routeContract, terminalTier: "acme" },
        }),
      ],
      [
        "obligation",
        (input) => ({
          ...input,
          routeContract: { ...input.routeContract, obligation: "runtime-value" },
        }),
      ],
      [
        "prerequisite tiers",
        (input) => ({
          ...input,
          routeContract: { ...input.routeContract, prerequisiteTiers: ["frontend"] },
        }),
      ],
      [
        "policy digest",
        (input) => ({
          ...input,
          routeContract: { ...input.routeContract, policyDigest: digest("b") },
        }),
      ],
      [
        "fixture digest",
        (input) => ({
          ...input,
          routeContract: { ...input.routeContract, fixtureDigest: digest("c") },
        }),
      ],
      [
        "oracle contract digest",
        (input) => ({
          ...input,
          routeContract: { ...input.routeContract, oracleContractDigest: digest("d") },
        }),
      ],
      [
        "tool contract digests",
        (input) => ({
          ...input,
          routeContract: { ...input.routeContract, toolContractDigests: [digest("e")] },
        }),
      ],
    ];

    for (const [name, mutate] of mutations) {
      const changed = requireSuccess(api.deriveFailurePredicateIdentityV1(mutate(baselineInput)));
      expect(changed.canonicalBytes, name).not.toEqual(baseline.canonicalBytes);
      expect(changed.digest, name).not.toBe(baseline.digest);
    }

    const notReached = predicate({
      observation: {
        kind: "not-reached",
        stage: "observe",
        terminalReasonDigest: digest("a"),
      },
    });
    const notReachedIdentity = requireSuccess(api.deriveFailurePredicateIdentityV1(notReached));
    for (const observation of [
      { ...notReached.observation, stage: "compare" },
      { ...notReached.observation, terminalReasonDigest: digest("b") },
    ]) {
      const changed = requireSuccess(
        api.deriveFailurePredicateIdentityV1({ ...notReached, observation }),
      );
      expect(changed.canonicalBytes).not.toEqual(notReachedIdentity.canonicalBytes);
      expect(changed.digest).not.toBe(notReachedIdentity.digest);
    }

    expectFailure(
      api.deriveFailurePredicateIdentityV1({ ...baselineInput, revision: "predicate-v2" }),
    );
    expectFailure(api.deriveFailurePredicateIdentityV1({ ...baselineInput, target: "cx16" }));

    const registry = createIdentityCollisionRegistry(() => new Uint8Array(32).fill(0x5a));
    try {
      expect(api.deriveFailurePredicateIdentityV1(baselineInput, registry).ok).toBe(true);
      expectFailure(
        api.deriveFailurePredicateIdentityV1(
          { ...baselineInput, primaryRuleId: "rule.collision" },
          registry,
        ),
      );
    } finally {
      registry.dispose();
    }
  });

  it("promotes identical minimized content and predicates equally across campaign contexts", async () => {
    const api = await plannedApi();
    const campaignContexts = [digest("1"), digest("2")];
    expect(campaignContexts[0]).not.toBe(campaignContexts[1]);

    const firstPredicate = requireSuccess(api.deriveFailurePredicateIdentityV1(predicate()));
    const secondPredicate = requireSuccess(api.deriveFailurePredicateIdentityV1(predicate()));
    const contentDigest = digest("f");
    const first = requireSuccess(
      api.derivePromotedFailureKeyV1(contentDigest, firstPredicate.predicate),
    );
    const second = requireSuccess(
      api.derivePromotedFailureKeyV1(contentDigest, secondPredicate.predicate),
    );
    expect(second).toEqual(first);

    const { originalRouteKind: _legacyKind, ...legacyRoute } = predicate().routeContract;
    const legacy = requireSuccess(
      api.deriveFailurePredicateIdentityV1({
        ...predicate(),
        routeContract: legacyRoute,
      }),
    );
    expect(legacy.predicate.routeContract.originalRouteKind).toBe("valid-envelope");
    const invalidDiagnostic = requireSuccess(
      api.deriveFailurePredicateIdentityV1(
        predicate({
          routeContract: {
            ...predicate().routeContract,
            originalRouteKind: "invalid-diagnostic",
          },
        }),
      ),
    );
    expect(invalidDiagnostic.digest).not.toBe(legacy.digest);
    expect(
      requireSuccess(api.derivePromotedFailureKeyV1(contentDigest, invalidDiagnostic.predicate))
        .digest,
    ).not.toBe(first.digest);
  });

  it("keeps predicate and promotion stable when only the selected run policy changes", async () => {
    const api = await plannedApi();
    const firstPredicate = requireSuccess(api.deriveFailurePredicateIdentityV1(predicate()));
    const firstPromotion = requireSuccess(
      api.derivePromotedFailureKeyV1(digest("f"), firstPredicate.predicate),
    );
    const changedPolicy = policyWithBudget({ transformationAttempts: 512 });
    const firstRunInput: FailureReductionRunIdentityInputV1 = {
      historicalEnvelopeDigest: digest("1"),
      predicateDigest: firstPredicate.digest,
      policy: POLICY,
      traceDigest: digest("2"),
    };
    const firstRun = requireSuccess(api.deriveFailureReductionRunIdentityV1(firstRunInput));
    const changedRun = requireSuccess(
      api.deriveFailureReductionRunIdentityV1({ ...firstRunInput, policy: changedPolicy }),
    );
    const repeatedPredicate = requireSuccess(api.deriveFailurePredicateIdentityV1(predicate()));
    const repeatedPromotion = requireSuccess(
      api.derivePromotedFailureKeyV1(digest("f"), repeatedPredicate.predicate),
    );

    expect(repeatedPredicate).toEqual(firstPredicate);
    expect(repeatedPromotion).toEqual(firstPromotion);
    expect(changedRun.digest).not.toBe(firstRun.digest);
  });
});

describe("shared failure campaign budget", () => {
  it("accepts every exact limit and exhausts or rejects every value beyond it", async () => {
    const api = await plannedApi();
    expect(api.FAILURE_REDUCTION_DEFAULT_POLICY_V1).toEqual(POLICY);
    expect(api.FAILURE_REDUCTION_MAXIMUM_BUDGET_V1).toEqual(MAXIMUM_BUDGET);
    expect(requireSuccess(api.parseFailureReductionPolicyV1(POLICY))).toEqual(POLICY);

    for (const field of Object.keys(MAXIMUM_BUDGET) as (keyof FailureReductionBudgetV1)[]) {
      const maximum = MAXIMUM_BUDGET[field];
      const atMaximum = policyWithBudget({ [field]: maximum });
      expect(requireSuccess(api.parseFailureReductionPolicyV1(atMaximum))).toEqual(atMaximum);
      for (const invalid of [maximum + 1, 0, -1, 1.5, Number.MAX_SAFE_INTEGER + 1]) {
        expectFailure(api.parseFailureReductionPolicyV1(policyWithBudget({ [field]: invalid })));
      }
    }

    const chargeCases: readonly {
      readonly field: keyof FailureReductionBudgetV1;
      readonly policy: FailureReductionPolicyV1;
      readonly reservation: FailureCampaignBudgetReservationV1;
      readonly charge: FailureCampaignBudgetChargeV1;
      readonly exact: number;
    }[] = [
      {
        field: "campaignOperations",
        policy: policyWithBudget({ campaignOperations: 1, durableWrites: 1 }),
        reservation: { nonPassResults: 0, resolvableNonPassResults: 0 },
        charge: { kind: "terminal-summary-write" },
        exact: 1,
      },
      {
        field: "transformationAttempts",
        policy: policyWithBudget({ campaignOperations: 2, transformationAttempts: 1 }),
        reservation: { nonPassResults: 0, resolvableNonPassResults: 0 },
        charge: { kind: "transformation-attempt" },
        exact: 1,
      },
      {
        field: "routeExecutions",
        policy: policyWithBudget({ campaignOperations: 2, routeExecutions: 1 }),
        reservation: { nonPassResults: 0, resolvableNonPassResults: 0 },
        charge: { kind: "route-execution", purpose: "reduction" },
        exact: 1,
      },
      {
        field: "oracleEvaluations",
        policy: policyWithBudget({ campaignOperations: 2, oracleEvaluations: 1 }),
        reservation: { nonPassResults: 0, resolvableNonPassResults: 0 },
        charge: { kind: "oracle-evaluation" },
        exact: 1,
      },
      {
        field: "diagnosticBytes",
        policy: policyWithBudget({ campaignOperations: 2, diagnosticBytes: 5 }),
        reservation: { nonPassResults: 0, resolvableNonPassResults: 0 },
        charge: { kind: "diagnostic-capture", bytes: 5 },
        exact: 5,
      },
      {
        field: "provenanceEvents",
        policy: policyWithBudget({ campaignOperations: 2, provenanceEvents: 1 }),
        reservation: { nonPassResults: 0, resolvableNonPassResults: 0 },
        charge: { kind: "provenance-event-read" },
        exact: 1,
      },
      {
        field: "sequenceCases",
        policy: policyWithBudget({ campaignOperations: 2, sequenceCases: 1 }),
        reservation: { nonPassResults: 0, resolvableNonPassResults: 0 },
        charge: { kind: "sequence-case" },
        exact: 1,
      },
      {
        field: "durableWrites",
        policy: policyWithBudget({ campaignOperations: 1, durableWrites: 1 }),
        reservation: { nonPassResults: 0, resolvableNonPassResults: 0 },
        charge: { kind: "terminal-summary-write" },
        exact: 1,
      },
      {
        field: "coreBytes",
        policy: policyWithBudget({ campaignOperations: 2, durableWrites: 2, coreBytes: 5 }),
        reservation: { nonPassResults: 0, resolvableNonPassResults: 0 },
        charge: { kind: "core-write", bytes: 5 },
        exact: 5,
      },
      {
        field: "runBytes",
        policy: policyWithBudget({ campaignOperations: 2, durableWrites: 2, runBytes: 5 }),
        reservation: { nonPassResults: 1, resolvableNonPassResults: 0 },
        charge: { kind: "terminal-run-write", bytes: 5 },
        exact: 5,
      },
    ];

    for (const testCase of chargeCases) {
      const authority = requireSuccess(
        api.createFailureCampaignBudgetAuthorityV1(testCase.policy, testCase.reservation),
      );
      const exact = requireSuccess(api.chargeFailureCampaignBudgetV1(authority, testCase.charge));
      expect(exact.used[testCase.field]).toBe(testCase.exact);
      const beforeFailure = requireSuccess(api.getFailureCampaignBudgetSnapshotV1(authority));
      expectFailure(api.chargeFailureCampaignBudgetV1(authority, testCase.charge));
      expect(requireSuccess(api.getFailureCampaignBudgetSnapshotV1(authority))).toEqual(
        beforeFailure,
      );
    }
  });

  it("rejects an undersized terminal reserve and protects every reserved terminal write", async () => {
    const api = await plannedApi();
    const reservation = { nonPassResults: 1, resolvableNonPassResults: 1 } as const;
    expectFailure(
      api.createFailureCampaignBudgetAuthorityV1(
        policyWithBudget({ campaignOperations: 2, durableWrites: 2 }),
        reservation,
      ),
    );

    const authority = requireSuccess(
      api.createFailureCampaignBudgetAuthorityV1(
        policyWithBudget({ campaignOperations: 4, durableWrites: 4 }),
        reservation,
      ),
    );
    requireSuccess(
      api.chargeFailureCampaignBudgetV1(authority, { kind: "transformation-attempt" }),
    );
    const beforeExhaustion = requireSuccess(api.getFailureCampaignBudgetSnapshotV1(authority));
    expect(beforeExhaustion.terminalRemaining).toEqual({
      campaignOperations: 3,
      durableWrites: 3,
      envelopes: 1,
      runs: 1,
      summaries: 1,
    });
    expectFailure(api.chargeFailureCampaignBudgetV1(authority, { kind: "transformation-attempt" }));
    expect(requireSuccess(api.getFailureCampaignBudgetSnapshotV1(authority))).toEqual(
      beforeExhaustion,
    );

    requireSuccess(
      api.chargeFailureCampaignBudgetV1(authority, { kind: "terminal-envelope-write" }),
    );
    requireSuccess(
      api.chargeFailureCampaignBudgetV1(authority, {
        kind: "terminal-run-write",
        bytes: 1,
      }),
    );
    const terminal = requireSuccess(
      api.chargeFailureCampaignBudgetV1(authority, { kind: "terminal-summary-write" }),
    );
    expect(terminal.terminalRemaining).toEqual({
      campaignOperations: 0,
      durableWrites: 0,
      envelopes: 0,
      runs: 0,
      summaries: 0,
    });
  });
});
