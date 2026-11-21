import {
  machineProgramDefect,
  UNKNOWN_MACHINE_SITE,
  type MachineDefectSite,
  type MachineProgramDefect,
} from "./machine-defect.js";
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
/** Author-facing flag names; a refusal must not ask whoever reads it to decode 'c' or 'z'. */
const FLAG_NAMES: Readonly<Record<MachineFlag, string>> = {
  n: "negative",
  v: "overflow",
  d: "decimal",
  i: "interrupt",
  z: "zero",
  c: "carry",
};

/** Convert exact instruction metadata to a small set of established flags. */
function flagMask(flags: readonly MachineFlag[]): number {
  return flags.reduce((mask, flag) => mask | FLAG_BITS[flag], 0);
}

/** Flags a consumer needs that no incoming path establishes. */
function unprovedFlags(
  required: readonly MachineFlag[],
  available: number,
): readonly MachineFlag[] {
  return required.filter((flag) => (available & FLAG_BITS[flag]) === 0);
}

/** Spell a set of flags as running prose, so the refusal reads as one sentence. */
function flagPhrase(flags: readonly MachineFlag[]): string {
  const names = flags.map((flag) => FLAG_NAMES[flag]);
  const last = names.at(-1);
  if (last === undefined) return "processor flags";
  if (names.length === 1) return `${last} flag`;
  return `${names.slice(0, -1).join(", ")} and ${last} flags`;
}

/**
 * Transfer candidates of a dispatch block, when they may answer for the block itself.
 *
 * The candidates record where control goes, not what happens on the way, so they speak for the
 * block only while the block is nothing but the transfer and owns no exit of its own. That is how
 * a dispatch block is built. Should one ever carry additional work or a structured exit, its own
 * effects would matter and the recorded set alone would no longer describe the call, so the
 * conservative answer is kept instead.
 */
