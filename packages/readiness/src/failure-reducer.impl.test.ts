import { createHash } from "node:crypto";

import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { createFailureCampaignBudgetAuthorityV1, getFailureEnvelopeProjectionV1 } from "./index.js";

import { authorizeFailureEnvelopeV1 } from "./failure-envelope.js";
import { deriveFailurePredicateIdentityV1 } from "./failure-identity.js";
import {
  createFailureReductionSessionV1,
  getFailureReductionTerminalCandidateAuthorityV1,
  nextFailureReductionStepV1,
  recordFailureReductionEvaluationV1,
} from "./failure-reducer.js";
import {
  consumeReductionEvaluationTokenV1,
  consumeReductionCandidateInvocationV1,
  createInitialReductionCandidateV1,
  createReductionCandidateAuthorityV1,
  createReductionCandidateInvocationV1,
  getReductionCandidateProjectionV1,
  getReductionEvaluationTokenStateV1,
  getValidatedReductionCandidateProjectionV1,
  getValidatedReductionCandidateStateV1,
  validateReductionCandidateInvariantV1,
} from "./reduction-candidate.js";
import { validateGeneratorIr } from "./generator-ir-validator.js";
import {
  createFailureTransformationTraceEntryV1,
  failureTransformationTraceDigestV1,
  validateFailureTransformationTraceV1,
} from "./failure-trace-authority.js";
import { createPublishedDiagnosticCaseFromIntentV1 } from "./published-diagnostic-case.js";
import { preparePublishedCampaignCaseV1 } from "./published-oracle-context.js";
import { renderSourceModule } from "./source-renderer.js";
import {
  createRawReductionImplFixture,
  createTypedInvalidReductionImplFixtures,
  createTypedReductionImplFixtures,
} from "./test-fixtures/failure-reduction-impl-fixture.js";

import type { RawReductionImplFixture } from "./test-fixtures/failure-reduction-impl-fixture.js";
import type { Sha256Digest } from "./model-registry-model.js";

let genuine: RawReductionImplFixture;

const MEMORY_RULE_IDS = Object.freeze([
  "rule.ch12.3-1-memory-access.peek-addr.signature.word",
  "rule.ch12.3-1-memory-access.peekw-addr.signature.word",
  "rule.ch12.3-1-memory-access.poke-addr-val.signature.word-byte",
  "rule.ch12.3-1-memory-access.pokew-addr-val.signature.word-word",
]);
const MEMORY_CONFIGURATION = Object.freeze({
  caseCount: 40,
  maxInvalidCases: 16,
  enabledRuleIds: [...MEMORY_RULE_IDS].sort(),
  spellings: ["literal", "parameter"] as const,
  budget: Object.freeze({
    maxModules: 4,
    maxDeclarations: 128,
    maxIrNodes: 512,
    maxStatements: 256,
    maxExpressionDepth: 16,
    maxLoopWork: 1n,
    maxSourceBytes: 65_536,
    maxAttempts: 128,
  }),
});

function digestBytes(bytes: Uint8Array): Sha256Digest {
  return `sha256:${createHash("sha256").update(bytes).digest("hex")}`;
}

function createGenuineMemoryInvalidFixture() {
  const seed = `sha256:${"7".repeat(64)}` as const;
  const firstInvalidOrdinal = MEMORY_CONFIGURATION.caseCount - MEMORY_CONFIGURATION.maxInvalidCases;
  for (let ordinal = firstInvalidOrdinal; ordinal < MEMORY_CONFIGURATION.caseCount; ordinal += 1) {
    for (const ruleId of MEMORY_RULE_IDS) {
      const prepared = preparePublishedCampaignCaseV1(genuine.context, {
        schemaVersion: 1,
        ruleId,
        seed,
        configuration: MEMORY_CONFIGURATION,
        ordinal,
      });
      if (
        !prepared.ok ||
        prepared.value.generatedCase.modeledCase.projection.kind !== "invalid" ||
        prepared.value.generatedCase.modeledCase.projection.transform.kind !==
          "intrinsic-argument-replace"
      ) {
        continue;
      }
      const diagnostic = createPublishedDiagnosticCaseFromIntentV1(genuine.context, {
        schemaVersion: 1,
        ruleId,
        seed,
        configuration: MEMORY_CONFIGURATION,
        ordinal,
      });
      if (!diagnostic.ok) continue;
      const predicate = deriveFailurePredicateIdentityV1({
        revision: "failure-predicate-v1",
        resultCode: "semantic-mismatch",
        terminalTier: "frontend",
        terminalStage: "frontend",
        observation: { kind: "observed", digest: digestBytes(new Uint8Array()) },
        cleanup: "cleanup-clear",
        primaryRuleId: ruleId,
        requiredClaimedRuleIds: [ruleId],
        target: "c64",
        routeContract: {
          originalRouteKind: "invalid-diagnostic",
          terminalTier: "frontend",
          obligation: "typed-invalid-failure",
          prerequisiteTiers: [],
          policyDigest: digestBytes(Uint8Array.from([1])),
          fixtureDigest: digestBytes(Uint8Array.from([2])),
          oracleContractDigest: digestBytes(Uint8Array.from([3])),
          toolContractDigests: [],
        },
      });
      if (!predicate.ok) continue;
      const routePlanBytes = new TextEncoder().encode(`typed invalid memory route ${ordinal}\n`);
      const envelope = authorizeFailureEnvelopeV1({
        revision: "failure-envelope-authorization-input-v1",
        source: { kind: "typed-invalid", authority: diagnostic.value },
        routePlanBytes,
        routePlanDigest: digestBytes(routePlanBytes),
        predicate: predicate.value.predicate,
        policy: genuine.policy,
        observationBytes: new Uint8Array(),
        toolVersions: [],
      });
      if (envelope.ok) {
        return Object.freeze({
          envelope: envelope.value,
          ordinal,
          ruleId,
          prepared: prepared.value,
        });
      }
    }
  }
  throw new TypeError("Expected a genuine typed-invalid memory replacement fixture.");
}

