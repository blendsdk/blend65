import { bindingIdentityKey } from "../frontend/semantic-types.js";
import type { BindingId } from "../frontend/semantic-types.js";
import type { FunctionLoweringState } from "./lower-state.js";

/**
 * Whether a callee's existing whole-program summary proves it never returns.
 *
 * A function whose body cannot reach its own end never resumes its caller, so the call owns no
 * executable edge back and everything written after it is unreachable. Every call route asks this
 * the same way, because the route a program happens to use must not decide whether it is accepted.
 *
 * An absent summary answers `false`, so an unknown callee is treated as one that may return. That
 * keeps the ordinary executable edge after the call, which is the safe direction: claiming a call
 * cannot return when it can would discard code that really runs.
 *
 * @param callee Called function's binding, direct or devirtualized from a pointer.
 * @param state Lowering state carrying the whole-program summaries.
 * @returns True only when a summary exists and proves the body cannot return.
 * @example if (calleeNeverReturns(operation.callee, state)) closeBlockUnreachable();
 */
export function calleeNeverReturns(callee: BindingId, state: FunctionLoweringState): boolean {
  return (
    state.input.program.interruptOwnership?.returningBodies?.get(bindingIdentityKey(callee)) ===
    false
  );
}
