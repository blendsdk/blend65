import { byteContinuationQuery, BYTE_WINDOW_CHANGED } from "../machine/lower-control.js";
import type { Body, Item } from "./size-observer-complement-field-layout.js";

/** Limit this predicate to the Y, carry and overflow differences it was designed to close. */
const mask = (uses: Item["instruction"]["uses"]) =>
  (uses.registers.includes("y") ? BYTE_WINDOW_CHANGED.y : 0) |
  (uses.flags.includes("c") ? BYTE_WINDOW_CHANGED.c : 0) |
  (uses.flags.includes("v") ? BYTE_WINDOW_CHANGED.v : 0);

/**
 * Prove dormant cyclic bits block-locally, never by interpreting cycle values.
 * This closes only Y/C/V after a matched occurrence. The caller must establish
 * the other state components and the real caller/startup preservation contract.
 * Query-only call/halt summaries never modify emitted code or its cost.
 * @param pair Independently bound source and actual instructions for one construction.
 * @param read Last real occurrence in the matched read or store window.
 * @returns Whether each supported changed bit is killed or unobserved.
 * @example const safe = stateSafe(pair, matchedLoad);
 */
export const stateSafe = (pair: Body, read: Item) => {
  const functions = pair.view.shared.layout.program.functions;
  /** Only an exact direct entry may supply a callee state proof. */
  const target = (item: Item["instruction"]) => {
    const operand = item.operand;
    return operand?.kind === "label" &&
      (operand.offset ?? 0) === 0 &&
      operand.addressByte === undefined &&
      operand.transform === undefined
      ? functions.find((fn) => fn.id === operand.label)
      : undefined;
  };
  /** A generated terminal halt consumes no outgoing ordinary ABI state. */
  const terminal = (block: Item["block"]) =>
    block.instructions.length === 1 &&
    block.instructions[0]?.opcode === "sei" &&
    block.terminator.kind === "jump" &&
    block.terminator.target === block.label
      ? { kind: "return" as const }
      : block.terminator;
  /** Summarize only proved non-observing calls and exact halts for this one bit. */
  const queryBlocks = (bit: number) =>
    new Map(
      [...pair.blocks].map(([label, block]) => [
        label,
        {
          ...block,
          // Query-only summaries retain the changed bits across a call. The real
          // callee must independently kill them before use; output is never changed.
          instructions: block.instructions.map((item) => {
            const callee = item.opcode === "jsr" ? target(item) : undefined;
            return callee !== undefined &&
              byteContinuationQuery(
                new Map(callee.blocks.map((b) => [b.label, { ...b, terminator: terminal(b) }])),
              )(callee.blocks[0]!.label, 0, bit)
              ? {
                  ...item,
                  opcode: "nop",
                  uses: { registers: [], flags: [] },
                  defines: { registers: [], flags: [] },
                }
              : item;
          }),
          terminator: terminal(block),
        },
      ]),
    );
  return [BYTE_WINDOW_CHANGED.y, BYTE_WINDOW_CHANGED.c, BYTE_WINDOW_CHANGED.v].every((bit) => {
    if (
      functions.every((fn) =>
        fn.blocks.every(
          (block) =>
            ((block.terminator.kind !== "branch" && block.terminator.kind !== "long-branch") ||
              (mask(block.terminator.uses) & bit) === 0) &&
            block.instructions.every(
              (item) =>
                (mask(item.uses) & bit) === 0 &&
                (item.opcode !== "jsr" || target(item) !== undefined),
            ),
        ),
      )
    )
      return true;
    const blocks = queryBlocks(bit),
      current = blocks.get(read.block.label)!;
    if (byteContinuationQuery(blocks)(read.block.label, read.index + 1, bit)) return true;
    /** Every block must accept an arbitrary incoming changed bit without using it. */
    const safe = (
      instructions: readonly Item["instruction"][],
      term: Item["block"]["terminator"],
    ) => {
      let pending: number = bit;
      for (const item of instructions) {
        if (pending === 0) return true;
        if (item.opcode === "jsr" || item.opcode === "jmp" || (mask(item.uses) & pending) !== 0)
          return false;
        pending &= ~mask(item.defines);
      }
      return (
        (term.kind !== "branch" && term.kind !== "long-branch") || (mask(term.uses) & pending) === 0
      );
    };
    return (
      safe(current.instructions.slice(read.index + 1), current.terminator) &&
      [...blocks.values()].every((block) => safe(block.instructions, block.terminator))
    );
  });
};
