import { describe, expect, it } from "vitest";

import {
  createIdentityCollisionRegistry,
  deriveFailurePredicateIdentityV1,
  deriveFailureReductionRunIdentityV1,
  derivePromotedFailureKeyV1,
  FAILURE_REDUCTION_DEFAULT_POLICY_V1,
} from "./index.js";

import type { FailurePredicateV1, Sha256Digest } from "./index.js";

function digest(character: string): Sha256Digest {
  return `sha256:${character.repeat(64)}`;
}

function predicate(): FailurePredicateV1 {
  return {
    revision: "failure-predicate-v1",
    resultCode: "semantic-mismatch",
    terminalTier: "vice",
    terminalStage: "compare",
    observation: { kind: "observed", digest: digest("a") },
    cleanup: "cleanup-clear",
    primaryRuleId: "rule.primary",
    requiredClaimedRuleIds: ["rule.primary"],
    target: "c64",
    routeContract: {
      originalRouteKind: "valid-envelope",
      terminalTier: "vice",
      obligation: "runtime-state",
      prerequisiteTiers: ["frontend", "compiler-api", "cli", "emit", "acme"],
      policyDigest: digest("b"),
      fixtureDigest: digest("c"),
      oracleContractDigest: digest("d"),
      toolContractDigests: [digest("e")],
    },
  };
}

describe("failure identity validation", () => {
  it("should normalize legacy route kind only to valid-envelope and freeze sets", () => {
    const currentRoute = predicate().routeContract;
    const legacyRoute = {
      terminalTier: currentRoute.terminalTier,
      obligation: currentRoute.obligation,
      prerequisiteTiers: currentRoute.prerequisiteTiers,
      policyDigest: currentRoute.policyDigest,
      fixtureDigest: currentRoute.fixtureDigest,
      oracleContractDigest: currentRoute.oracleContractDigest,
      toolContractDigests: currentRoute.toolContractDigests,
    };
    const legacy = deriveFailurePredicateIdentityV1({ ...predicate(), routeContract: legacyRoute });
    const explicit = deriveFailurePredicateIdentityV1(predicate());
    expect(legacy).toMatchObject({
      ok: true,
      value: { digest: explicit.ok ? explicit.value.digest : "" },
    });
    if (!legacy.ok) throw new TypeError(legacy.issues[0].message);
    expect(legacy.value.predicate.routeContract.originalRouteKind).toBe("valid-envelope");
    expect(Object.isFrozen(legacy.value.predicate.requiredClaimedRuleIds)).toBe(true);
    expect(
      deriveFailurePredicateIdentityV1({
        ...predicate(),
        routeContract: { ...predicate().routeContract, originalRouteKind: "unknown" },
      }),
    ).toMatchObject({ ok: false });
  });

  it("should distinguish route kind, required claims, and not-reached observations", () => {
    const base = deriveFailurePredicateIdentityV1(predicate());
    const diagnostic = deriveFailurePredicateIdentityV1({
      ...predicate(),
      routeContract: { ...predicate().routeContract, originalRouteKind: "invalid-diagnostic" },
    });
    const claims = deriveFailurePredicateIdentityV1({
      ...predicate(),
      requiredClaimedRuleIds: ["rule.primary", "rule.required"],
    });
    const notReached = deriveFailurePredicateIdentityV1({
      ...predicate(),
      observation: {
        kind: "not-reached",
        stage: "run",
        terminalReasonDigest: digest("f"),
      },
    });
    expect(base.ok && diagnostic.ok && base.value.digest !== diagnostic.value.digest).toBe(true);
    expect(base.ok && claims.ok && base.value.digest !== claims.value.digest).toBe(true);
    expect(base.ok && notReached.ok && base.value.digest !== notReached.value.digest).toBe(true);
  });

  it("should ignore cleanup only for campaign-only predicates", () => {
    const campaignOnly = { ...predicate(), resultCode: "tier-unavailable" as const };
    const clear = deriveFailurePredicateIdentityV1(campaignOnly);
    const blocked = deriveFailurePredicateIdentityV1({
      ...campaignOnly,
      cleanup: "cleanup-blocked",
    });
    expect(clear.ok && blocked.ok && clear.value.digest === blocked.value.digest).toBe(true);

    const semanticBlocked = deriveFailurePredicateIdentityV1({
      ...predicate(),
      cleanup: "cleanup-blocked",
    });
    const semanticClear = deriveFailurePredicateIdentityV1(predicate());
    expect(
      semanticBlocked.ok &&
        semanticClear.ok &&
        semanticBlocked.value.digest !== semanticClear.value.digest,
    ).toBe(true);
  });

  it("should isolate returned canonical bytes and reject ill-formed identity text", () => {
    const identity = deriveFailurePredicateIdentityV1(predicate());
    if (!identity.ok) throw new TypeError(identity.issues[0].message);
    const original = identity.value.canonicalBytes;
    const changed = identity.value.canonicalBytes;
    changed[0] ^= 0xff;
    expect(identity.value.canonicalBytes).toEqual(original);
    expect(identity.value.canonicalBytes).not.toBe(original);

    expect(
      deriveFailurePredicateIdentityV1({
        ...predicate(),
        routeContract: { ...predicate().routeContract, obligation: "\ud800" },
      }),
    ).toMatchObject({ ok: false });
    expect(
      deriveFailurePredicateIdentityV1({
        ...predicate(),
        routeContract: { ...predicate().routeContract, obligation: "\ufffd" },
      }),
    ).toMatchObject({ ok: true });
  });

  it("should reject revision drift, extra keys, duplicate sets, and hostile access", () => {
    expect(
      deriveFailurePredicateIdentityV1({ ...predicate(), revision: "failure-predicate-v2" }),
    ).toMatchObject({ ok: false });
    expect(deriveFailurePredicateIdentityV1({ ...predicate(), extra: true })).toMatchObject({
      ok: false,
    });
    expect(
      deriveFailurePredicateIdentityV1({
        ...predicate(),
        requiredClaimedRuleIds: ["rule.primary", "rule.primary"],
      }),
    ).toMatchObject({ ok: false });
    const hostile = new Proxy(predicate(), {
      getOwnPropertyDescriptor() {
        throw new TypeError("must not escape");
      },
    });
    expect(() => deriveFailurePredicateIdentityV1(hostile)).not.toThrow();
    expect(deriveFailurePredicateIdentityV1(hostile)).toMatchObject({ ok: false });

    const invalidRoutes = [
      { ...predicate().routeContract, prerequisiteTiers: ["frontend", "frontend"] },
      { ...predicate().routeContract, toolContractDigests: [digest("e"), digest("e")] },
      { ...predicate().routeContract, obligation: "" },
      { ...predicate().routeContract, fixtureDigest: "invalid" },
      { ...predicate().routeContract, originalRouteKind: undefined },
      { ...predicate().routeContract, extra: true },
    ];
    for (const routeContract of invalidRoutes) {
      expect(deriveFailurePredicateIdentityV1({ ...predicate(), routeContract })).toMatchObject({
        ok: false,
      });
    }
    expect(
      deriveFailurePredicateIdentityV1({
        ...predicate(),
        observation: { kind: "not-reached", stage: "run", terminalReasonDigest: "invalid" },
      }),
    ).toMatchObject({ ok: false });
  });

  it("should fail closed when canonical preimages collide", () => {
    const registry = createIdentityCollisionRegistry(() => new Uint8Array(32));
    expect(deriveFailurePredicateIdentityV1(predicate(), registry).ok).toBe(true);
    expect(
      deriveFailurePredicateIdentityV1(
        { ...predicate(), primaryRuleId: "rule.different" },
        registry,
      ),
    ).toMatchObject({ ok: false });
  });
});

