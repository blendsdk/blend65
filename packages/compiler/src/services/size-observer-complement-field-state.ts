import { BYTE_WINDOW_CHANGED, machineSuccessors } from "../machine/lower-control.js";
import type { MachineFunction, MachineInstruction } from "../machine/machine-types.js";
import type { Body, Item } from "./size-observer-complement-field-layout.js";

/** Limit this predicate to the Y, carry and overflow differences it was designed to close. */
const mask = (uses: Item["instruction"]["uses"]) =>
  (uses.registers.includes("y") ? BYTE_WINDOW_CHANGED.y : 0) |
  (uses.flags.includes("c") ? BYTE_WINDOW_CHANGED.c : 0) |
  (uses.flags.includes("v") ? BYTE_WINDOW_CHANGED.v : 0);

/**
 * Build one forward must-be-defined liveness check for a single architectural bit.
 *
 * A path observes a changed bit when it reads the register/flag before defining
 * it. Bounded and unbounded loops are handled by the finite state space: a
 * repeated `(block, start)` state contributes nothing new, so a loop that
 * neither reads nor writes the bit cannot make the proof fail. Calls are
 * summarized recursively and never modify emitted code or its cost.
 * @param pair Independently bound source and actual instructions for one construction.
 * @returns A query that reports whether a continuation reads the bit first.
 * @example const observes = analyzer(pair); observes(fn, block, 0, bit, new Set())
 */
const analyzer = (pair: Body) => {
  const functions = pair.view.shared.layout.program.functions;
  const restore = pair.view.shared.layout.program.startup.blocks.find(
    (block) => block.label === "startup.restore",
  );
  /** Only an exact direct entry may supply a callee state proof. */
  const target = (item: MachineInstruction) => {
    const operand = item.operand;
    return operand?.kind === "label" &&
      (operand.offset ?? 0) === 0 &&
      operand.addressByte === undefined &&
      operand.transform === undefined
      ? functions.find((fn) => fn.id === operand.label)
      : undefined;
  };
  const summaries = new Map<string, boolean>();
  const identity = (fn: MachineFunction, bit: number) => `${fn.id}\0${bit}`;

  /**
   * Whether any path reads this bit before defining it, starting at one
   * instruction occurrence and continuing through the function.
   */
  const observes = (
    fn: MachineFunction,
    block: string,
    start: number,
    bit: number,
    visiting: ReadonlySet<string>,
  ): boolean => {
    const seen = new Set<string>();
    const pending: { block: string; start: number }[] = [{ block, start }];
    while (pending.length > 0) {
      const current = pending.pop()!;
      const site = `${current.block}\0${current.start}`;
      if (seen.has(site)) continue;
      seen.add(site);
      const body = fn.blocks.find((entry) => entry.label === current.block);
      if (body === undefined) return true;
      let live = bit;
      for (const item of body.instructions.slice(current.start)) {
        if (live === 0) break;
        if (item.opcode === "jsr") {
          const callee = target(item);
          if (callee === undefined || calleeObserves(callee, bit, visiting)) return true;
          continue;
        }
        if ((mask(item.uses) & live) !== 0) return true;
        live &= ~mask(item.defines);
      }
      if (live === 0) continue;
      const term = body.terminator;
      if (
        term.kind === "return" ||
        (restore !== undefined && term.kind === "jump" && term.target === restore.label)
      )
        continue;
      if ((term.kind === "branch" || term.kind === "long-branch") && (mask(term.uses) & live) !== 0)
        return true;
      for (const successor of machineSuccessors(body)) pending.push({ block: successor, start: 0 });
    }
    return false;
  };

  /** Summarize one complete callee for one bit, including its nested calls. */
  const calleeObserves = (
    fn: MachineFunction,
    bit: number,
    visiting: ReadonlySet<string>,
  ): boolean => {
    const key = identity(fn, bit);
    const cached = summaries.get(key);
    if (cached !== undefined) return cached;
    // A recursive cycle that has not observed the bit before re-entering is
    // assumed safe for this bit; a real observation on the cycle is found on
    // the concrete path.
    if (visiting.has(key)) return false;
    const entry = fn.blocks[0];
    const result =
      entry === undefined || observes(fn, entry.label, 0, bit, new Set([...visiting, key]));
    summaries.set(key, result);
    return result;
  };

  return observes;
};

/**
 * Whether a changed architectural bit is observed from one continuation point.
 * @param pair Independently bound source and actual instructions for one construction.
 * @param block Actual block label where the continuation starts.
 * @param start First instruction after the matched occurrence.
 * @param bit One supported changed-bit mask.
 * @returns True only when no path reads the bit before defining it.
 * @example bitSafe(after, exitLabel, 0, BYTE_WINDOW_CHANGED.y)
 */
export const bitSafe = (pair: Body, block: string, start: number, bit: number) =>
  !analyzer(pair)(pair.actual, block, start, bit, new Set());

/**
 * Prove dormant cyclic bits without interpreting cycle values.
 * @param pair Independently bound source and actual instructions for one construction.
 * @param read Last real occurrence in the matched read or store window.
 * @param changedBits Architectural bits whose reference/selected difference remains.
 * @returns Whether each requested bit is killed or unobserved.
 * @example const safe = stateSafe(pair, matchedLoad);
 */
export const stateSafe = (
  pair: Body,
  read: Item,
  changedBits = BYTE_WINDOW_CHANGED.y | BYTE_WINDOW_CHANGED.c | BYTE_WINDOW_CHANGED.v,
) => {
  const observes = analyzer(pair);
  return [BYTE_WINDOW_CHANGED.y, BYTE_WINDOW_CHANGED.c, BYTE_WINDOW_CHANGED.v].every(
    (bit) =>
      (changedBits & bit) === 0 ||
      !observes(pair.actual, read.block.label, read.index + 1, bit, new Set()),
  );
};
