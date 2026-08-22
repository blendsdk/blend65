import { describe, expect, it } from "vitest";

import type { ExecutionOperationResultV1, ExecutionPolicyV1 } from "@blend65/readiness";

import {
  createExecutionBudgetScopeV1,
  createExecutionEvidenceLedgerV1,
} from "./execution-budget.js";

const POLICY: ExecutionPolicyV1 = {
  revision: "execution-policy-v1",
  budget: {
    operationMs: 100,
    launchAttemptMs: 100,
    routeMs: 1_000,
    cleanupGraceMs: 100,
    outputBytes: 10,
    evidenceBytes: 10,
    instructions: 10,
    cycles: 10,
    launchAttempts: 2,
  },
};

function requireSuccess<T>(result: ExecutionOperationResultV1<T>): T {
  expect(result.ok).toBe(true);
  if (!result.ok) throw new TypeError(JSON.stringify(result.issues));
  return result.value;
}

function expectCode(result: ExecutionOperationResultV1<unknown>, code: string): void {
  expect(result.ok).toBe(false);
  if (!result.ok) expect(result.issues[0].code).toBe(code);
}

function stopwatch(identity: string, absoluteCycles: bigint) {
  return {
    revision: "execution-stopwatch-sample-v1" as const,
    childIdentityDigest: identity,
    absoluteCycles,
  };
}

describe("execution evidence ledger", () => {
  it("should hash complete accepted chunks without retaining caller-owned bytes", () => {
    const ledger = requireSuccess(createExecutionEvidenceLedgerV1(4));
    const bytes = Uint8Array.of(1, 2);
    const first = requireSuccess(ledger.append(bytes));
    bytes.fill(9);
    const second = requireSuccess(ledger.append(Uint8Array.of(3, 4)));

    expect(first).toMatchObject({ retainedBytes: 2, truncated: false });
    expect(second).toEqual(ledger.summarize());
    expect(second.digest).toBe(
      "sha256:9f64a747e1b97f131fabb6b447296c9b6f0201e79fb3c5356e6c77e89b6a806a",
    );
  });

  it("should reject invalid limits, non-byte input, and overflow before mutation", () => {
    expectCode(createExecutionEvidenceLedgerV1(0), "execution.invalid-schema");
    expectCode(createExecutionEvidenceLedgerV1(16_777_217), "execution.invalid-schema");
    const ledger = requireSuccess(createExecutionEvidenceLedgerV1(1));
    expectCode(
      Reflect.apply(ledger.append, ledger, ["not-bytes"]) as ExecutionOperationResultV1<unknown>,
      "invalid-evidence-input",
    );
    const before = ledger.summarize();
    expectCode(ledger.append(Uint8Array.of(1, 2)), "evidence-exhaustion");
    expect(ledger.summarize()).toEqual(before);
  });
});

describe("execution cumulative budget", () => {
  it("should reject invalid policies and unsafe monotonic starts", () => {
    expectCode(
      Reflect.apply(createExecutionBudgetScopeV1, undefined, [
        { ...POLICY, revision: "future-policy" },
        0,
      ]) as ExecutionOperationResultV1<unknown>,
      "execution.invalid-schema",
    );
    expectCode(
      createExecutionBudgetScopeV1(
        { ...POLICY, budget: { ...POLICY.budget, routeMs: 100, cleanupGraceMs: 100 } },
        0,
      ),
      "execution.invalid-schema",
    );
    expectCode(createExecutionBudgetScopeV1(POLICY, Number.NaN), "execution.invalid-schema");
    expectCode(
      createExecutionBudgetScopeV1({ ...POLICY, budget: { ...POLICY.budget, outputBytes: 0 } }, 0),
      "execution.invalid-schema",
    );
  });

  it("should bound operations and launches by remaining work time", () => {
    const scope = requireSuccess(createExecutionBudgetScopeV1(POLICY, 10));
    expect(requireSuccess(scope.beginOperation("frontend", 20)).deadlineMonotonicMs).toBe(120);
    expect(requireSuccess(scope.beginOperation("emit", 905)).deadlineMonotonicMs).toBe(910);
    expectCode(scope.beginOperation("frontend", 911), "wall-time-exhaustion");
    expectCode(
      Reflect.apply(scope.beginOperation, scope, [
        "wrong",
        20,
      ]) as ExecutionOperationResultV1<unknown>,
      "invalid-evidence-input",
    );
    expectCode(scope.beginLaunchAttempt(-1), "invalid-evidence-input");
    expect(requireSuccess(scope.beginLaunchAttempt(20)).ordinal).toBe(1);
    expect(requireSuccess(scope.beginLaunchAttempt(30)).ordinal).toBe(2);
    expectCode(scope.beginLaunchAttempt(40), "emulator-launch-failure");
  });

  it("should leave counters unchanged after invalid and exhausted charges", () => {
    const scope = requireSuccess(createExecutionBudgetScopeV1(POLICY, 0));
    expectCode(scope.chargeOutput(-1), "invalid-evidence-input");
    expectCode(scope.chargeEvidence(11), "evidence-exhaustion");
    expectCode(scope.chargeInstructions(11), "instruction-exhaustion");
    expect(requireSuccess(scope.chargeOutput(10)).outputBytes).toBe(10);
    expect(requireSuccess(scope.chargeEvidence(10)).evidenceBytes).toBe(10);
    expect(requireSuccess(scope.chargeInstructions(10)).instructions).toBe(10);
    expectCode(scope.chargeOutput(1), "output-exhaustion");
    expectCode(scope.snapshot(1_001), "wall-time-exhaustion");
    expectCode(scope.snapshot(-1), "invalid-evidence-input");
  });

  it("should reject stopwatch protocol races and charge only valid absolute deltas", () => {
    const scope = requireSuccess(createExecutionBudgetScopeV1(POLICY, 0));
    const identity = `sha256:${"1".repeat(64)}`;
    expectCode(scope.completeStopwatch(stopwatch(identity, 1n)), "invalid-evidence-input");
    expectCode(scope.beginStopwatch({}), "invalid-evidence-input");
    expectCode(
      scope.beginStopwatch(
        Object.assign(Object.create({ inherited: true }), stopwatch(identity, 100n)),
      ),
      "invalid-evidence-input",
    );
    const nonEnumerable = stopwatch(identity, 100n);
    Object.defineProperty(nonEnumerable, "revision", {
      value: nonEnumerable.revision,
      enumerable: false,
    });
    expectCode(scope.beginStopwatch(nonEnumerable), "invalid-evidence-input");
    expectCode(
      scope.beginStopwatch({ ...stopwatch(identity, 100n), revision: "future" }),
      "invalid-evidence-input",
    );
    const revoked = Proxy.revocable(stopwatch(identity, 100n), {});
    revoked.revoke();
    expectCode(scope.beginStopwatch(revoked.proxy), "invalid-evidence-input");
    requireSuccess(scope.beginStopwatch(stopwatch(identity, 100n)));
    expectCode(scope.beginStopwatch(stopwatch(identity, 100n)), "invalid-evidence-input");
    expectCode(
      scope.completeStopwatch(stopwatch(`sha256:${"2".repeat(64)}`, 101n)),
      "invalid-evidence-input",
    );
    expectCode(scope.completeStopwatch(stopwatch(identity, 99n)), "invalid-evidence-input");
    expect(requireSuccess(scope.completeStopwatch(stopwatch(identity, 110n))).cycles).toBe(10);
    requireSuccess(scope.beginStopwatch(stopwatch(identity, 200n)));
    expectCode(scope.completeStopwatch(stopwatch(identity, 201n)), "cycle-exhaustion");
  });
});
