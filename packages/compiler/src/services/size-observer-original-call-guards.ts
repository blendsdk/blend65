import { bindingIdentityKey } from "../frontend/semantic-types.js";
import {
  literalResolver,
  ordinalBoundResolver,
  rawMayObserve,
  valueDefinitions,
} from "../semantic/aggregate-place-proof.js";
import type { FixedLoopFacts } from "../semantic/fixed-loop-facts.js";
import { guardedOrdinalBounds } from "../semantic/guarded-place-proof.js";
import type { SemanticOperation } from "../semantic/operations.js";
import { reachableBlocks } from "../semantic/value-lifetimes.js";
import type { FinalObserverInput } from "./size-observers.js";

/**
 * Compose use-site guards only after the parent checks named borrowing and both
 * actual Original representations, including every direct call and live home.
 * Typed callees cannot name an unexposed caller local; authenticated storage
 * protects it from callee/helper homes. This does not make the callee pure:
 * all raw effects must still exclude both complete artifact unions before the
 * atomic observer may accept. Other writes retain ordinary guard invalidation.
 *
 * @param input Same-source closures already authenticated by the atomic observer.
 * @param loop Original premise whose caller and both representations were checked.
 * @returns Conditional operation-specific maxima, never raw or induction bounds.
 * @example const guards = originalCallGuardBounds(input, loop);
 */
export function originalCallGuardBounds(
  input: FinalObserverInput,
  loop: FixedLoopFacts,
): ReadonlyMap<SemanticOperation, ReadonlyMap<string, bigint>> {
  const blocks = reachableBlocks(loop.function.entry, loop.function.blocks);
  const definitions = valueDefinitions(blocks);
  const literal = literalResolver(definitions);
  const bound = ordinalBoundResolver(definitions, literal);
  const unstableRoots = new Set(
    input.checked.program.semantic.globals.map(({ id }) => bindingIdentityKey(id)),
  );
  for (const block of blocks)
    for (const operation of block.operations)
      if (operation.kind === "place-address")
        unstableRoots.add(bindingIdentityKey(operation.place.root));
  const windows = [...input.checked.profile.storage.ram, ...input.checked.profile.storage.zeroPage];
  return guardedOrdinalBounds(
    loop.function.entry,
    blocks,
    definitions,
    unstableRoots,
    literal,
    bound,
    (operation) =>
      operation.kind === "indirect-call" ||
      operation.kind === "platform" ||
      (operation.kind === "store" && operation.place.path.length > 0) ||
      (operation.kind === "aggregate" &&
        operation.destination?.kind === "place" &&
        operation.destination.place.path.length > 0) ||
      (operation.kind === "memory-write" &&
        rawMayObserve(literal(operation.address), operation.width, windows)),
  );
}
