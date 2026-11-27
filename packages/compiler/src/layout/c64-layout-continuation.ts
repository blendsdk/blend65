import type { MachineFunction } from "../machine/machine-types.js";

/**
 * The body a placed function continues into from its physically last block.
 *
 * Only a jump marked as a continuation qualifies, and only from the last block,
 * because that is the one place control can fall out of a body into whatever is
 * placed after it. Any other jump is part of the body's own control flow, or a
 * transfer whose target layout is not asked to move.
 * @param fn A function after branch repair, blocks in placed order.
 * @returns The label the closing continuation jump names, or `undefined`.
 * @example
 * continuationTarget(main); // "fn.work" when main ends `jmp work` as a continuation
 */
export function continuationTarget(fn: MachineFunction): string | undefined {
  const terminator = fn.blocks.at(-1)?.terminator;
  return terminator?.kind === "jump" && terminator.continuation === true
    ? terminator.target
    : undefined;
}

/**
 * Replace a placed function's closing continuation jump with a fall-through.
 *
 * The caller has already placed the target at the address right after the
 * last block's instructions. Nothing else moves: removing a jump from the very
 * end changes no branch distance inside the body, since nothing follows it.
 * @param fn A placed function whose last block ends in a continuation jump.
 * @returns The same function, three bytes shorter; unchanged without such a jump.
 * @example
 * const fallen = fallIntoNext(main); // main now falls into work
 */
export function fallIntoNext(fn: MachineFunction): MachineFunction {
  const last = fn.blocks.at(-1);
  const jump = last?.terminator;
  if (last === undefined || jump?.kind !== "jump" || jump.continuation !== true) return fn;
  return Object.freeze({
    ...fn,
    blocks: Object.freeze([
      ...fn.blocks.slice(0, -1),
      Object.freeze({
        ...last,
        terminator: Object.freeze({
          kind: "fallthrough" as const,
          target: jump.target,
          ...(jump.source === undefined ? {} : { source: jump.source }),
        }),
      }),
    ]),
  });
}

/**
 * Whether a function falls out of its last block into another body.
 *
 * Such a function is bound to the address of what follows it, so it must not
 * be laid out again in a way that changes its length.
 * @param fn A placed function.
 * @returns True when the last block falls through to a label the body does not own.
 * @example
 * if (fallsIntoAnotherBody(fn)) return fn; // keep its length
 */
export function fallsIntoAnotherBody(fn: MachineFunction): boolean {
  const terminator = fn.blocks.at(-1)?.terminator;
  return (
    terminator?.kind === "fallthrough" &&
    !fn.blocks.some((block) => block.label === terminator.target)
  );
}

/**
 * Whether a function is nothing but a fall-through into the body after it.
 *
 * Such a body shares its entry address with what follows and owns no bytes,
 * so it has no output range of its own; the body after it owns the code that
 * runs.
 * @param fn A placed function.
 * @returns True when no block holds an instruction and the body falls into another.
 * @example
 * if (occupiesNoBytes(main)) return []; // main's address is work's
 */
export function occupiesNoBytes(fn: MachineFunction): boolean {
  return (
    fallsIntoAnotherBody(fn) &&
    fn.blocks.every(
      ({ instructions, terminator }) =>
        instructions.length === 0 &&
        (terminator.kind === "fallthrough" || terminator.kind === "unreachable"),
    )
  );
}

/** BASIC ROM, which the handback mapping exposes over RAM once the restoration writes the CPU port. */
const BASIC_ROM = Object.freeze({ start: 0xa000, end: 0xbfff });

/**
 * Whether the restoration can run from an address range to its last byte.
 *
 * The restoration writes the CPU port back to the mapping BASIC handed over
 * while it is still running. Under that mapping BASIC ROM covers
 * $A000-$BFFF, so restoration code placed there would stop being fetched
 * from RAM halfway through. Anywhere else in the resident window stays RAM.
 * @param start First address of the restoration.
 * @param bytes Its length.
 * @returns True when no byte of it lies under BASIC ROM.
 * @example
 * restorationVisible(0x0863, 26); // true
 */
export function restorationVisible(start: number, bytes: number): boolean {
  const end = start + bytes - 1;
  return end < BASIC_ROM.start || start > BASIC_ROM.end;
}
