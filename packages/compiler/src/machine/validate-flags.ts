import type {
  MachineBlock,
  MachineFlag,
  MachineProgram,
  MachineTerminator,
} from "./machine-types.js";

/** Compact facts for the six processor flags tracked by machine instructions. */
const FLAG_BITS: Readonly<Record<MachineFlag, number>> = { n: 1, v: 2, d: 4, i: 8, z: 16, c: 32 };
const ALL_FLAGS = 63;
// Ordinary calls preserve the language ABI's decimal/interrupt state, not arithmetic flags.
const ABI_FLAGS = FLAG_BITS.d | FLAG_BITS.i;

/** Convert exact instruction metadata to a small set of established flags. */
function flagMask(flags: readonly MachineFlag[]): number {
  return flags.reduce((mask, flag) => mask | FLAG_BITS[flag], 0);
}

/** Follow structured transfers, including a tail jump into another function. */
function successors(terminator: MachineTerminator): readonly string[] {
  if (terminator.kind === "branch") return [terminator.target, terminator.fallthrough];
  if (terminator.kind === "long-branch") return [terminator.jump.target, terminator.fallthrough];
  if (terminator.kind === "jump" || terminator.kind === "fallthrough") return [terminator.target];
  return [];
}

/** Result of checking a callable entry and every path reachable without another call. */
interface FlagSummary {
  /** Flags established on every returning path, independent of incoming arithmetic flags. */
  readonly returns: number;
  /** Flags no path through the callee can overwrite or pass to an unknown external call. */
  readonly preserves: number;
  /** Every consuming instruction and branch has a producer on all incoming paths. */
  readonly valid: boolean;
}

/**
 * Check flag producers across branches, joins, loops and the closed direct-call graph.
 *
 * A join retains only facts true on every incoming path. Calls use the callee's proved return
 * facts; they cannot accidentally inherit an earlier comparison across a clobbering routine.
 * This is validation only: it changes no instruction, storage home or cycle cost.
 */
export function validateMachineFlags(program: MachineProgram): boolean {
  const functions = [program.startup, ...program.functions];
  const blocks = new Map<string, MachineBlock>();
  const aliases = new Map<string, string>();
  for (const fn of functions) {
    const first = fn.blocks[0];
    // Storage binding can validate a partial program with no startup instructions.
    // Final layout, not flag validation, requires a concrete startup entry.
    if (first === undefined) continue;
    aliases.set(fn.id, first.label);
    for (const block of fn.blocks) {
      if (blocks.has(block.label)) return false;
      blocks.set(block.label, block);
    }
  }
  const resolve = (label: string) => aliases.get(label) ?? label;
  const cache = new Map<string, FlagSummary>();
  const active = new Set<string>();
  const startup = resolve(program.startup.id);

  /** A source call graph is acyclic; malformed machine recursion cannot supply its own proof. */
  const analyze = (label: string): FlagSummary => {
    const entry = resolve(label);
    const cached = cache.get(entry);
    if (cached !== undefined) return cached;
    if (active.has(entry) || !blocks.has(entry)) return { returns: 0, preserves: 0, valid: false };
    active.add(entry);
    const reachable = new Map<string, MachineBlock>();
    const pending = [entry];
    while (pending.length > 0) {
      const current = pending.pop()!;
      if (reachable.has(current)) continue;
      const block = blocks.get(current);
      if (block === undefined) {
        active.delete(entry);
        return { returns: 0, preserves: 0, valid: false };
      }
      reachable.set(current, block);
      pending.push(...successors(block.terminator).map(resolve));
    }
    let valid = true;
    let preserves = ALL_FLAGS;
    const calls = new Map<string, FlagSummary>();
    for (const block of reachable.values()) {
      for (const instruction of block.instructions) {
        if (instruction.opcode !== "jsr") {
          preserves &= ~flagMask(instruction.defines.flags);
          continue;
        }
        if (instruction.operand?.kind !== "label") {
          preserves = 0;
          continue;
        }
        const target = resolve(instruction.operand.label);
        const summary = analyze(target);
        calls.set(target, summary);
        preserves &= summary.preserves;
        valid &&= summary.valid;
      }
    }
    /** Transfer facts without trusting a call instruction's CPU-only clobber metadata. */
    const transfer = (block: MachineBlock, incoming: number, check: boolean): number => {
      let available = incoming;
      for (const instruction of block.instructions) {
        // PHP snapshots opaque entry state; it does not branch or calculate with those bits.
        if (check && instruction.opcode !== "php") {
          const required = flagMask(instruction.uses.flags);
          valid &&= (available & required) === required;
        }
        if (instruction.opcode === "jsr") {
          const callee =
            instruction.operand?.kind === "label"
              ? calls.get(resolve(instruction.operand.label))
              : undefined;
          available = (available & (callee?.preserves ?? 0)) | (callee?.returns ?? 0);
        } else {
          available |= flagMask(instruction.defines.flags);
        }
      }
      if (
        check &&
        (block.terminator.kind === "branch" || block.terminator.kind === "long-branch")
      ) {
        const required = flagMask(block.terminator.uses.flags);
        valid &&= (available & required) === required;
      }
      return available;
    };
    // Start at the greatest set, then remove facts until every loop and join agrees.
    // The real entry seed prevents a loop back-edge from inventing its first producer.
    const incoming = new Map([...reachable.keys()].map((id) => [id, ALL_FLAGS]));
    incoming.set(entry, entry === startup ? 0 : ABI_FLAGS);
    let changed = true;
    while (changed) {
      changed = false;
      for (const [id, block] of reachable) {
        const outgoing = transfer(block, incoming.get(id)!, false);
        for (const successor of successors(block.terminator)) {
          const target = resolve(successor);
          const previous = incoming.get(target)!;
          const merged = previous & outgoing;
          if (merged !== previous) {
            incoming.set(target, merged);
            changed = true;
          }
        }
      }
    }
    let returns = ALL_FLAGS;
    let hasReturn = false;
    for (const [id, block] of reachable) {
      const outgoing = transfer(block, incoming.get(id)!, true);
      if (block.terminator.kind === "return" || block.instructions.at(-1)?.opcode === "rts") {
        returns &= outgoing;
        hasReturn = true;
      }
    }
    active.delete(entry);
    const summary = { returns: hasReturn ? returns : 0, preserves, valid };
    cache.set(entry, summary);
    return summary;
  };
  return functions.every((fn) => fn.blocks.length === 0 || analyze(fn.id).valid);
}
