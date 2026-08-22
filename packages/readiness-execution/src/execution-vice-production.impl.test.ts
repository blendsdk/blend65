import { describe, expect, it } from "vitest";

import { hasVice } from "@blend65/test-harness";

import { createViceExecutionRuntimeV1 } from "./execution-vice.js";
import type { ViceRouteRequestV1 } from "./execution-vice-types.js";

function completingRoute(): ViceRouteRequestV1 {
  return {
    binary: Uint8Array.of(0xa9, 0xa5, 0x8d, 0x01, 0x02, 0xea),
    loadAddress: 0x0810,
    entryAddress: 0x0810,
    fixture: { revision: "c64-vic-color-readback-v1", cells: [] },
    layout: {
      revision: "execution-observation-layout-v1",
      resultSymbols: ["result"],
      resultAddresses: [0x0200],
      completionSymbol: "complete",
      completionAddress: 0x0201,
      postEntryStores: [
        {
          instructionAddress: 0x0812,
          targetAddress: 0x0200,
          kind: "observation-byte",
          byteIndex: 0,
        },
        {
          instructionAddress: 0x0815,
          targetAddress: 0x0201,
          kind: "completion",
          value: 165,
        },
      ],
      proofDigest: "a".repeat(64),
    },
    observation: { kind: "scalar-bytes", byteLength: 1 },
    policy: {
      revision: "execution-policy-v1",
      budget: {
        operationMs: 60_000,
        launchAttemptMs: 15_000,
        routeMs: 60_000,
        cleanupGraceMs: 3_000,
        outputBytes: 1_048_576,
        evidenceBytes: 16_777_216,
        instructions: 10,
        cycles: 10_000,
        launchAttempts: 1,
      },
    },
  };
}

describe.skipIf(
  process.platform !== "linux" || typeof process.execve !== "function" || !hasVice("c64"),
)("production VICE lease and launcher", () => {
  it("records, execs, controls and cleans one same-PID child under the fixed namespace", async () => {
    const signal = AbortSignal.timeout(60_000);
    const runtime = createViceExecutionRuntimeV1();
    const lease = await runtime.acquireViceLease("c64", signal);
    expect(lease.ok).toBe(true);
    if (!lease.ok) return;

    const result = await runtime.executeViceRoute(completingRoute(), lease.value, signal);

    expect(result).toMatchObject({
      status: "pass",
      code: "pass",
      usage: { instructions: 10, launchAttempts: 1 },
    });

    const nextRuntime = createViceExecutionRuntimeV1();
    const nextLease = await nextRuntime.acquireViceLease("c64", signal);
    expect(nextLease.ok).toBe(true);
    if (nextLease.ok) {
      const cancelled = new AbortController();
      cancelled.abort();
      const cleanup = await nextRuntime.executeViceRoute(
        completingRoute(),
        nextLease.value,
        cancelled.signal,
      );
      expect(cleanup).toMatchObject({ code: "wall-time-exhaustion" });
    }
  }, 90_000);

  it("retains private anchor cleanup authority after route work is cancelled", async () => {
    const runtime = createViceExecutionRuntimeV1();
    const lease = await runtime.acquireViceLease("c64", AbortSignal.timeout(60_000));
    expect(lease.ok).toBe(true);
    if (!lease.ok) return;
    const work = new AbortController();
    const abort = setTimeout(() => work.abort(), 250);
    try {
      expect(
        await runtime.executeViceRoute(completingRoute(), lease.value, work.signal),
      ).toMatchObject({ code: "wall-time-exhaustion" });
    } finally {
      clearTimeout(abort);
    }

    const recovery = createViceExecutionRuntimeV1();
    const next = await recovery.acquireViceLease("c64", AbortSignal.timeout(60_000));
    expect(next.ok).toBe(true);
    if (next.ok) {
      const cancelled = new AbortController();
      cancelled.abort();
      expect(
        await recovery.executeViceRoute(completingRoute(), next.value, cancelled.signal),
      ).toMatchObject({ code: "wall-time-exhaustion" });
    }
  }, 90_000);
});
