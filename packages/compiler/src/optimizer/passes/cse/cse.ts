/**
 * CSE Pass — Common Subexpression Elimination
 *
 * Final concrete class in the CSE inheritance chain. Implements the
 * `OptimizationPass` interface and orchestrates the CSE algorithm.
 *
 * **Algorithm Overview:**
 * 1. Walk through instructions sequentially within basic blocks
 * 2. Track accumulator state (what was loaded into A)
 * 3. When a CSE-eligible operation is seen, form an expression key
 * 4. Check if the same expression was already computed and stored
 * 5. If match found: replace LOAD+OP with a single LOAD_BYTE from result slot
 * 6. If no match: after STORE_BYTE, record the expression as available
 * 7. Invalidate expressions when their input/result slots are modified
 * 8. Clear all expressions at block boundaries
 *
 * **Inheritance Chain:**
 * ```
 * CSEBase → CSETracker → CSEPass (this file)
 * ```
 *
 * **Enabled At:** O2+
 *
 * **Scope Limitation:**
 * - Local CSE only (within basic blocks, not across control flow)
 * - Does not handle commutative equivalence (a+b vs b+a)
 * - Does not CSE memory operations (peek/poke)
 *
 * @module optimizer/passes/cse/cse
 */

import type { ILFunction } from '../../../il/structures.js';
import type { ILInstruction } from '../../../il/instruction.js';
import { ILOpcode } from '../../../il/enums.js';
import { isSlotOperand } from '../../../il/guards.js';
import { createInstruction } from '../../../il/factories.js';
import type { OptimizationOptions } from '../../options.js';
import type { OptimizationPass, PassResult } from '../../pass.js';
import { createResult } from '../../pass.js';
import type { CSEStats } from './types.js';
import { CSETracker } from './tracker.js';

// ============================================================================
// CSE Pass
// ============================================================================

/**
 * Common Subexpression Elimination optimization pass.
 *
 * Eliminates redundant computations within basic blocks by detecting
 * when the same expression (same accumulator source + same operation +
 * same operand) is computed more than once, and replacing duplicates
 * with a load from the slot where the first result was stored.
 *
 * **Example transformation:**
 * ```
 * // Before CSE:
 * LOAD_BYTE x       ; A ← x
 * ADD_BYTE y         ; A ← x + y
 * STORE_BYTE z       ; z ← x + y (first computation)
 * ...
 * LOAD_BYTE x       ; A ← x
 * ADD_BYTE y         ; A ← x + y (redundant!)
 * STORE_BYTE w       ; w ← x + y
 *
 * // After CSE:
 * LOAD_BYTE x       ; A ← x
 * ADD_BYTE y         ; A ← x + y
 * STORE_BYTE z       ; z ← x + y (first computation)
 * ...
 * LOAD_BYTE z       ; A ← z (= x + y, already computed)
 * NOP               ; (eliminated operation)
 * STORE_BYTE w       ; w ← z
 * ```
 *
 * @example
 * ```typescript
 * const cse = new CSEPass();
 * const manager = new PassManager({ level: 'O2' });
 * manager.registerPass(cse);
 * ```
 */
export class CSEPass extends CSETracker implements OptimizationPass {
  // ═══════════════════════════════════════════════════════════════════
  // OptimizationPass Interface
  // ═══════════════════════════════════════════════════════════════════

  /** Pass name — used for configuration and logging */
  readonly name = 'cse';

  /**
   * Dependencies — runs after constant propagation for best results.
   *
   * Constant propagation creates more known values that enable CSE.
   * Copy propagation simplifies the load patterns that CSE tracks.
   */
  readonly dependencies: string[] = ['constant-prop'];

  // ═══════════════════════════════════════════════════════════════════
  // Pass Execution
  // ═══════════════════════════════════════════════════════════════════

