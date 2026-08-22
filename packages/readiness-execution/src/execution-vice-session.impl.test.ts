import { describe, expect, it } from "vitest";

import type {
  ViceCheckpointHitV1,
  ViceControlIssueV1,
  ViceControlResultV1,
  ViceControlSessionV1,
} from "@blend65/test-harness/vice-control";

import type { RouteUsage } from "./execution-vice-policy.js";
import { runViceSessionV1 } from "./execution-vice-session.js";
import type { ViceRouteRequestV1 } from "./execution-vice-types.js";

const ok = <T>(value: T): ViceControlResultV1<T> => ({ ok: true, value });
const failed = <T>(
  reason: ViceControlIssueV1["reason"] = "vice.transport",
): ViceControlResultV1<T> => ({
  ok: false,
  issue: { code: "vice.io", reason, message: reason },
});

function routeRequest(): ViceRouteRequestV1 {
  return {
    binary: Uint8Array.of(0x60),
    loadAddress: 0x0801,
    entryAddress: 0x0810,
    fixture: { revision: "c64-vic-color-readback-v1", cells: [] },
    layout: {
      revision: "execution-observation-layout-v1",
      resultSymbols: ["result"],
      resultAddresses: [0x0200],
      completionSymbol: "complete",
      completionAddress: 0x0201,
      postEntryStores: [],
      proofDigest: "a".repeat(64),
    },
    observation: { kind: "scalar-bytes", byteLength: 1 },
    policy: {
      revision: "execution-policy-v1",
      budget: {
        operationMs: 60_000,
        launchAttemptMs: 15_000,
        routeMs: 120_000,
        cleanupGraceMs: 3_000,
        outputBytes: 1_048_576,
        evidenceBytes: 16_777_216,
        instructions: 1,
        cycles: 100,
        launchAttempts: 8,
      },
    },
  };
}

function controlSession(overrides: Partial<ViceControlSessionV1> = {}): ViceControlSessionV1 {
  let stopwatchCalls = 0;
  const hit: ViceCheckpointHitV1 = {
    checkpointId: 9,
    address: 0x0201,
    operation: "store",
  };
  return {
    loadBinary: async () => ok(true),
    readMemory: async (address) => ok(Uint8Array.of(address === 0x0201 ? 0xa5 : 0)),
    writeMemory: async () => ok(true),
    setProgramCounter: async () => ok(true),
    setCheckpoint: async () => ok(9),
    advanceInstructions: async () => ok(hit),
    readStopwatch: async () => ok(BigInt(stopwatchCalls++ * 10)),
    cancelPending: async () => ok(true),
    close: async () => ok(true),
    ...overrides,
  };
}

async function execute(
  session: ViceControlSessionV1,
  request = routeRequest(),
  wall = 0,
  signal: AbortSignal = new AbortController().signal,
): Promise<{ readonly code: string; readonly usage: RouteUsage }> {
  const usage: RouteUsage = { instructions: 0, cycles: 0, launchAttempts: 1 };
  const result = await runViceSessionV1(request, session, signal, usage, () => wall);
  return { code: result.code, usage };
}

