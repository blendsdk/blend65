import { bindingIdentityKey } from "../frontend/semantic-types.js";
import type { BindingId } from "../frontend/semantic-types.js";
import type { MachineBlock, MachineFunction } from "../machine/machine-types.js";
import type { SourceSpan } from "../project/types.js";
import type { FinalObserverInput } from "./size-observers.js";

/** One source call, as the observers know it from the checked program. */
export interface ContinuedCall {
  /** Called source function. */
  readonly callee: BindingId;
  /** The call's own source span. */
  readonly span: SourceSpan;
}

/**
 * How a placed block leaves into another body, judged against one source call.
 *
 * The entry function may continue into the body it calls last instead of
 * calling it: its block then ends in a jump marked as a continuation, or falls
 * into that body placed right after it. Such an edge stands for exactly one
 * source call. It matches only when it carries that call's own source span,
 * leaves the entry function's body in the ordinary context, names the entry of
 * the called function's only body, and — for a fall-through — ends at the
 * address where that body begins. Every other edge into another body is
 * unmatched, and a block that does not leave into another body has none.
 * @param input Checked program, which names the entry function.
 * @param caller Placed body holding the block.
 * @param block Placed block whose terminator is judged.
 * @param call The one source call the edge may stand for, if any.
 * @param functions Every placed body of the same construction.
 * @returns "none", "matched" or "unmatched".
 * @example
 * continuationCall(input, main, block, lastCall, layout.program.functions) === "matched";
 */
export function continuationCall(
  input: FinalObserverInput,
  caller: MachineFunction,
  block: MachineBlock,
  call: ContinuedCall | undefined,
  functions: readonly MachineFunction[],
): "none" | "matched" | "unmatched" {
  const edge = block.terminator;
  const target =
    edge.kind === "jump" && edge.continuation === true
      ? edge.target
      : edge.kind === "fallthrough" && functions.some(({ id }) => id === edge.target)
        ? edge.target
        : undefined;
  if (target === undefined || target === caller.id) return "none";
  if (edge.kind !== "jump" && edge.kind !== "fallthrough") return "none";
  const callee = functions.find(({ id }) => id === target);
  const source = edge.source;
  const end =
    block.origin === undefined
      ? undefined
      : block.origin + block.instructions.reduce((sum, item) => sum + item.cost.bytes, 0);
  return call !== undefined &&
    source !== undefined &&
    source.sourceId === call.span.sourceId &&
    source.start === call.span.start &&
    source.end === call.span.end &&
    caller.sourceFunction === input.checked.program.semantic.main &&
    caller.executionContext?.domain === "main" &&
    caller.executionContext.activationRoot === undefined &&
    callee?.sourceFunction !== undefined &&
    bindingIdentityKey(callee.sourceFunction) === bindingIdentityKey(call.callee) &&
    callee.executionContext?.domain === "main" &&
    callee.executionContext.activationRoot === undefined &&
    (callee.observerBodies?.length ?? 1) === 1 &&
    (edge.kind === "jump" || (end !== undefined && end === callee.origin))
    ? "matched"
    : "unmatched";
}