  /**
   * Run CSE on a function.
   *
   * Walks through instructions tracking expressions and replacing
   * duplicate computations with loads from previously stored results.
   *
   * @param func - IL function to optimize (modified in place)
   * @param options - Optimization options
   * @returns Pass result with modification statistics
   */
  run(func: ILFunction, options: OptimizationOptions): PassResult {
    // Reset tracking state for this function
    this.resetState();

    const instructions = func.instructions;
    const stats: CSEStats = {
      expressionsEliminated: 0,
      instructionsRemoved: 0,
      debugInfo: [],
    };

    // Indices of instructions to remove (replaced with NOP during CSE)
    const indicesToRemove = new Set<number>();

    for (let i = 0; i < instructions.length; i++) {
      const instr = instructions[i];

      // Block boundaries clear all tracked state
      if (this.isBlockBoundary(instr)) {
        if (options.debug && this.availableExpressions.size > 0) {
          stats.debugInfo.push(
            `Block boundary at ${i} (${instr.opcode}) clears ${this.availableExpressions.size} expression(s)`
          );
        }
        this.clearAllExpressions();
        continue;
      }

      // Handle LOAD_BYTE/LOAD_IMM — update accumulator state
      if (instr.opcode === ILOpcode.LOAD_BYTE || instr.opcode === ILOpcode.LOAD_IMM) {
        // VOLATILE PROTECTION: @zp global loads are volatile — the value
        // may change between reads (e.g., interrupt handler modifies it).
        // Do NOT track the accumulator state for volatile loads, which
        // prevents CSE from forming expression keys that could reuse
        // a stale cached value. @data globals are const and CAN be cached.
        if (instr.isVolatile) {
          this.accState = this.accUnknown();
          this.pendingExpression = null;
          continue;
        }
        this.updateAccFromLoad(instr);
        continue;
      }

      // Handle STORE_BYTE — record pending expression if any
      if (instr.opcode === ILOpcode.STORE_BYTE) {
        this.handleStore(instr, i, options, stats);
        continue;
      }

      // Handle slot writes that are not STORE_BYTE (INC_BYTE, DEC_BYTE, STORE_WORD)
      if (this.isSlotWrite(instr)) {
        const slotName = this.getSlotName(instr);
        if (slotName) {
          if (options.debug) {
            stats.debugInfo.push(`Slot write to '${slotName}' at ${i} — invalidating`);
          }
          this.invalidateSlot(slotName);
        }
        // These operations also change the accumulator state unpredictably
        this.accState = this.accUnknown();
        this.pendingExpression = null;
        continue;
      }

      // Handle CSE-eligible operations
      if (this.isCSEEligible(instr)) {
        this.handleCSEEligible(instr, i, instructions, indicesToRemove, options, stats);
        continue;
      }

      // Any other instruction that modifies the accumulator makes it unknown
      // (e.g., NOT_BYTE, TRANSFER_XA, POP_A, PEEK, etc.)
      if (this.modifiesAccumulator(instr)) {
        this.accState = this.accUnknown();
        this.pendingExpression = null;
      }
    }

    // Remove eliminated instructions by filtering out NOP-marked indices
    if (indicesToRemove.size > 0) {
      func.instructions = instructions.filter((_, idx) => !indicesToRemove.has(idx));
      stats.instructionsRemoved = indicesToRemove.size;
    }

    return createResult(
      stats.instructionsRemoved,
      0,
      stats.debugInfo.length > 0 ? stats.debugInfo : undefined
    );
  }

  // ═══════════════════════════════════════════════════════════════════
  // Instruction Handlers
  // ═══════════════════════════════════════════════════════════════════

  /**
   * Handle a STORE_BYTE instruction.
   *
   * If there's a pending expression (from a previous CSE-eligible op),
   * record it as available. Also handles invalidation of the stored slot.
   *
   * @param instr - The STORE_BYTE instruction
   * @param index - Index in the instructions array
   * @param options - Optimization options
   * @param stats - Statistics collector
   */
  protected handleStore(
    instr: ILInstruction,
    index: number,
    options: OptimizationOptions,
    stats: CSEStats
  ): void {
    const storeSlot = this.getSlotName(instr);
    if (!storeSlot) return;

    // Check for pending expression to record
    const pending = this.consumePendingExpression();
    if (pending) {
      // Record: this expression's result is now stored in storeSlot
      this.recordExpression(pending, storeSlot, index);

      if (options.debug) {
        stats.debugInfo.push(
          `Recorded expression: ${this.serializeKey(pending)} → slot '${storeSlot}' at ${index}`
        );
      }
    }

    // STORE_BYTE also writes to the slot, invalidating expressions
    // that depend on storeSlot's OLD value. But we just recorded
    // the new expression above, so we invalidate BEFORE recording...
    // Actually, we should invalidate expressions using storeSlot as
    // input FIRST, then record the new expression.
    // Since recordExpression already added it, we need to be careful:
    // invalidateSlot would remove our newly added expression if it
    // references storeSlot in its key. But it won't, because the
    // expression is about the computation, not the store target.
    // However, if storeSlot is also an input (e.g., x = x + y → store x),
    // the expression key has accSource='x', and invalidateSlot('x') would
    // remove it. This is correct — if x was rewritten, the expression
    // x + y is no longer valid at x's new value.

    // Invalidate other expressions that used storeSlot as input
    // (but DON'T invalidate the one we just added unless it self-references)
    this.invalidateSlotExcept(storeSlot, pending ? this.serializeKey(pending) : null);

    // The accumulator now holds the value that was stored,
    // but we don't update accState because the acc value hasn't changed
    // (STORE doesn't modify A — it just writes A to memory)
  }