describe("VICE session policy implementation", () => {
  it.each([
    ["binary load", { loadBinary: async () => failed<true>() }, "emulator-handshake-failure"],
    [
      "cancelled binary load",
      { loadBinary: async () => failed<true>("vice.cancelled") },
      "wall-time-exhaustion",
    ],
    [
      "program counter",
      { setProgramCounter: async () => failed<true>() },
      "emulator-handshake-failure",
    ],
    ["checkpoint", { setCheckpoint: async () => failed<number>() }, "emulator-handshake-failure"],
    [
      "baseline stopwatch",
      { readStopwatch: async () => failed<bigint>() },
      "emulator-handshake-failure",
    ],
    [
      "instruction advance",
      { advanceInstructions: async () => failed<ViceCheckpointHitV1 | null>() },
      "emulator-launch-failure",
    ],
    [
      "cancelled instruction advance",
      { advanceInstructions: async () => failed<ViceCheckpointHitV1 | null>("vice.cancelled") },
      "wall-time-exhaustion",
    ],
  ] as const)("maps a %s failure to %s", async (_name, override, expected) => {
    expect((await execute(controlSession(override))).code).toBe(expected);
  });

  it("performs no session work when cancellation already won", async () => {
    let loads = 0;
    const controller = new AbortController();
    controller.abort();
    const session = controlSession({
      loadBinary: async () => {
        loads += 1;
        return ok(true);
      },
    });
    expect((await execute(session, routeRequest(), 0, controller.signal)).code).toBe(
      "wall-time-exhaustion",
    );
    expect(loads).toBe(0);
  });

  it("rejects an unsupported fixture cell before writing it", async () => {
    const request = routeRequest();
    const mutant: ViceRouteRequestV1 = {
      ...request,
      fixture: {
        revision: "c64-vic-color-readback-v1",
        cells: [{ address: 0xd023, logicalValue: 1 }],
      },
    };
    expect((await execute(controlSession(), mutant)).code).toBe("invalid-evidence-input");
  });

  it.each([
    ["fixture write", { writeMemory: async () => failed<true>() }, "emulator-handshake-failure"],
    ["fixture read", { readMemory: async () => failed<Uint8Array>() }, "semantic-mismatch"],
    ["fixture mismatch", { readMemory: async () => ok(Uint8Array.of(0)) }, "semantic-mismatch"],
  ] as const)("fails closed on %s", async (_name, override, expected) => {
    const request = routeRequest();
    const mutant: ViceRouteRequestV1 = {
      ...request,
      fixture: {
        revision: "c64-vic-color-readback-v1",
        cells: [{ address: 0xd020, logicalValue: 1 }],
      },
    };
    expect((await execute(controlSession(override), mutant)).code).toBe(expected);
  });

  it("enforces the route work deadline before an instruction is sent", async () => {
    expect((await execute(controlSession(), routeRequest(), 200_000)).code).toBe(
      "wall-time-exhaustion",
    );
  });

  it.each([
    [{ checkpointId: 10, address: 0x0201, operation: "store" as const }, "wrong id"],
    [{ checkpointId: 9, address: 0x0202, operation: "store" as const }, "wrong address"],
    [{ checkpointId: 9, address: 0x0201, operation: "load" as const }, "wrong operation"],
  ])("rejects a checkpoint with $1", async (hit, _label) => {
    const session = controlSession({ advanceInstructions: async () => ok(hit) });
    expect((await execute(session)).code).toBe("semantic-mismatch");
  });

  it.each([
    [failed<Uint8Array>(), "missing marker"],
    [ok(Uint8Array.of(0)), "uncommitted marker"],
  ])("rejects %s", async (marker, _label) => {
    const session = controlSession({
      readMemory: async (address) => (address === 0x0201 ? marker : ok(Uint8Array.of(0))),
    });
    expect((await execute(session)).code).toBe("semantic-mismatch");
  });

  it("rejects a decreasing stopwatch", async () => {
    let calls = 0;
    const session = controlSession({ readStopwatch: async () => ok(calls++ === 0 ? 10n : 9n) });
    expect((await execute(session)).code).toBe("emulator-handshake-failure");
  });

  it("maps a failed post-advance stopwatch without losing the run stage", async () => {
    let calls = 0;
    const session = controlSession({
      readStopwatch: async () => (calls++ === 0 ? ok(0n) : failed<bigint>()),
    });
    expect((await execute(session)).code).toBe("emulator-handshake-failure");
  });

  it("rejects an unrepresentable stopwatch delta", async () => {
    let calls = 0;
    const session = controlSession({
      readStopwatch: async () => ok(calls++ === 0 ? 0n : BigInt(Number.MAX_SAFE_INTEGER) + 1n),
    });
    expect((await execute(session)).code).toBe("cycle-exhaustion");
  });

  it("rejects a cycle delta above the selected cumulative budget", async () => {
    let calls = 0;
    const session = controlSession({ readStopwatch: async () => ok(BigInt(calls++ * 101)) });
    expect((await execute(session)).code).toBe("cycle-exhaustion");
  });

  it("enforces the cumulative cycle budget after every instruction chunk", async () => {
    const counts: number[] = [];
    let stopwatchCalls = 0;
    const session = controlSession({
      advanceInstructions: async (count) => {
        counts.push(count);
        return ok(
          counts.length === 2 ? { checkpointId: 9, address: 0x0201, operation: "store" } : null,
        );
      },
      readStopwatch: async () => ok(BigInt(stopwatchCalls++ * 10)),
    });
    const request = routeRequest();
    const mutant: ViceRouteRequestV1 = {
      ...request,
      policy: {
        ...request.policy,
        budget: { ...request.policy.budget, instructions: 65_536, cycles: 15 },
      },
    };

    const result = await execute(session, mutant);

    expect(result).toEqual({
      code: "cycle-exhaustion",
      usage: { instructions: 65_536, cycles: 20, launchAttempts: 1 },
    });
    expect(counts).toEqual([65_535, 1]);
  });

  it("reports instruction exhaustion before simultaneous cycle exhaustion", async () => {
    let stopwatchCalls = 0;
    const session = controlSession({
      advanceInstructions: async () => ok(null),
      readStopwatch: async () => ok(BigInt(stopwatchCalls++ * 10)),
    });
    const request = routeRequest();
    const mutant: ViceRouteRequestV1 = {
      ...request,
      policy: {
        ...request.policy,
        budget: { ...request.policy.budget, cycles: 5 },
      },
    };

    const result = await execute(session, mutant);

    expect(result).toEqual({
      code: "instruction-exhaustion",
      usage: { instructions: 1, cycles: 10, launchAttempts: 1 },
    });
  });

  it("reports cumulative cycle exhaustion between null-hit instruction chunks", async () => {
    let stopwatchCalls = 0;
    const session = controlSession({
      advanceInstructions: async () => ok(null),
      readStopwatch: async () => ok(BigInt(stopwatchCalls++ * 10)),
    });
    const request = routeRequest();
    const mutant: ViceRouteRequestV1 = {
      ...request,
      policy: {
        ...request.policy,
        budget: { ...request.policy.budget, instructions: 65_536, cycles: 5 },
      },
    };
    expect((await execute(session, mutant)).code).toBe("cycle-exhaustion");
  });

  it("fails closed when an internal caller bypasses the positive instruction parser", async () => {
    const request = routeRequest();
    const mutant: ViceRouteRequestV1 = {
      ...request,
      policy: {
        ...request.policy,
        budget: { ...request.policy.budget, instructions: 0 },
      },
    };
    expect((await execute(controlSession(), mutant)).code).toBe("instruction-exhaustion");
  });

  it("rejects an unreadable observation byte after completion", async () => {
    const session = controlSession({
      readMemory: async (address) =>
        address === 0x0201 ? ok(Uint8Array.of(0xa5)) : failed<Uint8Array>(),
    });
    expect((await execute(session)).code).toBe("semantic-mismatch");
  });

  it("returns pass and charges the exact instruction and cycle totals", async () => {
    const result = await execute(controlSession());
    expect(result).toEqual({
      code: "pass",
      usage: { instructions: 1, cycles: 10, launchAttempts: 1 },
    });
  });
});
