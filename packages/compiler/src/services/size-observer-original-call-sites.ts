import { bindingIdentityKey } from "../frontend/semantic-types.js";
import type { MachineFunction } from "../machine/machine-types.js";
import type { FixedLoopFacts } from "../semantic/fixed-loop-facts.js";
import { failure } from "./size-observer-raw-layout.js";
import type { ResidualFailure } from "./size-observer-raw-layout.js";
import type { FinalObserverInput } from "./size-observers.js";

/**
 * Match every static JSR occurrence to an ordered source call in this actual caller.
 * The parent has authenticated the pending source group and checked the caller,
 * word home and source-block membership against this exact shared construction.
 * Calls must precede any split in their source block; later calls keep fallback.
 *
 * This checks correspondence only. Closed SFA still owns arguments, live caller
 * values, descendant/helper interference and stack demand. The complete observer
 * must subsequently close every raw, typed, state and platform obligation.
 * No instruction is granted physical-footprint coverage by a successful match.
 *
 * @param input Original checked program and its actual reference/candidate closures.
 * @param loop Authenticated Original induction premise owning this source body.
 * @param shared Exact construction containing the already resolved actual caller.
 * @param fn Actual caller already checked by the parent against the loop and home.
 * @returns A local correspondence failure, or null; never whole-program acceptance.
 * @example const invalid = validateOriginalCallSites(input, loop, shared, fn);
 */
export function validateOriginalCallSites(
  input: FinalObserverInput,
  loop: FixedLoopFacts,
  shared: FinalObserverInput["candidate"]["shared"],
  fn: MachineFunction,
): ResidualFailure | null {
  if (fn.sourceFunction !== loop.function.id || !shared.layout.program.functions.includes(fn))
    return failure(
      "error",
      "Original call matcher has another caller construction",
      loop.comparison.span,
    );
  const hasSourceCalls = loop.function.blocks.some((block) =>
    block.operations.some((op) => op.kind === "call"),
  );
  if (
    !hasSourceCalls &&
    !fn.blocks.some((block) => block.instructions.some((op) => op.opcode === "jsr"))
  )
    return null;
  const associations = fn.observerBlocks;
  if (
    associations === undefined ||
    fn.executionContext?.domain !== "main" ||
    fn.executionContext.activationRoot !== undefined ||
    (fn.observerBodies?.length ?? 1) !== 1
  )
    return failure(
      "rejected",
      "Original calls require one known main caller",
      loop.comparison.span,
    );
  const firstSources = new Map(associations.map(([source, labels]) => [labels[0], source]));
  if (
    firstSources.size !== associations.length ||
    associations.some(([, labels]) => labels.length === 0)
  )
    return failure("error", "Original call source entries are ambiguous", loop.comparison.span);
  const entries = new Map(shared.layout.program.functions.map((entry) => [entry.id, entry]));
  if (entries.size !== shared.layout.program.functions.length)
    return failure("error", "Original call entries are ambiguous", loop.comparison.span);
  const callees = new Set(
    input.checked.program.callGraph
      .find((edge) => bindingIdentityKey(edge.function) === bindingIdentityKey(loop.function.id))
      ?.callees.map(bindingIdentityKey),
  );
  const remainingSources = new Set(loop.function.blocks);
  const seenLabels = new Set<string>();
  // Scan all actual blocks, not only associations. An unassociated JSR is not harmless.
  for (const block of fn.blocks) {
    if (seenLabels.has(block.label))
      return failure("error", "Original call block is duplicated", loop.comparison.span);
    seenLabels.add(block.label);
    const source = firstSources.get(block.label);
    if (source !== undefined) {
      // Delete once: foreign ownership and repeated source attribution both fail.
      if (!remainingSources.delete(source))
        return failure(
          "error",
          "Original call block has another source owner",
          loop.comparison.span,
        );
    }
    const calls = source?.operations.filter((operation) => operation.kind === "call") ?? [];
    let callOrdinal = 0;
    for (const instruction of block.instructions) {
      if (instruction.opcode !== "jsr") continue;
      // The cursor counts occurrences even when two positions reuse one object.
      const call = calls[callOrdinal++];
      const operand = instruction.operand;
      const callee = operand?.kind === "label" ? entries.get(operand.label) : undefined;
      if (
        call === undefined ||
        !callees.has(bindingIdentityKey(call.callee)) ||
        instruction.mode !== "absolute" ||
        operand?.kind !== "label" ||
        (operand.offset ?? 0) !== 0 ||
        operand.addressByte !== undefined ||
        operand.transform !== undefined ||
        callee?.sourceFunction === undefined ||
        bindingIdentityKey(callee.sourceFunction) !== bindingIdentityKey(call.callee) ||
        callee.executionContext?.domain !== "main" ||
        callee.executionContext?.activationRoot !== undefined ||
        (callee.observerBodies?.length ?? 1) !== 1 ||
        instruction.source?.sourceId !== call.span.sourceId ||
        instruction.source.start !== call.span.start ||
        instruction.source.end !== call.span.end
      )
        return failure(
          "rejected",
          "Original call does not match its exact main entry",
          instruction.source,
        );
    }
    if (callOrdinal !== calls.length)
      return failure(
        "rejected",
        "Original source calls are not completely emitted",
        loop.comparison.span,
      );
  }
  if ([...remainingSources].some((source) => source.operations.some((op) => op.kind === "call")))
    return failure("rejected", "Original source call entry is missing", loop.comparison.span);
  return null;
}