  /**
   * Handle a CSE-eligible instruction (ADD_BYTE, SUB_BYTE, etc.).
   *
   * Forms an expression key and checks for a match in available expressions.
   * If a match is found, replaces the LOAD+OP sequence with a single LOAD
   * from the result slot. If no match, records as a pending expression.
   *
   * @param instr - The CSE-eligible instruction
   * @param index - Index in the instructions array
   * @param instructions - Full instruction array (for modifying)
   * @param indicesToRemove - Set of indices to remove
   * @param options - Optimization options
   * @param stats - Statistics collector
   */
  protected handleCSEEligible(
    instr: ILInstruction,
    index: number,
    instructions: ILInstruction[],
    indicesToRemove: Set<number>,
    options: OptimizationOptions,
    stats: CSEStats
  ): void {
    // Try to form an expression key
    const key = this.tryFormExpressionKey(instr);

    if (key === null) {
      // Can't form a key — accumulator source unknown or operand can't be extracted
      // The operation modifies A, making it unknown for subsequent tracking
      this.accState = this.accUnknown();
      this.pendingExpression = null;
      return;
    }

    // Check if this expression was already computed
    const existing = this.lookupExpression(key);

    if (existing) {
      // CSE HIT! Replace the LOAD+OP sequence with LOAD from result slot
      this.applyCSEReplacement(index, instructions, indicesToRemove, existing, options, stats);
    } else {
      // No match — record as pending (will be stored by next STORE_BYTE)
      this.setPendingExpression(key);
    }

    // After a CSE-eligible op, the accumulator holds the result,
    // which is unknown (not a simple slot or immediate anymore)
    this.accState = this.accUnknown();
  }

  /**
   * Apply a CSE replacement.
   *
   * Replaces the preceding LOAD instruction with a LOAD_BYTE from the
   * result slot, and marks the current operation for removal.
   *
   * @param opIndex - Index of the CSE-eligible operation to eliminate
   * @param instructions - Full instruction array
   * @param indicesToRemove - Set to add removed indices to
   * @param existing - The tracked expression with the result slot
   * @param options - Optimization options
   * @param stats - Statistics collector
   */
  protected applyCSEReplacement(
    opIndex: number,
    instructions: ILInstruction[],
    indicesToRemove: Set<number>,
    existing: import('./types.js').TrackedExpression,
    options: OptimizationOptions,
    stats: CSEStats
  ): void {
    // The preceding instruction should be the LOAD that set the accumulator
    const loadIndex = opIndex - 1;
    if (loadIndex < 0) return;

    const loadInstr = instructions[loadIndex];
    if (
      loadInstr.opcode !== ILOpcode.LOAD_BYTE &&
      loadInstr.opcode !== ILOpcode.LOAD_IMM
    ) {
      // The LOAD isn't immediately before the OP — can't safely replace
      return;
    }

    // Find the original STORE instruction to get the result slot's operand
    const storeInstr = instructions[existing.instructionIndex];
    if (!storeInstr || storeInstr.opcode !== ILOpcode.STORE_BYTE) return;

    const storeOp = storeInstr.operands[0];
    if (!isSlotOperand(storeOp)) return;

    // Replace the LOAD with a LOAD_BYTE from the result slot
    instructions[loadIndex] = createInstruction(
      ILOpcode.LOAD_BYTE,
      [storeOp], // Reuse the slot operand from the original STORE
      {
        location: loadInstr.location,
        comment: loadInstr.comment
          ? `${loadInstr.comment} (CSE: reuse '${existing.resultSlot}')`
          : `CSE: load from '${existing.resultSlot}' instead of recomputing`,
      }
    );

    // Mark the operation for removal (it's now redundant)
    indicesToRemove.add(opIndex);

    stats.expressionsEliminated++;

    if (options.debug) {
      stats.debugInfo.push(
        `CSE eliminated at ${opIndex}: ${this.serializeKey(existing.key)} → load '${existing.resultSlot}'`
      );
    }
  }

