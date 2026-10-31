import type { MachineBlock, MachineInstruction } from "../machine/machine-types.js";
import type { BinaryOperation, SemanticBlock } from "../semantic/operations.js";
import type { ResidualFailure } from "./size-observer-raw-layout.js";

/** Ordinary lowering and binding retain the exact source span object on these instructions. */
function sameShiftOrigin(
  instruction: MachineInstruction | undefined,
  operation: BinaryOperation,
): boolean {
  return instruction?.source === operation.span && instruction.memory.length === 0;
}

/** The decrement alone supplies the BNE flag; no reload or additional instruction may intervene. */
function matchesShiftKernel(block: MachineBlock, operation: BinaryOperation): boolean {
  const [shift, decrement] = block.instructions;
  return (
    block.instructions.length === 2 &&
    sameShiftOrigin(shift, operation) &&
    sameShiftOrigin(decrement, operation) &&
    shift?.opcode === (operation.operator === "<<" ? "asl" : "lsr") &&
    shift.mode === "accumulator" &&
    shift.operand === null &&
    decrement?.opcode === "dex" &&
    decrement.mode === "implied" &&
    decrement.operand === null &&
    block.terminator.kind === "branch" &&
    block.terminator.opcode === "bne"
  );
}

/** Match one guarded entry and continuation, accounting for every actual incoming edge once. */
function hasExactShiftEntry(
  operation: BinaryOperation,
  block: MachineBlock,
  selected: readonly string[],
  actual: ReadonlyMap<string, MachineBlock>,
  canonicalTarget: (label: string) => string | ResidualFailure,
): boolean {
  const canonical = (candidate: MachineBlock) =>
    candidate.terminator.kind === "fallthrough" && actual.has(candidate.terminator.target)
      ? canonicalTarget(candidate.label)
      : candidate.label;
  const predecessors = new Map<string, Set<MachineBlock>>();
  const owners = new Map<string, Set<string>>();
  for (const candidate of actual.values()) {
    const from = canonical(candidate);
    if (typeof from !== "string") return false;
    const labels = owners.get(from) ?? new Set<string>();
    labels.add(candidate.label);
    owners.set(from, labels);
    const edge = candidate.terminator;
    const targets =
      edge.kind === "branch"
        ? [edge.target, edge.fallthrough]
        : edge.kind === "long-branch"
          ? [edge.jump.target, edge.fallthrough]
          : edge.kind === "jump" || edge.kind === "fallthrough"
            ? [edge.target]
            : [];
    for (const target of targets) {
      const destination = actual.get(target);
      if (destination === undefined) continue;
      const to = canonical(destination);
      if (typeof to !== "string") return false;
      // Empty aliases add no execution step or predecessor of their own.
      if (from === to && from !== candidate.label) continue;
      const owner = actual.get(from);
      if (owner === undefined) return false;
      const incoming = predecessors.get(to) ?? new Set<MachineBlock>();
      incoming.add(owner);
      predecessors.set(to, incoming);
    }
  }
  const incoming = predecessors.get(block.label);
  if (incoming?.size !== 2 || !incoming.has(block) || block.terminator.kind !== "branch")
    return false;
  const zero = [...incoming].find((candidate) => candidate !== block)!;
  const zeroEdge = zero.terminator;
  const continuation = actual.get(block.terminator.fallthrough);
  const back = actual.get(block.terminator.target);
  if (continuation === undefined || back === undefined || canonical(back) !== block.label)
    return false;
  const doneLabel = canonical(continuation);
  if (typeof doneLabel !== "string") return false;
  const done = actual.get(doneLabel);
  if (done === undefined || zeroEdge.kind !== "branch" || zeroEdge.opcode !== "beq") return false;
  const rejected = actual.get(zeroEdge.target);
  const accepted = actual.get(zeroEdge.fallthrough);
  if (
    rejected === undefined ||
    accepted === undefined ||
    canonical(rejected) !== doneLabel ||
    canonical(accepted) !== block.label
  )
    return false;
  const members = new Set(selected);
  for (const label of [zero.label, block.label])
    if ([...(owners.get(label) ?? [])].some((owner) => !members.has(owner))) return false;
  const zeroRank = selected.indexOf(zero.label),
    loopRank = selected.indexOf(block.label);
  if (zeroRank < 0 || zeroRank >= loopRank || selected.indexOf(doneLabel) <= loopRank) return false;
  if (
    ![zero, block, done].every(
      ({ origin }) =>
        origin !== undefined && Number.isSafeInteger(origin) && origin >= 0 && origin <= 0xffff,
    ) ||
    zero.origin! >= block.origin! ||
    block.origin! >= done.origin!
  )
    return false;
  const entries = predecessors.get(zero.label);
  if (entries?.size !== 1) return false;
  const entry = [...entries][0]!;
  if (!members.has(entry.label) || selected.indexOf(entry.label) >= zeroRank) return false;
  if (zero.instructions.length === 1) {
    const compare = zero.instructions[0]!;
    return (
      sameShiftOrigin(compare, operation) &&
      compare.opcode === "cpx" &&
      compare.mode === "immediate" &&
      compare.operand?.kind === "immediate" &&
      compare.operand.value === 0
    );
  }
  if (zero.instructions.length !== 0) return false;
  // With no CPX, the final private count load must still own the zero flag.
  const load = entry.instructions.at(-1);
  return (
    sameShiftOrigin(load, operation) &&
    load?.opcode === "ldx" &&
    (load.mode === "absolute" || load.mode === "zero-page") &&
    load.operand?.kind === "absolute" &&
    Number.isSafeInteger(load.operand.value) &&
    load.operand.value >= 0 &&
    load.operand.value <= (load.mode === "zero-page" ? 0xff : 0xffff)
  );
}

/**
 * Prove only the finite internal loop of one unsigned byte accumulator shift.
 * The parent authenticates the source association, actual caller and word home.
 * DEX followed immediately by BNE terminates for every initial byte X; the exact
 * zero gate prevents a zero count from executing 256 unwanted shifts. Count-width
 * and saturation semantics stay with ordinary lowering and are not inferred here.
 * All source exits, counter writes, calls and physical accesses remain parent gates.
 *
 * @param source Exact checked source block owning the selected instruction group.
 * @param block Actual block whose backward edge needs this bounded exception.
 * @param selected Original associated labels, including retained empty aliases.
 * @param actual Complete actual caller blocks used to exclude foreign entries.
 * @param canonicalTarget Existing checked same-PC, empty-fallthrough alias resolver.
 * @returns Whether this exact kernel has one valid zero entry and forward continuation.
 * @example const finite = isOriginalByteShiftCycle(source, block, selected, actual, canonicalTarget);
 */
export function isOriginalByteShiftCycle(
  source: SemanticBlock,
  block: MachineBlock,
  selected: readonly string[],
  actual: ReadonlyMap<string, MachineBlock>,
  canonicalTarget: (label: string) => string | ResidualFailure,
): boolean {
  if (actual.get(block.label) !== block || !selected.includes(block.label)) return false;
  const operations = source.operations.filter(
    (operation): operation is BinaryOperation =>
      operation.kind === "binary" &&
      (operation.operator === "<<" || operation.operator === ">>") &&
      operation.type.kind === "scalar" &&
      operation.type.name === "byte" &&
      operation.integer?.width === 8 &&
      !operation.integer.signed &&
      block.instructions.every((instruction) => instruction.source === operation.span),
  );
  return (
    operations.length === 1 &&
    matchesShiftKernel(block, operations[0]!) &&
    hasExactShiftEntry(operations[0]!, block, selected, actual, canonicalTarget)
  );
}
