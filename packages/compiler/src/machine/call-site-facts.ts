import type { MachineBlock, MachineFunction, MachineInstruction } from "./machine-types.js";

/**
 * One plain direct call into a body: the caller, the block holding the call, and
 * the call's own position in it.
 */
export interface DirectCallSite {
  /** Body that performs the call, which may itself be a handler. */
  readonly caller: MachineFunction;
  /** Block holding the call instruction. */
  readonly block: MachineBlock;
  /** Position of the call within that block's instructions. */
  readonly index: number;
}

/** Whether one instruction is a plain direct call naming exactly one entry label. */
function plainEntryCall(instruction: MachineInstruction, entry: string): boolean {
  const operand = instruction.operand;
  return (
    instruction.opcode === "jsr" &&
    instruction.mode === "absolute" &&
    operand?.kind === "label" &&
    operand.label === entry &&
    operand.addressByte === undefined &&
    operand.transform === undefined &&
    operand.addressTransform === undefined &&
    (operand.offset ?? 0) === 0
  );
}

/**
 * Whether one instruction names an entry label in any way other than calling it.
 *
 * Taking a body's address is the interesting case: a stored pointer can be called
 * from anywhere, so a label that appears as an address byte is no longer covered
 * by an enumeration of its direct calls. A memory effect carrying the label is
 * treated the same way.
 */
function mentionsEntryOtherwise(instruction: MachineInstruction, entry: string): boolean {
  const operand = instruction.operand;
  const named = operand?.kind === "label" && operand.label === entry;
  if (named && !plainEntryCall(instruction, entry)) return true;
  return instruction.memory.some(
    (effect) => effect.address.kind === "symbolic" && effect.address.label === entry,
  );
}

/**
 * Whether one block reaches an entry label other than by calling it directly.
 *
 * A dispatch block records every body its run-time transfer may reach, and such a
 * body returns to whoever called the dispatch block rather than to the transfer
 * itself. A jump naming a body is the same situation reached by a tail transfer.
 */
function blockMentionsEntryOtherwise(block: MachineBlock, entry: string): boolean {
  if (block.indirectTargets?.includes(entry) === true) return true;
  const edge = block.terminator;
  const targets =
    edge.kind === "jump" || edge.kind === "fallthrough"
      ? [edge.target]
      : edge.kind === "branch"
        ? [edge.target, edge.fallthrough]
        : edge.kind === "long-branch"
          ? [edge.jump.target, edge.fallthrough]
          : [];
  return targets.includes(entry);
}

/**
 * Enumerate every direct call into one body, or refuse the enumeration outright.
 *
 * A fact about "every caller" is only usable when the callers can actually be
 * counted. That holds when the body's entry label is reached by direct calls and
 * nothing else: an address taken, a dispatch candidate, or a jump into the body
 * all leave callers this scan cannot see, and a body with no call at all means the
 * label does not identify what the scan assumed, which must not read as a
 * vacuously satisfied "every caller".
 * @param bodies Every body in the program, including platform startup.
 * @param entry The called body's own entry label.
 * @returns Every direct call site, or `null` when they cannot be enumerated.
 * @example
 * const sites = directCallSites([startup, main, apply], apply.id);
 * // sites === null when `apply`'s address is taken anywhere.
 */
export function directCallSites(
  bodies: readonly MachineFunction[],
  entry: string,
): readonly DirectCallSite[] | null {
  const sites: DirectCallSite[] = [];
  for (const caller of bodies)
    for (const block of caller.blocks) {
      if (blockMentionsEntryOtherwise(block, entry)) return null;
      for (let index = 0; index < block.instructions.length; index += 1) {
        const instruction = block.instructions[index]!;
        if (mentionsEntryOtherwise(instruction, entry)) return null;
        if (plainEntryCall(instruction, entry)) sites.push(Object.freeze({ caller, block, index }));
      }
    }
  return sites.length === 0 ? null : Object.freeze(sites);
}

/**
 * Whether a called body's first instruction rewrites N and Z before reading either.
 *
 * Stepping a flag-death walk over a call needs more than the call's own encoding,
 * which touches no flag: the body behind it runs arbitrary code, and a body that
 * opens by pushing the status register observes exactly the flags being proved
 * dead. One instruction that writes both and reads neither settles it, because
 * whatever follows can no longer see the pair. Anything less refuses, including a
 * call whose target cannot be resolved to a body at all.
 * @param bodies Every body in the program, indexed by the entry label a call names.
 * @param call The call instruction the walk is about to step over.
 * @returns Whether N and Z are certainly dead once the call has run.
 * @example
 * // `apply` opens with `lda seed`, which writes N and Z and reads neither.
 * calleeRewritesFlags(bodies, jsrApply); // true
 */
export function calleeRewritesFlags(
  bodies: ReadonlyMap<string, MachineFunction>,
  call: MachineInstruction,
): boolean {
  const operand = call.operand;
  if (
    operand?.kind !== "label" ||
    operand.addressByte !== undefined ||
    operand.transform !== undefined ||
    operand.addressTransform !== undefined ||
    (operand.offset ?? 0) !== 0
  )
    return false;
  const opening = bodies.get(operand.label)?.blocks[0]?.instructions[0];
  if (opening === undefined) return false;
  return (
    opening.defines.flags.includes("n") &&
    opening.defines.flags.includes("z") &&
    !opening.uses.flags.includes("n") &&
    !opening.uses.flags.includes("z")
  );
}