describe("promotion and run identity history", () => {
  it("should keep promotion campaign-independent while run policy remains identity-bearing", () => {
    const first = derivePromotedFailureKeyV1(digest("1"), predicate());
    const second = derivePromotedFailureKeyV1(digest("1"), predicate());
    expect(first).toEqual(second);

    const baseRun = {
      historicalEnvelopeDigest: digest("2"),
      predicateDigest: first.ok ? first.value.predicateDigest : digest("3"),
      policy: FAILURE_REDUCTION_DEFAULT_POLICY_V1,
      traceDigest: digest("4"),
    };
    const changedPolicy = {
      ...FAILURE_REDUCTION_DEFAULT_POLICY_V1,
      budget: {
        ...FAILURE_REDUCTION_DEFAULT_POLICY_V1.budget,
        transformationAttempts:
          FAILURE_REDUCTION_DEFAULT_POLICY_V1.budget.transformationAttempts - 1,
      },
    };
    const run = deriveFailureReductionRunIdentityV1(baseRun);
    const changed = deriveFailureReductionRunIdentityV1({ ...baseRun, policy: changedPolicy });
    expect(run.ok && changed.ok && run.value.digest !== changed.value.digest).toBe(true);
  });

  it("should reject malformed content, history revision drift, and collision substitution", () => {
    expect(derivePromotedFailureKeyV1("not-a-digest", predicate())).toMatchObject({ ok: false });
    expect(derivePromotedFailureKeyV1(digest("1"), { ...predicate(), extra: true })).toMatchObject({
      ok: false,
    });
    expect(
      deriveFailureReductionRunIdentityV1({
        historicalEnvelopeDigest: digest("2"),
        predicateDigest: digest("3"),
        policy: { ...FAILURE_REDUCTION_DEFAULT_POLICY_V1, revision: "failure-reduction-policy-v2" },
        traceDigest: digest("4"),
      }),
    ).toMatchObject({ ok: false });
    expect(
      deriveFailureReductionRunIdentityV1({
        historicalEnvelopeDigest: digest("2"),
        predicateDigest: digest("3"),
        policy: FAILURE_REDUCTION_DEFAULT_POLICY_V1,
        traceDigest: digest("4"),
        extra: true,
      }),
    ).toMatchObject({ ok: false });

    const registry = createIdentityCollisionRegistry(() => new Uint8Array(32));
    expect(derivePromotedFailureKeyV1(digest("1"), predicate(), registry)).toMatchObject({
      ok: false,
    });
    const runRegistry = createIdentityCollisionRegistry(() => new Uint8Array(32));
    const runInput = {
      historicalEnvelopeDigest: digest("2"),
      predicateDigest: digest("3"),
      policy: FAILURE_REDUCTION_DEFAULT_POLICY_V1,
      traceDigest: digest("4"),
    };
    expect(deriveFailureReductionRunIdentityV1(runInput, runRegistry).ok).toBe(true);
    expect(
      deriveFailureReductionRunIdentityV1({ ...runInput, traceDigest: digest("5") }, runRegistry),
    ).toMatchObject({ ok: false });
  });
});
