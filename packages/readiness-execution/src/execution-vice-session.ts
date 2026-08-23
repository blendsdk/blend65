import type { ViceControlSessionV1 } from "@blend65/test-harness/vice-control";
import type { ExecutionResultV1 } from "@blend65/readiness";
import { projectC64InitialStateV1 } from "@blend65/readiness/execution-runtime";

import {
  mapControlIssue,
  MAX_WIRE_INSTRUCTIONS,
  routeFailure,
  routePass,
  type RouteUsage,
} from "./execution-vice-policy.js";
import type { ViceRouteRequestV1 } from "./execution-vice-types.js";

/** Private completed-session observation retained only until readiness comparison. */
export interface EvaluatedViceSessionObservationV1 {
  /** Declared actual-observation discriminator. */
  readonly kind: "scalar-bytes" | "direct-mmio";
  /** Owned bytes copied from stopped-machine readback. */
  readonly bytes: Uint8Array;
}

/** Internal session terminal plus optional privately collected actual bytes. */
export interface ViceSessionRunResultV1 {
  /** Closed route terminal before host-oracle comparison. */
  readonly result: ExecutionResultV1;
  /** Actual bytes present only after exact completion in evaluated mode. */
  readonly actual?: EvaluatedViceSessionObservationV1;
}

/** Preserves deadline cancellation while retaining each command's stable fallback classification. */
function commandFailure(
  reason: Parameters<typeof mapControlIssue>[0],
  fallback: "emulator-handshake-failure" | "semantic-mismatch",
  stage: "fixture" | "run" | "observe",
  usage: RouteUsage,
  wall: () => number,
): ExecutionResultV1 {
  return routeFailure(
    reason.reason === "vice.cancelled" ? "wall-time-exhaustion" : fallback,
    stage,
    usage,
    wall(),
  );
}

function terminal(result: ExecutionResultV1): ViceSessionRunResultV1 {
  return Object.freeze({ result });
}

async function readActualBytes(
  request: ViceRouteRequestV1,
  session: ViceControlSessionV1,
  usage: RouteUsage,
  wall: () => number,
): Promise<ViceSessionRunResultV1 | EvaluatedViceSessionObservationV1> {
  if (request.observation.kind === "direct-mmio") {
    if (request.observation.address === undefined) {
      return terminal(routeFailure("invalid-evidence-input", "observe", usage, wall()));
    }
    const read = await session.readMemory(
      request.observation.address,
      request.observation.byteLength,
    );
    return read.ok
      ? Object.freeze({ kind: "direct-mmio", bytes: read.value.slice() })
      : terminal(commandFailure(read.issue, "semantic-mismatch", "observe", usage, wall));
  }
  const bytes = new Uint8Array(request.observation.byteLength);
  for (let index = 0; index < request.layout.resultAddresses.length; index += 1) {
    const address = request.layout.resultAddresses[index];
    if (address === undefined) {
      return terminal(routeFailure("invalid-evidence-input", "observe", usage, wall()));
    }
    const read = await session.readMemory(address, 1);
    if (!read.ok) {
      return terminal(commandFailure(read.issue, "semantic-mismatch", "observe", usage, wall));
    }
    bytes[index] = read.value[0]!;
  }
  return Object.freeze({ kind: "scalar-bytes", bytes });
}

