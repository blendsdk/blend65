import { createHash } from "node:crypto";

import { describe, expect, it } from "vitest";

import { parseFailurePredicateIngredientsV1 } from "./failure-predicate-ingredients.js";

function digest(value: string): `sha256:${string}` {
  return `sha256:${createHash("sha256").update(value).digest("hex")}`;
}

function ingredients(): object {
  return {
    revision: "failure-predicate-ingredients-v1",
    resultCode: "compiler-ice",
    terminalTier: "frontend",
    terminalStage: "frontend",
    observation: {
      kind: "not-reached",
      stage: "frontend",
      terminalReasonDigest: digest("evidence"),
    },
    cleanup: "cleanup-clear",
    primaryRuleId: "rule.example",
    requiredClaimedRuleIds: ["rule.example"],
    target: "c64",
    routeContract: {
      originalRouteKind: "valid-envelope",
      terminalTier: "frontend",
      obligation: "frontend",
      prerequisiteTiers: [],
      policyDigest: digest("policy"),
      fixtureDigest: digest("fixture"),
      oracleContractDigest: digest("oracle"),
      toolContractDigests: [],
    },
  };
}

describe("failure predicate ingredients", () => {
  it("normalizes exact data-only facts and rejects non-exact or hostile records", () => {
    expect(parseFailurePredicateIngredientsV1(ingredients())).toMatchObject({
      ok: true,
      value: {
        revision: "failure-predicate-ingredients-v1",
        requiredClaimedRuleIds: ["rule.example"],
      },
    });
    for (const input of [
      undefined,
      [],
      { ...ingredients(), extra: true },
      { ...ingredients(), revision: "failure-predicate-v1" },
      { ...ingredients(), resultCode: "pass" },
      Object.create({ inherited: true }),
      Object.defineProperty(ingredients(), "resultCode", { get: () => "compiler-ice" }),
    ]) {
      expect(parseFailurePredicateIngredientsV1(input)).toMatchObject({ ok: false });
    }
    const revoked = Proxy.revocable(ingredients(), {});
    revoked.revoke();
    expect(parseFailurePredicateIngredientsV1(revoked.proxy)).toMatchObject({ ok: false });
  });
});