beforeAll(async () => {
  genuine = await createRawReductionImplFixture();
}, 240_000);

afterAll(async () => genuine.cleanup());

describe("failure reducer authority hardening", () => {
  it("authenticates only exact append-only transformation trace chains", () => {
    const digestA = `sha256:${"a".repeat(64)}` as const;
    const digestB = `sha256:${"b".repeat(64)}` as const;
    const digestC = `sha256:${"c".repeat(64)}` as const;
    const transform = Object.freeze({
      revision: "failure-transformation-v1" as const,
      kind: "malformed-byte-chunk-delete" as const,
      startByte: 0,
      endByte: 1,
    });
    expect(validateFailureTransformationTraceV1(genuine.envelope, [], digestA)).toBe(true);
    expect(failureTransformationTraceDigestV1([])).toMatch(/^sha256:/u);
    for (const forged of [{}, null, 1]) {
      expect(validateFailureTransformationTraceV1(genuine.envelope, [forged], digestA)).toBe(false);
      expect(failureTransformationTraceDigestV1([forged])).toBeUndefined();
    }
    const first = createFailureTransformationTraceEntryV1(
      genuine.envelope,
      [],
      digestA,
      digestB,
      0,
      transform,
      [2, 2, digestA],
      [1, 1, digestB],
      digestB,
    );
    expect(validateFailureTransformationTraceV1(genuine.envelope, [first], digestB)).toBe(true);
    expect(validateFailureTransformationTraceV1(genuine.envelope, [first], digestC)).toBe(false);
    expect(validateFailureTransformationTraceV1(genuine.envelope, [first], digestC, false)).toBe(
      true,
    );
    expect(failureTransformationTraceDigestV1([first])).toMatch(/^sha256:/u);
    const second = createFailureTransformationTraceEntryV1(
      genuine.envelope,
      [first],
      digestB,
      digestC,
      1,
      transform,
      [1, 1, digestB],
      [0, 0, digestC],
      digestC,
    );
    expect(validateFailureTransformationTraceV1(genuine.envelope, [first, second], digestC)).toBe(
      true,
    );
    expect(validateFailureTransformationTraceV1(genuine.envelope, [{}, second], digestC)).toBe(
      false,
    );
    expect(failureTransformationTraceDigestV1([{}, second])).toBeUndefined();
    expect(
      validateFailureTransformationTraceV1(genuine.envelope, [first, first, second], digestC),
    ).toBe(false);
    const alternateFirst = createFailureTransformationTraceEntryV1(
      genuine.envelope,
      [],
      digestA,
      digestB,
      0,
      transform,
      [2, 2, digestA],
      [1, 1, digestB],
      digestB,
    );
    expect(
      validateFailureTransformationTraceV1(genuine.envelope, [alternateFirst, second], digestC),
    ).toBe(false);
    expect(failureTransformationTraceDigestV1([alternateFirst, second])).toBeUndefined();
    expect(failureTransformationTraceDigestV1([first, second, second])).toBeUndefined();
    expect(() =>
      createFailureTransformationTraceEntryV1(
        genuine.envelope,
        [first],
        digestC,
        digestA,
        2,
        transform,
        [1, 1, digestC],
        [0, 0, digestA],
        digestA,
      ),
    ).toThrow(TypeError);
    expect(() =>
      createFailureTransformationTraceEntryV1(
        {} as never,
        [first],
        digestB,
        digestC,
        2,
        transform,
        [1, 1, digestB],
        [0, 0, digestC],
        digestC,
      ),
    ).toThrow(TypeError);
    expect(() =>
      createFailureTransformationTraceEntryV1(
        genuine.envelope,
        [first, first],
        digestB,
        digestC,
        2,
        transform,
        [1, 1, digestB],
        [0, 0, digestC],
        digestC,
      ),
    ).toThrow(TypeError);
  });

  it("rejects null candidate capabilities and consumes evaluation tokens once", () => {
    expect(createInitialReductionCandidateV1({} as never)).toMatchObject({ ok: false });
    expect(getValidatedReductionCandidateProjectionV1(null as never)).toMatchObject({ ok: false });
    expect(getValidatedReductionCandidateStateV1(null as never)).toBeUndefined();
    expect(
      createReductionCandidateInvocationV1(null as never, "reduction", "catalog-edit"),
    ).toMatchObject({ ok: false });
    expect(getReductionEvaluationTokenStateV1(null)).toBeUndefined();
    expect(consumeReductionEvaluationTokenV1({} as never)).toBe(false);

    const initial = createInitialReductionCandidateV1(genuine.envelope);
    expect(initial).toMatchObject({ ok: true });
    if (!initial.ok) return;
    const authority = createReductionCandidateAuthorityV1(genuine.envelope, initial.value, []);
    expect(authority).toMatchObject({ ok: true });
    if (!authority.ok) return;
    const invocation = createReductionCandidateInvocationV1(
      authority.value,
      "reduction",
      "catalog-edit",
    );
    expect(invocation).toMatchObject({ ok: true });
    if (!invocation.ok) return;
    expect(consumeReductionEvaluationTokenV1(invocation.value.token)).toBe(false);
    expect(consumeReductionCandidateInvocationV1(invocation.value)).toMatchObject({ ok: true });
    expect(consumeReductionEvaluationTokenV1(invocation.value.token)).toBe(true);
    expect(consumeReductionEvaluationTokenV1(invocation.value.token)).toBe(false);
  });

  it("rejects plain, copied, and proxy capabilities before session mutation", () => {
    const plain = Object.freeze({});
    const proxy = new Proxy(
      {},
      {
        get: () => {
          throw new Error("must not execute");
        },
        ownKeys: () => {
          throw new Error("must not inspect");
        },
      },
    );
    for (const forged of [plain, { ...plain }, proxy, null]) {
      const capability = forged as never;
      expect(createFailureReductionSessionV1(capability, capability)).toMatchObject({ ok: false });
      expect(nextFailureReductionStepV1(capability)).toMatchObject({ ok: false });
      expect(recordFailureReductionEvaluationV1(capability, {})).toMatchObject({ ok: false });
      expect(getReductionCandidateProjectionV1(capability)).toMatchObject({ ok: false });
    }
  });

  it("rejects malformed invocation shapes and closed discriminator substitutions", () => {
    for (const invocation of [
      {},
      { revision: "reduction-candidate-invocation-v1" },
      {
        revision: "reduction-candidate-invocation-v1",
        subject: "control",
        authority: {},
        token: {},
        purpose: "reduction",
        proposalKind: "catalog-edit",
        sequence: 0,
      },
    ]) {
      expect(consumeReductionCandidateInvocationV1(invocation)).toMatchObject({ ok: false });
    }
    expect(createReductionCandidateAuthorityV1({} as never, {} as never, [])).toMatchObject({
      ok: false,
    });
    expect(
      createReductionCandidateInvocationV1({} as never, "reduction", "catalog-edit"),
    ).toMatchObject({
      ok: false,
    });
    expect(
      createReductionCandidateInvocationV1({} as never, "confirmation", "normalization"),
    ).toMatchObject({
      ok: false,
    });
  });

  it("rejects forged, sparse, accessor, cyclic, and oversized transformation traces", () => {
    const initial = createInitialReductionCandidateV1(genuine.envelope);
    expect(initial).toMatchObject({ ok: true });
    if (!initial.ok) return;
    const cyclic: unknown[] = [];
    cyclic.push(cyclic);
    const sparse = new Array(2);
    sparse[1] = {};
    const accessor = Object.defineProperty([], "0", {
      enumerable: true,
      get: () => {
        throw new Error("must not execute");
      },
    });
    Object.defineProperty(accessor, "length", { value: 1 });
    const forged = [{ revision: "not-a-trace", catalogOrdinal: 0 }];
    const oversized = Array.from(
      { length: genuine.policy.budget.transformationAttempts + 1 },
      () => ({}),
    );
    for (const trace of [cyclic, sparse, accessor, forged, oversized]) {
      expect(
        createReductionCandidateAuthorityV1(genuine.envelope, initial.value, trace as never),
      ).toMatchObject({ ok: false });
    }
  });

  it("rejects evaluation records with extra, missing, or accessor fields", () => {
    const session = {} as never;
    expect(
      recordFailureReductionEvaluationV1(session, {
        revision: "reduction-candidate-evaluation-v1",
        token: {},
        candidateDigest: `sha256:${"0".repeat(64)}`,
        purpose: "reduction",
        reproduced: false,
        observation: {},
        extra: true,
      }),
    ).toMatchObject({ ok: false });
    const accessor = Object.defineProperty({}, "revision", {
      enumerable: true,
      get: () => {
        throw new Error("must not execute");
      },
    });
    expect(recordFailureReductionEvaluationV1(session, accessor)).toMatchObject({ ok: false });
  });

  it("enforces closed invocation discriminators and candidate-local sequence order", () => {
    const initial = createInitialReductionCandidateV1(genuine.envelope);
    expect(initial).toMatchObject({ ok: true });
    if (!initial.ok) return;
    const authority = createReductionCandidateAuthorityV1(genuine.envelope, initial.value, []);
    expect(authority).toMatchObject({ ok: true });
    if (!authority.ok) return;
    expect(
      createReductionCandidateInvocationV1(authority.value, "other" as never, "catalog-edit"),
    ).toMatchObject({ ok: false, issues: [{ code: "execution.invalid-schema" }] });
    expect(
      createReductionCandidateInvocationV1(authority.value, "reduction", "other" as never),
    ).toMatchObject({ ok: false, issues: [{ code: "execution.invalid-schema" }] });
    const first = createReductionCandidateInvocationV1(
      authority.value,
      "reduction",
      "catalog-edit",
    );
    const second = createReductionCandidateInvocationV1(
      authority.value,
      "confirmation",
      "normalization",
    );
    expect(first).toMatchObject({ ok: true });
    expect(second).toMatchObject({ ok: true });
    if (!first.ok || !second.ok) return;
    expect(consumeReductionCandidateInvocationV1(second.value)).toMatchObject({
      ok: false,
      issues: [{ code: "execution.identity" }],
    });
    expect(consumeReductionCandidateInvocationV1(first.value)).toMatchObject({ ok: true });
    expect(consumeReductionCandidateInvocationV1(first.value)).toMatchObject({
      ok: false,
      issues: [{ code: "unbound-capability" }],
    });
    expect(consumeReductionCandidateInvocationV1(second.value)).toMatchObject({ ok: true });
  });

  it("rejects evaluation before its invocation is consumed", () => {
    const budget = createFailureCampaignBudgetAuthorityV1(genuine.policy, {
      nonPassResults: 0,
      resolvableNonPassResults: 0,
    });
    expect(budget).toMatchObject({ ok: true });
    if (!budget.ok) return;
    const session = createFailureReductionSessionV1(genuine.envelope, budget.value);
    expect(session).toMatchObject({ ok: true });
    if (!session.ok) return;
    const step = nextFailureReductionStepV1(session.value);
    expect(step).toMatchObject({ ok: true, value: { kind: "execute-candidate" } });
    if (!step.ok || step.value.kind !== "execute-candidate") return;
    const candidate = getReductionCandidateProjectionV1(step.value.invocation.authority);
    const envelope = getFailureEnvelopeProjectionV1(genuine.envelope);
    expect(candidate).toMatchObject({ ok: true });
    expect(envelope).toMatchObject({ ok: true });
    if (!candidate.ok || !envelope.ok) return;
    const evaluation = {
      revision: "reduction-candidate-evaluation-v1",
      token: step.value.invocation.token,
      candidateDigest: candidate.value.candidateDigest,
      purpose: step.value.invocation.purpose,
      reproduced: false,
      observation: envelope.value.predicate.observation,
    };
    expect(recordFailureReductionEvaluationV1(session.value, evaluation)).toMatchObject({
      ok: false,
      issues: [{ code: "execution.identity" }],
    });
    expect(consumeReductionCandidateInvocationV1(step.value.invocation)).toMatchObject({
      ok: true,
    });
    expect(recordFailureReductionEvaluationV1(session.value, evaluation)).toMatchObject({
      ok: true,
    });
  });

  it("rejects a genuine campaign budget minted from a different policy", () => {
    const foreignPolicy = {
      ...genuine.policy,
      budget: {
        ...genuine.policy.budget,
        oracleEvaluations: genuine.policy.budget.oracleEvaluations - 1,
      },
    };
    const budget = createFailureCampaignBudgetAuthorityV1(foreignPolicy, {
      nonPassResults: 0,
      resolvableNonPassResults: 0,
    });
    expect(budget).toMatchObject({ ok: true });
    if (!budget.ok) return;
    expect(createFailureReductionSessionV1(genuine.envelope, budget.value)).toMatchObject({
      ok: false,
      issues: [{ code: "execution.identity", path: "/campaignBudget" }],
    });
  });

  it("does not charge the catalog-complete probe after the exact final edit", async () => {
    const policy = {
      ...genuine.policy,
      budget: {
        ...genuine.policy.budget,
        transformationAttempts: 1,
        oracleEvaluations: 1,
      },
    };
    const fixture = await createRawReductionImplFixture(new TextEncoder().encode("x"), policy);
    try {
      const budget = createFailureCampaignBudgetAuthorityV1(policy, {
        nonPassResults: 0,
        resolvableNonPassResults: 0,
      });
      expect(budget).toMatchObject({ ok: true });
      if (!budget.ok) return;
      const session = createFailureReductionSessionV1(fixture.envelope, budget.value);
      const envelope = getFailureEnvelopeProjectionV1(fixture.envelope);
      expect(session).toMatchObject({ ok: true });
      expect(envelope).toMatchObject({ ok: true });
      if (!session.ok || !envelope.ok) return;
      expect(getFailureReductionTerminalCandidateAuthorityV1(session.value)).toMatchObject({
        ok: false,
        issues: [{ path: "/session/terminal" }],
      });
      const step = nextFailureReductionStepV1(session.value);
      expect(step).toMatchObject({ ok: true, value: { kind: "execute-candidate" } });
      if (!step.ok || step.value.kind !== "execute-candidate") return;
      const consumed = consumeReductionCandidateInvocationV1(step.value.invocation);
      expect(consumed).toMatchObject({ ok: true });
      if (!consumed.ok) return;
      const completed = recordFailureReductionEvaluationV1(session.value, {
        revision: "reduction-candidate-evaluation-v1",
        token: step.value.invocation.token,
        candidateDigest: consumed.value.candidate.candidateDigest,
        purpose: "reduction",
        reproduced: true,
        observation: envelope.value.predicate.observation,
      });
      expect(completed).toMatchObject({
        ok: true,
        value: { kind: "complete", result: { outcome: "one-minimal" } },
      });
      const terminalAuthority = getFailureReductionTerminalCandidateAuthorityV1(session.value);
      expect(terminalAuthority).toMatchObject({ ok: true });
      if (!completed.ok || completed.value.kind !== "complete" || !terminalAuthority.ok) return;
      expect(getReductionCandidateProjectionV1(terminalAuthority.value)).toMatchObject({
        ok: true,
        value: {
          candidateDigest: completed.value.result.best.candidateDigest,
          candidateExecutionIdentity: expect.stringMatching(/^sha256:[0-9a-f]{64}$/u),
        },
      });
      expect("candidateExecutionIdentity" in completed.value.result.best).toBe(false);
    } finally {
      await fixture.cleanup();
    }
  }, 240_000);

  it("retains one monotonic proposal sequence across fresh candidate authorities", () => {
    const budget = createFailureCampaignBudgetAuthorityV1(genuine.policy, {
      nonPassResults: 0,
      resolvableNonPassResults: 0,
    });
    expect(budget).toMatchObject({ ok: true });
    if (!budget.ok) return;
    const session = createFailureReductionSessionV1(genuine.envelope, budget.value);
    const envelope = getFailureEnvelopeProjectionV1(genuine.envelope);
    expect(session).toMatchObject({ ok: true });
    expect(envelope).toMatchObject({ ok: true });
    if (!session.ok || !envelope.ok) return;
    const first = nextFailureReductionStepV1(session.value);
    expect(first).toMatchObject({ ok: true, value: { kind: "execute-candidate" } });
    if (!first.ok || first.value.kind !== "execute-candidate") return;
    const consumed = consumeReductionCandidateInvocationV1(first.value.invocation);
    expect(consumed).toMatchObject({ ok: true });
    if (!consumed.ok) return;
    const second = recordFailureReductionEvaluationV1(session.value, {
      revision: "reduction-candidate-evaluation-v1",
      token: first.value.invocation.token,
      candidateDigest: consumed.value.candidate.candidateDigest,
      purpose: first.value.invocation.purpose,
      reproduced: false,
      observation: envelope.value.predicate.observation,
    });
    expect(first.value.invocation.sequence).toBe(0);
    expect(second).toMatchObject({
      ok: true,
      value: { kind: "execute-candidate", invocation: { sequence: 1 } },
    });
  });

  it("rejects cross-family drafts, introduced claims, and unresolved witness or binding pointers", () => {
    const typed = createTypedReductionImplFixtures(genuine.context, 16);
    expect(typed.length).toBeGreaterThan(0);
    const fixture = typed.find(({ envelope }) => {
      const initial = createInitialReductionCandidateV1(envelope);
      if (!initial.ok) return false;
      const projected = getValidatedReductionCandidateProjectionV1(initial.value);
      return (
        projected.ok &&
        projected.value.draft.kind === "typed-valid" &&
        projected.value.draft.parameterBindings.length > 0
      );
    });
    expect(fixture).toBeDefined();
    if (fixture === undefined) return;
    const initial = createInitialReductionCandidateV1(fixture.envelope);
    expect(initial).toMatchObject({ ok: true });
    if (!initial.ok) return;
    const projected = getValidatedReductionCandidateProjectionV1(initial.value);
    expect(projected).toMatchObject({ ok: true });
    if (!projected.ok || projected.value.draft.kind !== "typed-valid") return;
    const draft = projected.value.draft;
    expect(validateReductionCandidateInvariantV1(genuine.envelope, draft)).toMatchObject({
      ok: false,
    });
    const typedInvalid = createTypedInvalidReductionImplFixtures(genuine.context, 1)[0];
    expect(typedInvalid).toBeDefined();
    if (typedInvalid !== undefined) {
      const invalidInitial = createInitialReductionCandidateV1(typedInvalid.envelope);
      expect(invalidInitial).toMatchObject({ ok: true });
      if (invalidInitial.ok) {
        const invalidProjection = getValidatedReductionCandidateProjectionV1(invalidInitial.value);
        expect(invalidProjection).toMatchObject({ ok: true });
        if (invalidProjection.ok) {
          expect(
            validateReductionCandidateInvariantV1(genuine.envelope, invalidProjection.value.draft),
          ).toMatchObject({ ok: false });
        }
      }
    }
    expect(
      validateReductionCandidateInvariantV1(fixture.envelope, {
        ...draft,
        claimedRuleIds: [...draft.claimedRuleIds, "rule.introduced"],
        claimWitnesses: [...draft.claimWitnesses, { ruleId: "rule.introduced", path: "/module" }],
      }),
    ).toMatchObject({ ok: false });
    expect(
      validateReductionCandidateInvariantV1(fixture.envelope, {
        ...draft,
        claimWitnesses: draft.claimWitnesses.map((witness) => ({
          ...witness,
          path: "/module/functions/999",
        })),
      }),
    ).toMatchObject({ ok: false });
    expect(
      validateReductionCandidateInvariantV1(fixture.envelope, {
        ...draft,
        parameterBindings: draft.parameterBindings.map((binding, index) =>
          index === 0 ? { ...binding, parameterPath: "/functions/999/parameters/0" } : binding,
        ),
      }),
    ).toMatchObject({ ok: false });
    expect(
      validateReductionCandidateInvariantV1(fixture.envelope, {
        ...draft,
        parameterBindings: draft.parameterBindings.map((binding, index) =>
          index === 0
            ? {
                ...binding,
                value: typeof binding.value === "bigint" ? true : 0n,
              }
            : binding,
        ),
      }),
    ).toMatchObject({ ok: false });
  });

  it("preserves genuine typed-invalid memory argument types and rejects hostile replacements", () => {
    const fixture = createGenuineMemoryInvalidFixture();
    const envelope = getFailureEnvelopeProjectionV1(fixture.envelope);
    const initial = createInitialReductionCandidateV1(fixture.envelope);
    expect(envelope).toMatchObject({ ok: true });
    expect(initial).toMatchObject({ ok: true });
    if (!envelope.ok || !initial.ok || envelope.value.initialCandidate.kind !== "typed-invalid")
      return;
    const projected = getValidatedReductionCandidateProjectionV1(initial.value);
    expect(projected).toMatchObject({ ok: true });
    if (!projected.ok || projected.value.draft.kind !== "typed-invalid") return;
    const draft = projected.value.draft;
    const generated = fixture.prepared.generatedCase;
    if (generated.modeledCase.projection.kind !== "invalid") return;
    expect(draft).toMatchObject({
      kind: "typed-invalid",
      transform: {
        kind: "intrinsic-argument-replace",
        argument: { kind: "literal", type: "boolean", value: 0n },
      },
      primaryRuleId: fixture.ruleId,
    });
    expect(draft.sourceBytes).toEqual(generated.sourceBytes);
    expect(draft.baseline).toEqual(generated.modeledCase.projection.baseline);
    expect(draft.transform).toEqual(generated.modeledCase.projection.transform);
    expect(draft.parameterBindings).toEqual(generated.effectiveParameterBindings);
    expect(draft.claimedRuleIds).toEqual(envelope.value.initialCandidate.claimedRuleIds);

    let accessorReads = 0;
    const accessorArgument = Object.defineProperties(
      {},
      {
        kind: { enumerable: true, value: "literal" },
        type: {
          enumerable: true,
          get: () => {
            accessorReads += 1;
            return "boolean";
          },
        },
        value: { enumerable: true, value: 0n },
      },
    );
    const inheritedArgument = Object.assign(Object.create({ type: "boolean" }), {
      kind: "literal",
      value: 0n,
    });
    const throwingArgument = new Proxy(
      {},
      {
        getPrototypeOf: () => {
          throw new TypeError("hostile prototype");
        },
      },
    );
    const hostileArguments: readonly unknown[] = [
      accessorArgument,
      inheritedArgument,
      throwingArgument,
      [],
      null,
      { kind: "literal", value: 0n },
      { kind: "literal", type: "not-scalar", value: 0n },
      { kind: "literal", type: "boolean", value: 2n },
      { kind: "literal", type: "byte", value: 256n },
      { kind: "literal", type: "boolean", value: 0n, extra: true },
    ];
    for (const argument of hostileArguments) {
      expect(
        validateReductionCandidateInvariantV1(fixture.envelope, {
          ...draft,
          transform: { ...draft.transform, argument },
        }),
      ).toMatchObject({ ok: false });
    }
    expect(accessorReads).toBe(0);
  });

  it("rejects hostile claim, pointer, binding, and token boundary aliases", () => {
    const typed = createTypedReductionImplFixtures(genuine.context, 16);
    const fixture = typed.find(({ envelope }) => {
      const initial = createInitialReductionCandidateV1(envelope);
      if (!initial.ok) return false;
      const projected = getValidatedReductionCandidateProjectionV1(initial.value);
      return projected.ok && projected.value.draft.kind === "typed-valid";
    });
    expect(fixture).toBeDefined();
    if (fixture === undefined) return;
    const initial = createInitialReductionCandidateV1(fixture.envelope);
    expect(initial).toMatchObject({ ok: true });
    if (!initial.ok) return;
    const projected = getValidatedReductionCandidateProjectionV1(initial.value);
    expect(projected).toMatchObject({ ok: true });
    if (!projected.ok || projected.value.draft.kind !== "typed-valid") return;
    const draft = projected.value.draft;
    const witness = draft.claimWitnesses[0];
    expect(witness).toBeDefined();
    if (witness === undefined) return;

    const hostileClaims = [
      { ...draft, claimedRuleIds: {} },
      { ...draft, claimWitnesses: {} },
      { ...draft, claimedRuleIds: [""] },
      { ...draft, claimedRuleIds: [draft.primaryRuleId, draft.primaryRuleId] },
      { ...draft, claimWitnesses: [witness, witness] },
    ];
    for (const hostile of hostileClaims) {
      expect(validateReductionCandidateInvariantV1(fixture.envelope, hostile)).toMatchObject({
        ok: false,
      });
    }

    for (const path of [
      "module",
      "/module/functions/01",
      "/module/functions/999999999999999999999999",
      "/module/functions/~2",
      "/module/functions/0/body/0/kind/child",
      "/module/functions/999",
      "/module/missing",
    ]) {
      expect(
        validateReductionCandidateInvariantV1(fixture.envelope, {
          ...draft,
          claimWitnesses: [{ ...witness, path }],
        }),
      ).toMatchObject({ ok: false });
    }

    for (const parameterBindings of [
      {},
      [{ kind: "parameter-value", parameterPath: "functions/0/parameters/0", value: 0n }],
      [{ kind: "parameter-value", parameterPath: "/functions/x/parameters/0", value: 0n }],
      [{ kind: "parameter-value", parameterPath: "/functions/0/parameters/x", value: 0n }],
      [{ kind: "parameter-value", parameterPath: "/functions/0/parameters/999", value: 0n }],
      [
        {
          kind: "parameter-value",
          parameterPath: "/functions/999999999999999999999999/parameters/0",
          value: 0n,
        },
      ],
    ]) {
      expect(
        validateReductionCandidateInvariantV1(fixture.envelope, { ...draft, parameterBindings }),
      ).toMatchObject({ ok: false });
    }

    const moduleResult = validateGeneratorIr({
      kind: "module",
      path: ["Candidate", "Bindings"],
      constants: [],
      functions: [
        {
          kind: "function",
          name: "main",
          parameters: [
            { name: "flag", type: "boolean" },
            { name: "byteValue", type: "byte" },
            { name: "signedByteValue", type: "sbyte" },
            { name: "wordValue", type: "word" },
            { name: "signedWordValue", type: "sword" },
          ],
          returnType: "void",
          body: [],
        },
      ],
    });
    expect(moduleResult).toMatchObject({ ok: true });
    if (!moduleResult.ok) return;
    const rendered = renderSourceModule(moduleResult.module, {
      maxSourceBytes: 1_048_576,
      literalSpellings: [],
    });
    expect(rendered).toMatchObject({ ok: true });
    if (!rendered.ok) return;
    const parameterBindings = [
      { kind: "parameter-value", parameterPath: "/functions/0/parameters/0", value: true },
      { kind: "parameter-value", parameterPath: "/functions/0/parameters/1", value: 255n },
      { kind: "parameter-value", parameterPath: "/functions/0/parameters/2", value: -128n },
      { kind: "parameter-value", parameterPath: "/functions/0/parameters/3", value: 65_535n },
      { kind: "parameter-value", parameterPath: "/functions/0/parameters/4", value: -32_768n },
    ] as const;
    expect(
      validateReductionCandidateInvariantV1(fixture.envelope, {
        ...draft,
        sourceBytes: rendered.sourceBytes,
        module: moduleResult.module,
        parameterBindings,
        claimWitnesses: [{ ...witness, path: "/module/functions/0" }],
      }),
    ).toMatchObject({ ok: false });
    const invalidValues = [0n, 256n, -129n, 65_536n, -32_769n] as const;
    for (const [index, value] of invalidValues.entries()) {
      const invalidBindings = parameterBindings.map((binding, bindingIndex) =>
        bindingIndex === index ? { ...binding, value } : binding,
      );
      expect(
        validateReductionCandidateInvariantV1(fixture.envelope, {
          ...draft,
          sourceBytes: rendered.sourceBytes,
          module: moduleResult.module,
          parameterBindings: invalidBindings,
          claimWitnesses: [{ ...witness, path: "/module/functions/0" }],
        }),
      ).toMatchObject({ ok: false });
    }

    const rawInitial = createInitialReductionCandidateV1(genuine.envelope);
    expect(rawInitial).toMatchObject({ ok: true });
    if (!rawInitial.ok) return;
    const rawProjection = getValidatedReductionCandidateProjectionV1(rawInitial.value);
    expect(rawProjection).toMatchObject({ ok: true });
    if (!rawProjection.ok || rawProjection.value.draft.kind !== "raw-malformed") return;
    const rawDraft = rawProjection.value.draft;
    const hostileRawDrafts = [
      { ...rawDraft, tokens: {} },
      {
        ...rawDraft,
        sourceBytes: new Uint8Array(),
        tokens: [{ kind: "unknown", startByte: 0, endByte: 1 }],
      },
      { ...rawDraft, sourceBytes: new Uint8Array(1_048_577), tokens: [] },
      { ...rawDraft, tokens: [{ kind: "unknown", startByte: "0", endByte: 1 }] },
      { ...rawDraft, tokens: [{ kind: "unknown", startByte: 0.5, endByte: 1 }] },
      { ...rawDraft, tokens: [{ kind: "unknown", startByte: 0, endByte: "1" }] },
      { ...rawDraft, tokens: [{ kind: "unknown", startByte: 0, endByte: 1.5 }] },
      { ...rawDraft, tokens: [{ kind: "unknown", startByte: 1, endByte: 1 }] },
      { ...rawDraft, tokens: [{ kind: "unknown", startByte: 0, endByte: 4 }] },
    ];
    for (const hostile of hostileRawDrafts) {
      expect(validateReductionCandidateInvariantV1(genuine.envelope, hostile)).toMatchObject({
        ok: false,
      });
    }
    expect(
      validateReductionCandidateInvariantV1(genuine.envelope, {
        ...rawDraft,
        sourceBytes: new Uint8Array(),
        tokens: [],
      }),
    ).toMatchObject({ ok: true });
  });

  it("keeps one proposal idempotent and rejects substituted evaluations without consuming it", () => {
    const budget = createFailureCampaignBudgetAuthorityV1(genuine.policy, {
      nonPassResults: 0,
      resolvableNonPassResults: 0,
    });
    expect(budget).toMatchObject({ ok: true });
    if (!budget.ok) return;
    const session = createFailureReductionSessionV1(genuine.envelope, budget.value);
    expect(session).toMatchObject({ ok: true });
    if (!session.ok) return;
    const first = nextFailureReductionStepV1(session.value);
    expect(first).toMatchObject({ ok: true, value: { kind: "execute-candidate" } });
    expect(nextFailureReductionStepV1(session.value)).toEqual(first);
    if (!first.ok || first.value.kind !== "execute-candidate") return;
    const consumed = consumeReductionCandidateInvocationV1(first.value.invocation);
    const envelope = getFailureEnvelopeProjectionV1(genuine.envelope);
    expect(consumed).toMatchObject({ ok: true });
    expect(envelope).toMatchObject({ ok: true });
    if (!consumed.ok || !envelope.ok) return;
    const base = {
      revision: "reduction-candidate-evaluation-v1",
      token: first.value.invocation.token,
      candidateDigest: consumed.value.candidate.candidateDigest,
      purpose: first.value.invocation.purpose,
      reproduced: false,
      observation: envelope.value.predicate.observation,
    };
    for (const evaluation of [
      { ...base, token: {} },
      { ...base, candidateDigest: `sha256:${"f".repeat(64)}` },
      { ...base, purpose: "confirmation" },
      { ...base, observation: { kind: "substituted" } },
    ]) {
      expect(recordFailureReductionEvaluationV1(session.value, evaluation)).toMatchObject({
        ok: false,
        issues: [{ code: "execution.identity" }],
      });
    }
    let advanced = recordFailureReductionEvaluationV1(session.value, base);
    expect(advanced).toMatchObject({ ok: true });
    expect(recordFailureReductionEvaluationV1(session.value, base)).toMatchObject({ ok: false });
    while (advanced.ok && advanced.value.kind === "execute-candidate") {
      const nextConsumed = consumeReductionCandidateInvocationV1(advanced.value.invocation);
      expect(nextConsumed).toMatchObject({ ok: true });
      if (!nextConsumed.ok) return;
      advanced = recordFailureReductionEvaluationV1(session.value, {
        revision: "reduction-candidate-evaluation-v1",
        token: advanced.value.invocation.token,
        candidateDigest: nextConsumed.value.candidate.candidateDigest,
        purpose: advanced.value.invocation.purpose,
        reproduced: false,
        observation: envelope.value.predicate.observation,
      });
    }
    expect(advanced).toMatchObject({ ok: true, value: { kind: "complete" } });
    expect(nextFailureReductionStepV1(session.value)).toEqual(advanced);
  });
});