function dispatchCandidates(block: MachineBlock | undefined): readonly string[] | null {
  if (block === undefined) return null;
  const candidates = block.indirectTargets;
  if (candidates === undefined || candidates.length === 0) return null;
  if (block.terminator.kind !== "unreachable") return null;
  const only = block.instructions.length === 1 ? block.instructions[0] : undefined;
  return only?.opcode === "jmp" && only.mode === "indirect" ? candidates : null;
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
  /**
   * Whether any path through this callable comes back to its caller.
   *
   * Zeroed facts are ambiguous on their own: a callable that returns while guaranteeing nothing
   * and one that never returns at all both carry no flags. Only the second is absent from the
   * caller's incoming paths, so the difference has to be carried separately.
   */
  readonly returning: boolean;
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
 *
 * The verdict is carried by the returned defect rather than a boolean, because a refusal here
 * is a compiler limitation and the author needs to know which construct provoked it. The
 * accumulated verdict still decides: a defect is reported only when that verdict is negative,
 * so a recorded check can never turn an accepted program into a refused one.
 *
 * @param program Program whose instructions, terminators and call graph are complete.
 * @returns The first failing check with its source construct, or null when the program proves out.
 * @example findMachineFlagsDefect(boundProgram)?.reason
 */
export function findMachineFlagsDefect(program: MachineProgram): MachineProgramDefect | null {
  const functions = [program.startup, ...program.functions];
  const blocks = new Map<string, MachineBlock>();
  const aliases = new Map<string, string>();
  const owners = new Map<string, string>();
  let defect: MachineProgramDefect | null = null;
  /** Supply the block body for a site that named only a label, so its span can be resolved. */
  const located = (site: MachineDefectSite): MachineProgramDefect => {
    const block = site.block ?? blocks.get(site.label);
    return machineProgramDefect(block === undefined ? site : { ...site, block });
  };
  /**
   * Keep the first failing check only.
   *
   * Validation deliberately continues past a failure, so later checks describe fallout from the
   * same cause; the earliest one sits closest to the construct that provoked it.
   */
  const record = (site: MachineDefectSite): void => {
    defect ??= located(site);
  };
  for (const fn of functions) {
    const first = fn.blocks[0];
    // Storage binding can validate a partial program with no startup instructions.
    // Final layout, not flag validation, requires a concrete startup entry.
    if (first === undefined) continue;
    aliases.set(fn.id, first.label);
    for (const block of fn.blocks) {
      if (blocks.has(block.label)) {
        return machineProgramDefect({
          stage: "machine flag proof",
          reason: "the compiler generated two code blocks that share one label",
          functionId: fn.id,
          label: block.label,
          block,
        });
      }
      blocks.set(block.label, block);
      owners.set(block.label, fn.id);
    }
  }
  const resolve = (label: string) => aliases.get(label) ?? label;
  // The first failing check found is the one reported. Callees are proved before their callers,
  // so an author sees the construct that caused the failure rather than a consequence of it.
  // Within one function the order follows the traversal, not the order the statements were
  // written, so a program with two failing constructs may name either.
  /** Attribute a block to the function that declared it, including a tail-jump destination. */
  const owner = (label: string) => owners.get(label) ?? UNKNOWN_MACHINE_SITE;
  const cache = new Map<string, FlagSummary>();
  const active = new Set<string>();
  const startup = resolve(program.startup.id);

  /** A source call graph is acyclic; malformed machine recursion cannot supply its own proof. */
  const analyze = (label: string): FlagSummary => {
    const entry = resolve(label);
    const cached = cache.get(entry);
    if (cached !== undefined) return cached;
    if (active.has(entry) || !blocks.has(entry)) {
      record({
        stage: "machine flag proof",
        reason: active.has(entry)
          ? "a generated call leads back into a function whose own proof is still open"
          : "a generated call names a function with no body",
        functionId: owner(entry),
        label: entry,
      });
      return { returns: 0, preserves: 0, valid: false, returning: true };
    }
    active.add(entry);
    const reachable = new Map<string, MachineBlock>();
    const pending = [entry];
    while (pending.length > 0) {
      const current = pending.pop()!;
      if (reachable.has(current)) continue;
      const block = blocks.get(current);
      if (block === undefined) {
        record({
          stage: "machine flag proof",
          reason: "a generated transfer leads to a code block with no body",
          functionId: owner(entry),
          label: current,
        });
        active.delete(entry);
        return { returns: 0, preserves: 0, valid: false, returning: true };
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
      // Depth captured by the most recent transfer out of the stack pointer, which a generated
      // frame unwind measures its release from. Null until one is seen in this block; a base taken
      // in an earlier block is deliberately not carried, since an unwind is always emitted with
      // its own capture.
      let cached: number | null = null;
      for (const instruction of block.instructions) {
        // PHP snapshots opaque entry state; it does not branch or calculate with those bits.
        if (check && instruction.opcode !== "php") {
          const required = flagMask(instruction.uses.flags);
          const proved = (available & required) === required;
          if (!proved) {
            record({
              stage: "machine flag proof",
              reason: `the selected '${instruction.opcode}' has no proved producer for its ${flagPhrase(
                unprovedFlags(instruction.uses.flags, available),
              )}`,
              functionId: owner(block.label),
              label: block.label,
              block,
              instruction,
            });
          }
          valid &&= proved;
        }
        if (instruction.opcode === "php") {
          stack.push({ flags: available, preserved });
        } else if (instruction.opcode === "plp") {
          // Restoring an opaque snapshot cannot turn its unknown flags into producers.
          const saved = stack.pop();
          // PHA may push a previously saved status byte. That restore is legal but opaque;
          // only PHP snapshots carry producer facts. A missing stack byte is malformed.
          if (check && saved === undefined) {
            record({
              stage: "machine flag proof",
              reason: "the selected 'plp' restores a processor-status byte that was never saved",
              functionId: owner(block.label),
              label: block.label,
              block,
              instruction,
            });
            valid = false;
          }
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
          else if (instruction.opcode === "tsx") cached = stack.length;
          else if (instruction.opcode === "txs") {
            // Setting the pointer from a register normally makes the whole stack unknowable, and
            // the only honest response is to forget it. A generated frame unwind is the exception,
            // and following it needs the same two steps the instructions themselves take: the
            // earlier transfer out of the pointer captured a base, and this one writes that base
            // back raised by a recorded count. Measuring the release from the captured base rather
            // than from the current depth is what makes the two agree, because a read of the top
            // slot in between pops a byte that this write then silently restores.
            //
            // Everything still beneath the released run keeps the facts it had, so an interrupt
            // entry that saved its caller's status before pushing a frame still has that snapshot
            // to restore afterwards — which is exactly what a route that hands over to a previous
            // handler, rather than returning from the interrupt, depends on.
            const released = instruction.releasesStackBytes;
            stack.length =
              released === undefined || cached === null ? 0 : Math.max(0, cached - released);
          }
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
        const proved = (available & required) === required;
        if (!proved) {
          record({
            stage: "machine flag proof",
            reason: `the generated '${block.terminator.opcode}' branch has no proved producer for its ${flagPhrase(
              unprovedFlags(block.terminator.uses.flags, available),
            )}`,
            functionId: owner(block.label),
            label: block.label,
            block,
          });
        }
        valid &&= proved;
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
          record({
            stage: "machine flag proof",
            reason:
              "two generated paths reach the same point holding different hardware-stack contents",
            functionId: owner(target),
            label: target,
          });
          active.delete(entry);
          return { returns: 0, preserves: 0, valid: false, returning: true };
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
        if (outgoing.stack.length !== 0) {
          record({
            stage: "machine flag proof",
            reason: "a generated return leaves bytes the function pushed on the hardware stack",
            functionId: owner(block.label),
            label: block.label,
            block,
          });
        }
        valid &&= outgoing.stack.length === 0;
        returns &= outgoing.flags;
        preserves &= outgoing.preserved;
        hasReturn = true;
      }
    }
    // A dispatch block transfers to a function chosen at run time and never returns itself,
    // so its own exit carries no facts. Because the reachable candidates are recorded and the
    // block adds no effects of its own, calling it is exactly calling one of them, and the
    // facts a caller may rely on are the ones every candidate guarantees. This is the same
    // intersection a control-flow join uses, applied across callees instead of edges.
    const marked = blocks.get(entry)?.indirectTargets;
    const dispatch = dispatchCandidates(blocks.get(entry));
    let dispatched: FlagSummary | null = null;
    // A block that names transfer candidates but does not have the shape they can answer for is
    // not an ordinary block either: reading its own exit would describe a transfer that never
    // comes back as though it returned. Answer conservatively instead of either of those.
    if (dispatch === null && marked !== undefined && marked.length > 0) {
      dispatched = { returns: 0, preserves: 0, valid, returning: true };
    }
    if (dispatch !== null) {
      let agreed = { returns: ALL_FLAGS, preserves: ALL_FLAGS };
      let anyReturning = false;
      for (const candidate of dispatch) {
        const target = resolve(candidate);
        // A candidate whose analysis is already in progress, or whose body is absent,
        // contributes nothing. It must not be called invalid for that: losing the facts
        // already costs every consumer after the dispatch its producer, which is the
        // conservative answer rather than a verdict about the candidate itself. The
        // pessimistic answer is then cached like any other, so the order in which callers
        // are walked can decide how precise it is. That is sound because the direction is
        // always toward refusal, and a program that could expose the difference — one whose
        // pointer can reach the function it is called from — is refused earlier as recursion.
        if (active.has(target) || !blocks.has(target)) {
          agreed = { returns: 0, preserves: 0 };
          anyReturning = true;
          continue;
        }
        const candidateSummary = analyze(target);
        valid &&= candidateSummary.valid;
        // Skipping a non-returning candidate is sound only while "does not return" really means
        // "cannot resume the caller". Two properties carry that, and both are relied on here
        // rather than rechecked: a dispatch block is only ever entered by a call, never by a
        // structured edge, and a routine's return is always its block's terminator rather than
        // an instruction in the middle of one. If either stops holding, this skip would keep
        // facts a returning candidate is free to violate, which is the unsound direction.
        // A candidate that never comes back is not one of the caller's incoming paths, so
        // its empty facts must not be intersected in. Intersecting them would cost every
        // consumer after the call its producer because one reachable function loops forever.
        if (!candidateSummary.returning) continue;
        anyReturning = true;
        agreed = {
          returns: agreed.returns & candidateSummary.returns,
          preserves: agreed.preserves & candidateSummary.preserves,
        };
      }
      // When no candidate returns, nothing is known about a resumption that cannot happen.
      dispatched = anyReturning
        ? { ...agreed, valid, returning: true }
        : { returns: 0, preserves: 0, valid, returning: false };
    }
    active.delete(entry);
    const summary = dispatched ?? {
      returns: hasReturn ? returns : 0,
      preserves: hasReturn ? preserves : 0,
      valid,
      returning: hasReturn,
    };
    cache.set(entry, summary);
    return summary;
  };
  const valid = functions.every((fn) => fn.blocks.length === 0 || analyze(fn.id).valid);
  if (valid) return null;
  // Every refusing check above records its site, so this is unreachable today. It exists because
  // the alternative failure mode is silent and far worse: a refusal with no defect would read as
  // a proved program and let malformed code through. A vague refusal is the safe direction.
  return (
    defect ??
    machineProgramDefect({
      stage: "machine flag proof",
      reason: "the proof that every consumed processor flag has a producer did not complete",
      functionId: UNKNOWN_MACHINE_SITE,
      label: UNKNOWN_MACHINE_SITE,
    })
  );
}