/** Runs one handshaken VICE session and optionally retains exact stopped-machine actual bytes. */
async function runViceSessionCoreV1(
  request: ViceRouteRequestV1,
  session: ViceControlSessionV1,
  signal: AbortSignal,
  usage: RouteUsage,
  wall: () => number,
  collectActual: boolean,
): Promise<ViceSessionRunResultV1> {
  const abort = (): void => {
    void session.cancelPending();
  };
  signal.addEventListener("abort", abort, { once: true });
  try {
    if (signal.aborted) {
      await session.cancelPending();
      return terminal(routeFailure("wall-time-exhaustion", "fixture", usage, wall()));
    }
    const loaded = await session.loadBinary(request.binary.slice(), request.loadAddress);
    if (!loaded.ok) {
      return terminal(
        commandFailure(loaded.issue, "emulator-handshake-failure", "fixture", usage, wall),
      );
    }
    for (const cell of request.fixture.cells) {
      const projected = projectC64InitialStateV1(cell.address, cell.logicalValue);
      if (!projected.ok) {
        return terminal(routeFailure("invalid-evidence-input", "fixture", usage, wall()));
      }
      const written = await session.writeMemory(cell.address, Uint8Array.of(cell.logicalValue));
      if (!written.ok) {
        return terminal(
          commandFailure(written.issue, "emulator-handshake-failure", "fixture", usage, wall),
        );
      }
      const readback = await session.readMemory(cell.address, 1);
      if (!readback.ok) {
        return terminal(
          commandFailure(readback.issue, "semantic-mismatch", "fixture", usage, wall),
        );
      }
      if (readback.value[0] !== projected.value) {
        return terminal(
          routeFailure(
            collectActual ? "invalid-evidence-input" : "semantic-mismatch",
            "fixture",
            usage,
            wall(),
          ),
        );
      }
    }
    if (collectActual) {
      const cleared = await session.writeMemory(request.layout.completionAddress, Uint8Array.of(0));
      if (!cleared.ok) {
        return terminal(
          commandFailure(cleared.issue, "emulator-handshake-failure", "fixture", usage, wall),
        );
      }
      const clearReadback = await session.readMemory(request.layout.completionAddress, 1);
      if (!clearReadback.ok) {
        return terminal(
          commandFailure(clearReadback.issue, "semantic-mismatch", "fixture", usage, wall),
        );
      }
      if (clearReadback.value[0] !== 0) {
        return terminal(routeFailure("semantic-mismatch", "fixture", usage, wall()));
      }
    }
    const pc = await session.setProgramCounter(request.entryAddress);
    if (!pc.ok) {
      return terminal(
        commandFailure(pc.issue, "emulator-handshake-failure", "fixture", usage, wall),
      );
    }
    const checkpoint = await session.setCheckpoint(request.layout.completionAddress, "store");
    if (!checkpoint.ok) {
      return terminal(
        commandFailure(checkpoint.issue, "emulator-handshake-failure", "run", usage, wall),
      );
    }
    const baseline = await session.readStopwatch();
    if (!baseline.ok) {
      return terminal(
        commandFailure(baseline.issue, "emulator-handshake-failure", "run", usage, wall),
      );
    }

    let previousStopwatch = baseline.value;
    let remaining = request.policy.budget.instructions;
    while (remaining > 0) {
      if (
        signal.aborted ||
        wall() > request.policy.budget.routeMs - request.policy.budget.cleanupGraceMs
      ) {
        return terminal(routeFailure("wall-time-exhaustion", "run", usage, wall()));
      }
      const count = Math.min(MAX_WIRE_INSTRUCTIONS, remaining);
      usage.instructions += count;
      remaining -= count;
      const advanced = await session.advanceInstructions(count);
      if (!advanced.ok) {
        const mapped = mapControlIssue(advanced.issue);
        return terminal(routeFailure(mapped.code, "run", usage, wall()));
      }
      const stopped = await session.readStopwatch();
      if (!stopped.ok) {
        return terminal(
          commandFailure(stopped.issue, "emulator-handshake-failure", "run", usage, wall),
        );
      }
      if (stopped.value < previousStopwatch) {
        return terminal(routeFailure("emulator-handshake-failure", "run", usage, wall()));
      }
      const delta = stopped.value - previousStopwatch;
      previousStopwatch = stopped.value;
      if (delta > BigInt(Number.MAX_SAFE_INTEGER)) {
        return terminal(routeFailure("cycle-exhaustion", "run", usage, wall()));
      }
      usage.cycles += Number(delta);
      const cycleExhausted = usage.cycles > request.policy.budget.cycles;
      if (!collectActual && cycleExhausted) {
        return terminal(routeFailure("cycle-exhaustion", "run", usage, wall()));
      }
      if (advanced.value === null) {
        if (remaining === 0) {
          return terminal(routeFailure("instruction-exhaustion", "run", usage, wall()));
        }
        if (cycleExhausted) {
          return terminal(routeFailure("cycle-exhaustion", "run", usage, wall()));
        }
        continue;
      }
      if (
        advanced.value.checkpointId !== checkpoint.value ||
        advanced.value.address !== request.layout.completionAddress ||
        advanced.value.operation !== "store"
      ) {
        return terminal(routeFailure("semantic-mismatch", "observe", usage, wall()));
      }
      const marker = await session.readMemory(request.layout.completionAddress, 1);
      if (!marker.ok) {
        return terminal(commandFailure(marker.issue, "semantic-mismatch", "observe", usage, wall));
      }
      if (marker.value[0] !== 0xa5) {
        return terminal(routeFailure("semantic-mismatch", "observe", usage, wall()));
      }
      if (!collectActual) {
        for (const address of request.layout.resultAddresses) {
          const actual = await session.readMemory(address, 1);
          if (!actual.ok) {
            return terminal(
              commandFailure(actual.issue, "semantic-mismatch", "observe", usage, wall),
            );
          }
        }
        return terminal(routePass(usage, wall()));
      }
      const actual = await readActualBytes(request, session, usage, wall);
      if ("result" in actual) return actual;
      return Object.freeze({ result: routePass(usage, wall()), actual });
    }
    return terminal(routeFailure("instruction-exhaustion", "run", usage, wall()));
  } finally {
    signal.removeEventListener("abort", abort);
    await session.cancelPending();
  }
}

/** Executes one already-handshaken child without publishing raw actual bytes. */
export async function runViceSessionV1(
  request: ViceRouteRequestV1,
  session: ViceControlSessionV1,
  signal: AbortSignal,
  usage: RouteUsage,
  wall: () => number,
): Promise<ExecutionResultV1> {
  return (await runViceSessionCoreV1(request, session, signal, usage, wall, false)).result;
}

/** Collects actual bytes privately for immediate readiness-owned evaluation. */
export function runEvaluatedViceSessionV1(
  request: ViceRouteRequestV1,
  session: ViceControlSessionV1,
  signal: AbortSignal,
  usage: RouteUsage,
  wall: () => number,
): Promise<ViceSessionRunResultV1> {
  return runViceSessionCoreV1(request, session, signal, usage, wall, true);
}
