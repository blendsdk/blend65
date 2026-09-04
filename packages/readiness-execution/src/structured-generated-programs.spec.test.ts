import { createHash } from "node:crypto";

import { describe, expect, it, vi } from "vitest";

import {
  createOwnershipProbe,
  ownsNothing,
  scriptedWorker,
} from "./test-fixtures/execution-adapters-safety-spec-fixture.js";
import {
  STRUCTURED_EXECUTION_POLICY,
  STRUCTURED_EXECUTION_TIERS,
  STRUCTURED_PRIMARY_RULE_ID,
  STRUCTURED_ROUTE_PREREQUISITES,
  STRUCTURED_TIER_RESULT_CODES,
} from "./test-fixtures/structured-generated-programs-spec-fixture.js";

type UnknownCallable = (...args: unknown[]) => unknown;

const COMBINED_CASE_ID = "case.structured.vertical-combined-v1";

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function requireRecord(value: unknown, description: string): Record<string, unknown> {
  if (!isRecord(value)) {
    throw new TypeError(`expected ${description}`);
  }
  return value;
}

function isCallable(value: unknown): value is UnknownCallable {
  return typeof value === "function";
}

function requireCallable(module: Record<string, unknown>, name: string): UnknownCallable {
  const value = module[name];
  if (!isCallable(value)) {
    throw new TypeError(`missing ${name}`);
  }
  return value;
}

function requireOperationValue(result: unknown): Record<string, unknown> {
  const record = requireRecord(result, "successful operation result");
  expect(record).toMatchObject({ ok: true });
  return requireRecord(record.value, "operation value");
}

function expectedRank(caseDigest: string, tier: string): string {
  const preimage = `blend65.readiness.structured-route-rank.v1\0${caseDigest}\0${tier}`;
  return `sha256:${createHash("sha256").update(preimage, "utf8").digest("hex")}`;
}

function cancellation(): { readonly signal: AbortSignal; readonly deadlineMonotonicMs: number } {
  return {
    signal: new AbortController().signal,
    deadlineMonotonicMs: 10_000,
  };
}

function immediateTime() {
  return {
    monotonicNow: () => 0,
    waitUntil: async (_deadline: number, signal: AbortSignal) =>
      signal.aborted ? "cancelled" : "deadline",
  };
}

function inertViceResult() {
  return {
    status: "failure",
    tier: "vice",
    stage: "vice-launch",
    code: "tier-unavailable",
    usage: {
      wallMs: 0,
      outputBytes: 0,
      evidenceBytes: 0,
      instructions: 0,
      cycles: 0,
      launchAttempts: 0,
    },
    evidence: {
      digest: `sha256:${"0".repeat(64)}`,
      retainedBytes: 0,
      truncated: false,
    },
  };
}

async function readinessApi(): Promise<Record<string, unknown>> {
  return vi.importActual<Record<string, unknown>>("@blend65/readiness");
}

async function executionApi(): Promise<Record<string, unknown>> {
  return vi.importActual<Record<string, unknown>>("./index.js");
}

describe("combined structured program through public execution routes", () => {
  it("retains independent case identities while every declared route returns typed evidence", async () => {
    const [readiness, execution] = await Promise.all([readinessApi(), executionApi()]);
    const createExecutionCase = requireCallable(readiness, "createExecutionCaseV1");
    const getProjection = requireCallable(readiness, "getStructuredExecutionCaseProjectionV1");
    const getOracleContext = requireCallable(readiness, "getStructuredExecutionOracleContextV1");
    const deriveRank = requireCallable(execution, "deriveStructuredExecutionRouteRankV1");
    const createRouteRequest = requireCallable(execution, "createExecutionRouteRequestV1");
    const createSupervisor = requireCallable(execution, "createExecutionSupervisorV1");
    const createHandlers = requireCallable(execution, "createExecutionRouteHandlersV1");

    const executionCase = requireOperationValue(
      createExecutionCase({
        schemaVersion: 1,
        kind: "structured-generated",
        caseId: COMBINED_CASE_ID,
      }),
    );
    const projectionBefore = requireOperationValue(getProjection(executionCase));
    const oracleContext = requireOperationValue(getOracleContext(executionCase));
    const caseDigest = String(projectionBefore.caseDigest);

    expect(projectionBefore).toMatchObject({
      kind: "structured-generated",
      caseId: COMBINED_CASE_ID,
      caseDigest: expect.stringMatching(/^sha256:[0-9a-f]{64}$/u),
      sourceCaseDigest: caseDigest,
      oracleEvaluationIdentity: expect.stringMatching(/^sha256:[0-9a-f]{64}$/u),
      expectedObservation: {
        kind: "direct-mmio",
        address: 49_152,
        byteLength: 1,
        value: 12,
      },
    });

    for (const tier of STRUCTURED_EXECUTION_TIERS) {
      const rankDigest = deriveRank(caseDigest, tier);
      expect(rankDigest).toBe(expectedRank(caseDigest, tier));
      const route = {
        caseIdentity: caseDigest,
        ruleId: STRUCTURED_PRIMARY_RULE_ID,
        obligation: tier,
        terminalTier: tier,
        prerequisiteTiers: STRUCTURED_ROUTE_PREREQUISITES[tier],
        rankDigest,
      };
      const request = requireOperationValue(
        createRouteRequest({
          route,
          executionCase,
          oracle: oracleContext,
          policy: STRUCTURED_EXECUTION_POLICY,
        }),
      );
      expect(request).toMatchObject({
        route: {
          caseIdentity: caseDigest,
          ruleId: STRUCTURED_PRIMARY_RULE_ID,
          obligation: tier,
          terminalTier: tier,
          prerequisiteTiers: STRUCTURED_ROUTE_PREREQUISITES[tier],
          rankDigest,
        },
      });

      const ownership = createOwnershipProbe();
      const worker = scriptedWorker("success", ownership);
      const supervisor = requireOperationValue(
        createSupervisor(STRUCTURED_EXECUTION_POLICY, {
          workerExecutor: worker,
          time: immediateTime(),
        }),
      );
      const handlers = requireRecord(
        createHandlers({
          worker: { executor: worker },
          acme: { runner: { run: async () => ({ exitCode: 0, stderr: "" }) } },
          lifecycle: { supervisor },
          vice: { execute: async () => inertViceResult() },
        }),
        "execution route handlers",
      );
      const handler = requireRecord(handlers[tier], `${tier} route handler`);
      const execute = requireCallable(handler, "execute");
      const terminal = requireRecord(
        await Promise.resolve(execute(request, cancellation())),
        `${tier} terminal result`,
      );

      expect(STRUCTURED_TIER_RESULT_CODES[tier]).toContain(terminal.code);
      expect(terminal).toMatchObject({
        tier,
        stage: expect.any(String),
        evidence: {
          digest: expect.stringMatching(/^sha256:[0-9a-f]{64}$/u),
        },
      });

      const projectionAfter = requireOperationValue(getProjection(executionCase));
      expect(projectionAfter).toEqual(projectionBefore);
      expect(projectionAfter.expectedObservation).toEqual({
        kind: "direct-mmio",
        address: 49_152,
        byteLength: 1,
        value: 12,
      });
      expect(request.route).toEqual(route);

      const cleanup = requireCallable(supervisor, "cleanup");
      expect(await Promise.resolve(cleanup())).toMatchObject({ ok: true });
      expect(ownsNothing(ownership)).toBe(true);
    }
  });
});
