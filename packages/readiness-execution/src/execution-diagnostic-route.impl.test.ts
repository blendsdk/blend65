import { describe, expect, it, vi } from "vitest";

import type { ExecutionPolicyV1 } from "@blend65/readiness";
import type { PublishedDiagnosticCaseV1 } from "@blend65/readiness/published-oracle";

const AUTHORITY = vi.hoisted(() => ({
  first: Object.freeze({}),
  second: Object.freeze({}),
  firstCase: `sha256:${"1".repeat(64)}`,
  secondCase: `sha256:${"2".repeat(64)}`,
}));

vi.mock("@blend65/readiness/published-oracle", () => ({
  createPublishedOracleRequest: () => ({
    ok: false,
    diagnostics: [{ code: "oracle.authority.missing" }],
  }),
  getPublishedDiagnosticCaseProjectionV1: (value: unknown) => ({
    ok: true,
    value: {
      sourceCaseDigest: value === AUTHORITY.first ? AUTHORITY.firstCase : AUTHORITY.secondCase,
      expectedDiagnostic: { ruleId: "rule.diagnostic" },
    },
    diagnostics: [],
  }),
}));

import { createExecutionRouteRequestV1 } from "./execution-route-adapters.js";

const POLICY: ExecutionPolicyV1 = Object.freeze({
  revision: "execution-policy-v1",
  budget: Object.freeze({
    operationMs: 1_000,
    launchAttemptMs: 1_000,
    routeMs: 5_000,
    cleanupGraceMs: 1_000,
    outputBytes: 1_024,
    evidenceBytes: 4_096,
    instructions: 100,
    cycles: 1_000,
    launchAttempts: 2,
  }),
});

describe("diagnostic route authority pairing", () => {
  it("rejects a genuine diagnostic authority paired with another case identity", () => {
    const route = {
      caseIdentity: AUTHORITY.firstCase,
      ruleId: "rule.diagnostic",
      obligation: "frontend" as const,
      terminalTier: "frontend" as const,
      prerequisiteTiers: [],
      rankDigest: `sha256:${"3".repeat(64)}`,
    };
    expect(
      createExecutionRouteRequestV1({
        kind: "invalid-diagnostic",
        route,
        diagnosticCase: AUTHORITY.first as PublishedDiagnosticCaseV1,
        policy: POLICY,
      }),
    ).toMatchObject({ ok: true });

    expect(
      createExecutionRouteRequestV1({
        kind: "invalid-diagnostic",
        route,
        diagnosticCase: AUTHORITY.second as PublishedDiagnosticCaseV1,
        policy: POLICY,
      }),
    ).toMatchObject({
      ok: false,
      issues: [{ code: "invalid-evidence-input", path: "/route" }],
    });
  });
});
