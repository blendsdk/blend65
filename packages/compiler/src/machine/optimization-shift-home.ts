import { machineInstruction } from "./lower-control.js";
import type { CpuFacts } from "../target/nmos6510.js";
import type { MachineFunction, MachineInstruction } from "./machine-types.js";

/** Shift opcodes whose accumulator form is exactly the memory read-modify-write form. */
const SHIFTS = new Set(["asl", "lsr", "rol", "ror"]);

/** One direct storage operand on a non-split byte home. */
function storageHome(
  instruction: MachineInstruction,
): Extract<MachineInstruction["operand"], { readonly kind: "storage" }> | undefined {
  const operand = instruction.operand;
  return instruction.mode === "storage" &&
    operand?.kind === "storage" &&
    operand.addressByte === undefined &&
    (operand.offset ?? 0) === 0
    ? operand
    : undefined;
}

/**
 * Whether A is dead from `start` in `label`: every path must define A before it
 * reads A. A return is conservative because an ordinary callee returns its result
 * in A. The walk is bounded by the blocks already visited.
 */
function aDead(
  fn: MachineFunction,
  label: string,
  start: number,
  origin: string,
  visited: ReadonlySet<string>,
): boolean {
  // A path back into the block being folded would need the post-fold shape to
  // reason about; refuse it rather than over-approximate the removed load.
  if (visited.has(label) || (label === origin && visited.size > 0)) return false;
  const block = fn.blocks.find((candidate) => candidate.label === label);
  if (block === undefined) return false;
  const next = new Set(visited);
  next.add(label);
  for (let index = start; index < block.instructions.length; index += 1) {
    const instruction = block.instructions[index]!;
    // Read-before-write: an instruction such as `adc` both reads and writes A.
    // The original value feeds that read, so the fold is legal only after the
    // last A read. A pure write still proves the old A is dead from here.
    if (instruction.uses.registers.includes("a")) return false;
    if (instruction.defines.registers.includes("a")) return true;
  }
  const terminator = block.terminator;
  if (terminator.kind === "branch" || terminator.kind === "long-branch")
    return (
      aDead(
        fn,
        terminator.kind === "branch" ? terminator.target : terminator.jump.target,
        0,
        origin,
        next,
      ) && aDead(fn, terminator.fallthrough, 0, origin, next)
    );
  if (terminator.kind === "jump" || terminator.kind === "fallthrough")
    return aDead(fn, terminator.target, 0, origin, next);
  return false;
}

/** One exact `lda home; shift A; sta home` triple and its safe replacement. */
function foldBlock(
  cpu: CpuFacts,
  fn: MachineFunction,
  block: MachineFunction["blocks"][number],
): { readonly block: MachineFunction["blocks"][number]; readonly changed: boolean } {
  const instructions = block.instructions;
  const folded: MachineInstruction[] = [];
  let changed = false;
  let index = 0;
  while (index < instructions.length) {
    const load = instructions[index],
      shift = instructions[index + 1],
      store = instructions[index + 2];
    const home = load === undefined ? undefined : storageHome(load);
    if (
      load !== undefined &&
      shift !== undefined &&
      store !== undefined &&
      home !== undefined &&
      load.opcode === "lda" &&
      SHIFTS.has(shift.opcode) &&
      shift.mode === "accumulator" &&
      store.opcode === "sta" &&
      storageHome(store)?.requestId === home.requestId &&
      load.observerOrigins === undefined &&
      shift.observerOrigins === undefined &&
      store.observerOrigins === undefined &&
      aDead(fn, block.label, index + 3, block.label, new Set())
    ) {
      // The three occurrences collapse into one read-modify-write. The memory
      // form has the same result byte, carry and N/Z/C flags; A is proved dead,
      // so leaving A unchanged is observationally identical.
      folded.push(
        machineInstruction(
          cpu,
          shift.opcode,
          "storage",
          Object.freeze({ kind: "storage", requestId: home.requestId, offset: 0 }),
          [],
          shift.source ?? store.source ?? load.source ?? null,
        ),
      );
      index += 3;
      changed = true;
      continue;
    }
    folded.push(load!);
    index += 1;
  }
  return changed
    ? { block: Object.freeze({ ...block, instructions: Object.freeze(folded) }), changed }
    : { block, changed };
}

/**
 * Fold `lda home; asl|lsr|rol|ror; sta home` into one memory read-modify-write.
 *
 * This pass runs for every size lowering, so the canonical reference and the
 * selected candidate receive the same shape and no observer correspondence is
 * widened. `none` lowering never runs it.
 *
 * @param cpu Selected processor facts for instruction forms and flag effects.
 * @param functions Final machine functions for one size lowering.
 * @returns Functions with each proved store-to-self shift folded.
 * @example const folded = foldShiftHome(input.profile.cpu, functions);
 */
export function foldShiftHome(
  cpu: CpuFacts,
  functions: readonly MachineFunction[],
): readonly MachineFunction[] {
  return functions.map((fn) => {
    let changed = false;
    const blocks = fn.blocks.map((block) => {
      const result = foldBlock(cpu, fn, block);
      changed = changed || result.changed;
      return result.block;
    });
    return changed ? Object.freeze({ ...fn, blocks: Object.freeze(blocks) }) : fn;
  });
}
