import type { ExecutionOperationResultV1, ExecutionResultV1 } from "@blend65/readiness";

import { defaultViceExecutionHostV1 } from "./execution-vice-host.js";
import { ViceExecutionCoordinator } from "./execution-vice-runtime.js";
import type {
  ManualLeaseRecoveryV1,
  ViceExecutionHostV1,
  ViceExecutionRuntimeV1,
  ViceLeaseHandleV1,
  ViceRouteRequestV1,
} from "./execution-vice-types.js";

/**
 * Creates an isolated VICE lease coordinator over a raw fixed-namespace host.
 *
 * @param host Optional production embedding boundary.
 * @returns A runtime with its own private handle registry and mutation gate.
 *
 * @example
 * ```ts
 * const runtime = createViceExecutionRuntimeV1();
 * const lease = await runtime.acquireViceLease("c64", AbortSignal.timeout(5_000));
 * ```
 */
export function createViceExecutionRuntimeV1(host?: ViceExecutionHostV1): ViceExecutionRuntimeV1 {
  return Object.freeze(new ViceExecutionCoordinator(host ?? defaultViceExecutionHostV1));
}

const DEFAULT_VICE_EXECUTION_RUNTIME = createViceExecutionRuntimeV1();

/** Acquires a VICE lease through the process-wide singleton coordinator. */
export function acquireViceLeaseV1(
  target: "c64",
  signal: AbortSignal,
): Promise<ExecutionOperationResultV1<ViceLeaseHandleV1>> {
  return DEFAULT_VICE_EXECUTION_RUNTIME.acquireViceLease(target, signal);
}

/** Inspects VICE lease recovery evidence through the singleton coordinator. */
export function inspectViceLeaseV1(
  target: "c64",
  signal: AbortSignal,
): Promise<ExecutionOperationResultV1<ManualLeaseRecoveryV1>> {
  return DEFAULT_VICE_EXECUTION_RUNTIME.inspectViceLease(target, signal);
}

/** Clears one exact positively absent lease generation through the singleton coordinator. */
export function clearViceLeaseGenerationV1(
  target: "c64",
  generation: number,
  nonce: string,
  signal: AbortSignal,
): Promise<ExecutionOperationResultV1<true>> {
  return DEFAULT_VICE_EXECUTION_RUNTIME.clearViceLeaseGeneration(target, generation, nonce, signal);
}

/** Consumes a singleton-issued handle to execute one VICE route. */
export function executeViceRouteV1(
  request: ViceRouteRequestV1,
  lease: ViceLeaseHandleV1,
  signal: AbortSignal,
): Promise<ExecutionResultV1> {
  return DEFAULT_VICE_EXECUTION_RUNTIME.executeViceRoute(request, lease, signal);
}
