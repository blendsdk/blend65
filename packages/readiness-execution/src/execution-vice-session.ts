import type { ViceControlSessionV1 } from "@blend65/test-harness/vice-control";
import { projectC64InitialStateV1, type ExecutionResultV1 } from "@blend65/readiness";

import {
  mapControlIssue,
  MAX_WIRE_INSTRUCTIONS,
  routeFailure,
  routePass,
  type RouteUsage,
} from "./execution-vice-policy.js";
import type { ViceRouteRequestV1 } from "./execution-vice-types.js";

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

/**
 * Executes one already-handshaken child under cumulative instruction/cycle budgets.
 *
 * This internal seam accepts only the low-level session contract, which keeps
 * protocol framing and process authority outside runtime expectation policy.
 */
export async function runViceSessionV1(
  request: ViceRouteRequestV1,
  session: ViceControlSessionV1,
  signal: AbortSignal,
  usage: RouteUsage,
  wall: () => number,
): Promise<ExecutionResultV1> {
  const abort = (): void => {
    void session.cancelPending();
  };
  signal.addEventListener("abort", abort, { once: true });
  try {
    if (signal.aborted) {
      await session.cancelPending();
      return routeFailure("wall-time-exhaustion", "fixture", usage, wall());
    }
    const loaded = await session.loadBinary(request.binary.slice(), request.loadAddress);
    if (!loaded.ok) {
      return commandFailure(loaded.issue, "emulator-handshake-failure", "fixture", usage, wall);
    }
    for (const cell of request.fixture.cells) {
      const projected = projectC64InitialStateV1(cell.address, cell.logicalValue);
      if (!projected.ok) return routeFailure("invalid-evidence-input", "fixture", usage, wall());
      const written = await session.writeMemory(cell.address, Uint8Array.of(cell.logicalValue));
      if (!written.ok) {
        return commandFailure(written.issue, "emulator-handshake-failure", "fixture", usage, wall);
      }
      const readback = await session.readMemory(cell.address, 1);
      if (!readback.ok) {
        return commandFailure(readback.issue, "semantic-mismatch", "fixture", usage, wall);
      }
      if (readback.value[0] !== projected.value) {
        return routeFailure("semantic-mismatch", "fixture", usage, wall());
      }
    }
    const pc = await session.setProgramCounter(request.entryAddress);
    if (!pc.ok) {
      return commandFailure(pc.issue, "emulator-handshake-failure", "fixture", usage, wall);
    }
    const checkpoint = await session.setCheckpoint(request.layout.completionAddress, "store");
    if (!checkpoint.ok) {
      return commandFailure(checkpoint.issue, "emulator-handshake-failure", "run", usage, wall);
    }
    const baseline = await session.readStopwatch();
    if (!baseline.ok) {
      return commandFailure(baseline.issue, "emulator-handshake-failure", "run", usage, wall);
    }

    let previousStopwatch = baseline.value;
    let remaining = request.policy.budget.instructions;
    while (remaining > 0) {
      if (
        signal.aborted ||
        wall() > request.policy.budget.routeMs - request.policy.budget.cleanupGraceMs
      ) {
        return routeFailure("wall-time-exhaustion", "run", usage, wall());
      }
      const count = Math.min(MAX_WIRE_INSTRUCTIONS, remaining);
      usage.instructions += count;
      remaining -= count;
      const advanced = await session.advanceInstructions(count);
      if (!advanced.ok) {
        const mapped = mapControlIssue(advanced.issue);
        return routeFailure(mapped.code, "run", usage, wall());
      }
      const stopped = await session.readStopwatch();
      if (!stopped.ok) {
        return commandFailure(stopped.issue, "emulator-handshake-failure", "run", usage, wall);
      }
      if (stopped.value < previousStopwatch) {
        return routeFailure("emulator-handshake-failure", "run", usage, wall());
      }
      const delta = stopped.value - previousStopwatch;
      previousStopwatch = stopped.value;
      if (delta > BigInt(Number.MAX_SAFE_INTEGER)) {
        return routeFailure("cycle-exhaustion", "run", usage, wall());
      }
      usage.cycles += Number(delta);
      const cycleExhausted = usage.cycles > request.policy.budget.cycles;
      if (advanced.value === null) {
        if (remaining === 0) return routeFailure("instruction-exhaustion", "run", usage, wall());
        if (cycleExhausted) return routeFailure("cycle-exhaustion", "run", usage, wall());
        continue;
      }
      if (cycleExhausted) return routeFailure("cycle-exhaustion", "run", usage, wall());
      if (
        advanced.value.checkpointId !== checkpoint.value ||
        advanced.value.address !== request.layout.completionAddress ||
        advanced.value.operation !== "store"
      ) {
        return routeFailure("semantic-mismatch", "observe", usage, wall());
      }
      const marker = await session.readMemory(request.layout.completionAddress, 1);
      if (!marker.ok) {
        return commandFailure(marker.issue, "semantic-mismatch", "observe", usage, wall);
      }
      if (marker.value[0] !== 0xa5) {
        return routeFailure("semantic-mismatch", "observe", usage, wall());
      }
      for (const address of request.layout.resultAddresses) {
        const actual = await session.readMemory(address, 1);
        if (!actual.ok) {
          return commandFailure(actual.issue, "semantic-mismatch", "observe", usage, wall);
        }
      }
      return routePass(usage, wall());
    }
    return routeFailure("instruction-exhaustion", "run", usage, wall());
  } finally {
    signal.removeEventListener("abort", abort);
    await session.cancelPending();
  }
}
