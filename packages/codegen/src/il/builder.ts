/**
 * `IlFunctionBuilder` — the deterministic per-function IL assembler (RD-06
 * §4.4, R15/R16).
 *
 * Lowering (`lower.ts`) drives a builder per function: it opens the `_entry`
 * block, appends instructions as it walks the body, mints virtual temps with
 * monotonically increasing ids (`%0`, `%1`, …), opens further blocks (`_L0`,
 * `_L1`, …) as control flow demands, and finally `finish`es into a frozen
 * {@link ILFunction}. Temp ids and block labels are assigned strictly in call
 * order, so a given AST always yields byte-identical IL (H5/R53).
 *
 * The builder owns **no** lowering policy — it is a dumb, ordered accumulator;
 * all "what to emit" decisions live in `lower.ts`. Pure, synchronous, no I/O.
 */

import type { ILInstruction, ILTerminator } from "./instruction.js";
import type { ILOperand } from "./operand.js";
import { temp } from "./operand.js";
import type { ILType } from "./il-type.js";
import type { BasicBlock, ILFunction } from "./cfg.js";

/** A block under construction: its label, appended instructions, and (once set) terminator. */
interface PendingBlock {
  readonly label: string;
  readonly instructions: ILInstruction[];
  terminator: ILTerminator | undefined;
}

/**
 * Assembles one {@link ILFunction} deterministically.
 *
 * Usage: construct with the function's name/params/return type/interrupt flag,
 * append instructions and terminators against the current block, mint temps via
 * {@link IlFunctionBuilder.newTemp}, then call {@link IlFunctionBuilder.finish}.
 */
export class IlFunctionBuilder {
  private readonly blocks: PendingBlock[] = [];
  private current: PendingBlock;
  private nextTempId = 0;
  private nextLabelId = 0;

  /**
   * Open a builder with its `_entry` block already started (R16).
   *
   * @param name Fully-qualified function name (`"Module.fn"`).
   * @param params Parameter operands (plan-backed `Location`s), in order.
   * @param returnType The IL return type, or `"void"`.
   * @param isInterrupt Whether this is an interrupt handler.
   */
  constructor(
    private readonly name: string,
    private readonly params: readonly ILOperand[],
    private readonly returnType: ILType | "void",
    private readonly isInterrupt: boolean,
  ) {
    this.current = { label: "_entry", instructions: [], terminator: undefined };
    this.blocks.push(this.current);
  }

  /**
   * Mint a fresh virtual temp `%N` of the given type (R9). Ids increase by one
   * per call, in call order.
   *
   * @param type The temp's IL type.
   * @returns A `temp` operand with the next id.
   */
  newTemp(type: ILType): ILOperand {
    return temp(this.nextTempId++, type);
  }

  /**
   * Reserve the next block label (`_L0`, `_L1`, …) without opening it. Used when
   * a terminator must name a successor before the block is started.
   *
   * @returns The reserved label string.
   */
  reserveLabel(): string {
    return `_L${this.nextLabelId++}`;
  }

  /**
   * Append an instruction to the current block (R12). No-op semantics are the
   * caller's concern; the builder simply records.
   *
   * @param ins The instruction to append.
   */
  emit(ins: ILInstruction): void {
    this.current.instructions.push(ins);
  }

  /**
   * Set the current block's terminator (R12 — one per block). Subsequent
   * `emit`s would belong to a later block opened via {@link openBlock}.
   *
   * @param term The block's terminator.
   */
  terminate(term: ILTerminator): void {
    this.current.terminator = term;
  }

  /** `true` once the current block has a terminator. */
  isTerminated(): boolean {
    return this.current.terminator !== undefined;
  }

  /**
   * Open a new block with the given label (typically from
   * {@link reserveLabel}) and make it current.
   *
   * @param label The new block's label.
   */
  openBlock(label: string): void {
    this.current = { label, instructions: [], terminator: undefined };
    this.blocks.push(this.current);
  }

  /**
   * Finish into a frozen {@link ILFunction} (R67). Any block still missing a
   * terminator is closed with `fallbackTerminator` (the caller supplies a
   * `ret()` for void fall-through, R42), so the result is always well-formed.
   *
   * @param fallbackTerminator Terminator applied to any un-terminated block.
   * @returns The immutable assembled function.
   */
  finish(fallbackTerminator: ILTerminator): ILFunction {
    const blocks: BasicBlock[] = this.blocks.map((b) => ({
      label: b.label,
      instructions: Object.freeze([...b.instructions]),
      terminator: b.terminator ?? fallbackTerminator,
    }));
    return Object.freeze({
      name: this.name,
      params: Object.freeze([...this.params]),
      returnType: this.returnType,
      blocks: Object.freeze(blocks),
      tempCount: this.nextTempId,
      isInterrupt: this.isInterrupt,
    });
  }
}
