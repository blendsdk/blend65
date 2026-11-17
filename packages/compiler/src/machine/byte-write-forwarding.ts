import { valueDefinitions } from "../semantic/aggregate-place-proof.js";
import type { SemanticBlock, SemanticFunction } from "../semantic/operations.js";
import { potentialValueInputs } from "../semantic/value-lifetimes.js";
import type { MachineLoweringInput } from "./machine-types.js";
import { proveSpritePublications } from "./sprite-publication-proof.js";

/**
 * Keep a proved anonymous byte result in A for its sole adjacent fixed write.
 *
 * Complete use counts establish register lifetime, not memory invisibility. The
 * unchanged whole-program certificate must separately exclude every observer of
 * an omitted home across the complete storage windows. Named stores never qualify.
 * Selection precedes storage closure, so the home is not introduced and removed
 * after allocation. Unsupported or stale source associations retain normal lowering.
 * @param input Closed source and exact selected profile.
 * @param source Actual main body, absent for generated initializer bodies.
 * @param blocks Original blocks in their original identity order.
 * @param singleUseValues Existing operation-use inventory; independently rechecked here.
 * @returns IDs whose fresh accumulator value may bypass anonymous retention.
 */
export function selectAnonymousByteWriteValues(
  input: MachineLoweringInput,
  source: SemanticFunction | undefined,
  blocks: readonly SemanticBlock[],
  singleUseValues: ReadonlySet<string>,
): ReadonlySet<string> {
  const candidates = new Set<string>();
  if (
    source === undefined ||
    input.metadataOnly === true ||
    blocks.length !== source.blocks.length ||
    blocks.some((block, index) => block !== source.blocks[index])
  )
    return candidates;

  const definitions = valueDefinitions(blocks);
  const uses = new Map<string, number>();
  const addUse = (value: string): void => {
    uses.set(value, (uses.get(value) ?? 0) + 1);
  };
  for (const block of blocks) {
    for (const operation of block.operations)
      for (const value of potentialValueInputs(operation)) addUse(value);
    if (block.terminator.kind === "branch") addUse(block.terminator.condition);
    if (block.terminator.kind === "return" && block.terminator.value !== null)
      addUse(block.terminator.value);
  }

  // Count every original use, including cold uses, but admit producers only from
  // the reachable body certified below. A cursor avoids queue-prefix copying.
  const byId = new Map(blocks.map((block) => [block.id, block]));
  if (byId.size !== blocks.length) return candidates;
  const reached = new Set<SemanticBlock>();
  const pending = [source.entry];
  for (let cursor = 0; cursor < pending.length; cursor += 1) {
    const block = byId.get(pending[cursor]!);
    if (block === undefined) return candidates;
    if (reached.has(block)) continue;
    reached.add(block);
    if (block.terminator.kind === "jump") pending.push(block.terminator.target);
    else if (block.terminator.kind === "branch")
      pending.push(block.terminator.whenTrue, block.terminator.whenFalse);
  }

  for (const block of reached) {
    for (const [index, operation] of block.operations.entries()) {
      if (
        (operation.kind !== "binary" && operation.kind !== "unary") ||
        operation.type.kind !== "scalar" ||
        operation.type.name !== "byte" ||
        !singleUseValues.has(operation.result) ||
        uses.get(operation.result) !== 1
      )
        continue;
      const right = operation.kind === "binary" ? definitions.get(operation.right) : undefined;
      const addition =
        operation.kind === "binary" &&
        operation.operator === "+" &&
        operation.integer?.width === 8 &&
        !operation.integer.signed &&
        operation.integer.wrap &&
        right?.kind === "constant" &&
        typeof right.value === "bigint" &&
        right.value >= 1n &&
        right.value <= 255n;
      const load = block.operations[index - 1];
      // The original named-word read stays in place. Only its extracted byte's
      // anonymous home disappears; no other operation may intervene or share it.
      const lowByte =
        operation.kind === "unary" &&
        operation.operator === "lo" &&
        load?.kind === "load" &&
        load.result === operation.operand &&
        definitions.get(operation.operand) === load &&
        load.type.kind === "scalar" &&
        load.type.name === "word" &&
        load.place.path.length === 0 &&
        load.place.rootType?.kind === "scalar" &&
        load.place.rootType.name === "word" &&
        singleUseValues.has(load.result) &&
        uses.get(load.result) === 1;
      if (!addition && !lowByte) continue;
      const write = block.operations[index + 1];
      if (
        write?.kind !== "memory-write" ||
        write.value !== operation.result ||
        write.width !== 1 ||
        !write.volatile
      )
        continue;
      const address = definitions.get(write.address);
      if (
        address?.kind === "constant" &&
        typeof address.value === "bigint" &&
        address.value >= 0n &&
        address.value <= 0xffffn
      )
        candidates.add(operation.result);
    }
  }
  // Query once after shape filtering, including when the program publishes no
  // sprites. No initial-read exemption or provisional-home guess is needed.
  if (candidates.size > 0 && proveSpritePublications(input, source) === null) return new Set();
  return candidates;
}