  // ═══════════════════════════════════════════════════════════════════
  // Helper Methods
  // ═══════════════════════════════════════════════════════════════════

  /**
   * Invalidate expressions referencing a slot, except one specific key.
   *
   * Used during STORE_BYTE handling to invalidate old expressions using
   * the stored slot while preserving the newly recorded expression.
   *
   * @param slotName - Slot name to invalidate
   * @param exceptKey - Serialized key to preserve (or null)
   */
  protected invalidateSlotExcept(slotName: string, exceptKey: string | null): void {
    const toDelete: string[] = [];

    for (const [serialized, tracked] of this.availableExpressions) {
      // Skip the exception key
      if (serialized === exceptKey) continue;

      if (
        tracked.key.accSource === slotName ||
        tracked.key.operand === slotName ||
        tracked.resultSlot === slotName
      ) {
        toDelete.push(serialized);
      }
    }

    for (const key of toDelete) {
      this.availableExpressions.delete(key);
    }

    // If the accumulator was loaded from this slot, it's now stale
    if (this.accState.source === slotName && this.accState.kind === 'slot') {
      this.accState = this.accUnknown();
    }
  }

  /**
   * Check if an instruction modifies the accumulator.
   *
   * Used to mark the accumulator as unknown after non-CSE operations
   * that change its value (NOT_BYTE, transfers, stack ops, intrinsics).
   *
   * @param instr - Instruction to check
   * @returns true if the instruction changes the accumulator value
   */
  protected modifiesAccumulator(instr: ILInstruction): boolean {
    const opcode = instr.opcode;

    // Bitwise NOT changes A
    if (opcode === ILOpcode.NOT_BYTE) return true;

    // Register transfers that write to A
    if (opcode === ILOpcode.TRANSFER_XA || opcode === ILOpcode.TRANSFER_YA) return true;

    // Stack pop loads into A
    if (opcode === ILOpcode.POP_A) return true;

    // Intrinsics that load values
    if (
      opcode === ILOpcode.PEEK ||
      opcode === ILOpcode.PEEKW ||
      opcode === ILOpcode.HI ||
      opcode === ILOpcode.LO ||
      // Indirect addressing intrinsics that load into A
      opcode === ILOpcode.PEEK_INDIRECT ||
      opcode === ILOpcode.PEEKW_INDIRECT
    ) {
      return true;
    }

    // Word arithmetic modifies A:X register pair
    // (these completely change the accumulator state)
    if (
      opcode === ILOpcode.ADD_WORD_IMM ||
      opcode === ILOpcode.ADD_WORD_BYTE_IMM ||
      opcode === ILOpcode.ADD_WORD_SLOT ||
      opcode === ILOpcode.ADD_WORD_BYTE_SLOT ||
      opcode === ILOpcode.SUB_WORD_IMM ||
      opcode === ILOpcode.SUB_WORD_BYTE_IMM ||
      opcode === ILOpcode.SUB_WORD_SLOT ||
      opcode === ILOpcode.SUB_WORD_BYTE_SLOT ||
      opcode === ILOpcode.INC_WORD ||
      opcode === ILOpcode.DEC_WORD ||
      opcode === ILOpcode.CMP_WORD_IMM ||
      opcode === ILOpcode.CMP_WORD_SLOT ||
      opcode === ILOpcode.PROMOTE_BYTE_WORD ||
      opcode === ILOpcode.LOAD_WORD ||
      opcode === ILOpcode.LOAD_IMM_WORD
    ) {
      return true;
    }

    // Comparison instructions don't modify A (only flags)
    // STORE doesn't modify A
    // PUSH_A doesn't modify A
    // TRANSFER_AX/AY don't modify A

    return false;
  }
}
