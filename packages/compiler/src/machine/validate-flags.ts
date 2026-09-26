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

/** Facts about a status value, including bits still equal to this callable's incoming status. */
interface StatusFacts {
  /** Flags with an established producer on every incoming path. */
  readonly flags: number;
  /** Flags whose values still equal this callable's corresponding entry bits. */
  readonly preserved: number;
}

/** Local hardware-stack bytes; null denotes an accumulator save, not a status snapshot. */
interface FlagState extends StatusFacts {
  /** Snapshots or ordinary data bytes pushed within this callable. */
  readonly stack: readonly (StatusFacts | null)[];
}

/** Intersect a status snapshot at a control-flow join without inventing incoming producers. */
function meetStatus(left: StatusFacts, right: StatusFacts): StatusFacts {
  return { flags: left.flags & right.flags, preserved: left.preserved & right.preserved };
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
    const calls = new Map<string, FlagSummary>();
    for (const block of reachable.values()) {
      for (const instruction of block.instructions) {
        if (instruction.opcode !== "jsr") continue;
        if (instruction.operand?.kind !== "label") {
          continue;
        }
        const target = resolve(instruction.operand.label);
        const summary = analyze(target);
        calls.set(target, summary);
        valid &&= summary.valid;
      }
    }
    /** Transfer facts without trusting a call instruction's CPU-only clobber metadata. */
    const transfer = (block: MachineBlock, incoming: FlagState, check: boolean): FlagState => {
      let available = incoming.flags;
      let preserved = incoming.preserved;
      const stack = [...incoming.stack];
      for (const instruction of block.instructions) {
        // PHP snapshots opaque entry state; it does not branch or calculate with those bits.
        if (check && instruction.opcode !== "php") {
          const required = flagMask(instruction.uses.flags);
          valid &&= (available & required) === required;
        }
        if (instruction.opcode === "php") {
          stack.push({ flags: available, preserved });
        } else if (instruction.opcode === "plp") {
          // Restoring an opaque snapshot cannot turn its unknown flags into producers.
          const saved = stack.pop();
          // PHA may push a previously saved status byte. That restore is legal but opaque;
          // only PHP snapshots carry producer facts. A missing stack byte is malformed.
          if (check && saved === undefined) valid = false;
          available = saved?.flags ?? 0;
          preserved = saved?.preserved ?? 0;
        } else if (instruction.opcode === "jsr") {
          const callee =
            instruction.operand?.kind === "label"
              ? calls.get(resolve(instruction.operand.label))
              : undefined;
          available = (available & (callee?.preserves ?? 0)) | (callee?.returns ?? 0);
          preserved &= callee?.preserves ?? 0;
        } else {
          if (instruction.opcode === "pha") stack.push(null);
          else if (instruction.opcode === "pla") stack.pop();
          else if (instruction.opcode === "txs") stack.length = 0;
          const defined = flagMask(instruction.defines.flags);
          available |= defined;
          preserved &= ~defined;
        }
      }
      if (
        check &&
        (block.terminator.kind === "branch" || block.terminator.kind === "long-branch")
      ) {
        const required = flagMask(block.terminator.uses.flags);
        valid &&= (available & required) === required;
      }
      return { flags: available, preserved, stack };
    };
    // An unseen edge contributes no facts. Once reached, joins can only remove facts;
    // snapshots travel with the corresponding stack byte across blocks and balanced calls.
    const incoming = new Map<string, FlagState>([
      [
        entry,
        {
          flags: entry === startup ? 0 : ABI_FLAGS,
          preserved: ALL_FLAGS,
          stack: [],
        },
      ],
    ]);
    const work = [entry];
    while (work.length > 0) {
      const id = work.pop()!;
      const block = reachable.get(id)!;
      const outgoing = transfer(block, incoming.get(id)!, false);
      for (const successor of successors(block.terminator)) {
        const target = resolve(successor);
        const previous = incoming.get(target);
        if (previous === undefined) {
          incoming.set(target, outgoing);
          work.push(target);
          continue;
        }
        // Unequal stack shapes cannot describe one safe status restore. Reject now rather
        // than letting a growing loop allocate an unbounded validation work list.
        if (
          previous.stack.length !== outgoing.stack.length ||
          previous.stack.some(
            (saved, index) => (saved === null) !== (outgoing.stack[index] === null),
          )
        ) {
          active.delete(entry);
          return { returns: 0, preserves: 0, valid: false };
        }
        const merged: FlagState = {
          ...meetStatus(previous, outgoing),
          stack: previous.stack.map((saved, index) =>
            saved === null ? null : meetStatus(saved, outgoing.stack[index]!),
          ),
        };
        if (
          merged.flags !== previous.flags ||
          merged.preserved !== previous.preserved ||
          merged.stack.some(
            (saved, index) =>
              saved?.flags !== previous.stack[index]?.flags ||
              saved?.preserved !== previous.stack[index]?.preserved,
          )
        ) {
          incoming.set(target, merged);
          work.push(target);
        }
      }
    }
    let returns = ALL_FLAGS;
    let preserves = ALL_FLAGS;
    let hasReturn = false;
    for (const [id, block] of reachable) {
      const outgoing = transfer(block, incoming.get(id)!, true);
      if (block.terminator.kind === "return" || block.instructions.at(-1)?.opcode === "rts") {
        valid &&= outgoing.stack.length === 0;
        returns &= outgoing.flags;
        preserves &= outgoing.preserved;
        hasReturn = true;
      }
    }
    active.delete(entry);
    const summary = {
      returns: hasReturn ? returns : 0,
      preserves: hasReturn ? preserves : 0,
      valid,
    };
    cache.set(entry, summary);
    return summary;
  };
  return functions.every((fn) => fn.blocks.length === 0 || analyze(fn.id).valid);
}
