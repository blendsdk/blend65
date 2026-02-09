/**
 * CSE Tracker — Expression Tracking and Invalidation
 *
 * Middle layer of the CSE inheritance chain. Manages:
 * - Available expression tracking within basic blocks
 * - Accumulator state tracking (what value is in A)
 * - Expression invalidation when slots are modified
 * - Block boundary clearing
 *
 * **Inheritance Chain:**
 * ```
 * CSEBase → CSETracker (this file) → CSEPass
 * ```
 *
 * @module optimizer/passes/cse/tracker
 */

import type { ILInstruction } from '../../../il/instruction.js';
import { ILOpcode } from '../../../il/enums.js';
import type { ExpressionKey, TrackedExpression, AccumulatorState } from './types.js';
import { CSEBase } from './base.js';

// ============================================================================
// CSE Tracker
// ============================================================================

/**
 * CSE expression tracker — tracks available expressions and handles invalidation.
 *
 * This layer maintains two key pieces of state:
 * 1. **Accumulator state**: What value is currently in A (slot name, immediate, or unknown)
 * 2. **Available expressions**: Map of serialized expression keys to tracked results
 *
 * **Expression Lifecycle:**
 * 1. LOAD_BYTE/LOAD_IMM → Sets accumulator source
 * 2. CSE-eligible op (ADD_BYTE, etc.) → Forms expression key from acc source + op
 * 3. STORE_BYTE → Records expression result in available map
 * 4. Later LOAD_BYTE + same op → CSE match! Replace with load from result slot
 *
 * **Invalidation Rules:**
 * - STORE_BYTE to slot S → Invalidate all expressions using S as input or result
 * - INC_BYTE/DEC_BYTE on slot S → Invalidate all expressions using S
 * - LABEL/JUMP/CALL/RETURN → Clear ALL tracked expressions (block boundary)
 *
 * @example
 * ```typescript
 * // Used internally by CSEPass
 * class CSEPass extends CSETracker implements OptimizationPass { ... }
 * ```
 */
export class CSETracker extends CSEBase {
  // ═══════════════════════════════════════════════════════════════════
  // Tracking State
  // ═══════════════════════════════════════════════════════════════════

  /**
   * Current accumulator state.
   *
   * Tracks what was last loaded into A so we can form expression keys
   * when a CSE-eligible operation is encountered.
   */
  protected accState: AccumulatorState = this.accUnknown();

  /**
   * Available expressions: serialized key → tracked expression.
   *
   * Contains expressions whose results are stored in known slots
   * and haven't been invalidated by writes or block boundaries.
   */
  protected availableExpressions: Map<string, TrackedExpression> = new Map();

  /**
   * The most recent expression computed but not yet stored.
   *
   * After a CSE-eligible operation, the expression is "pending" until
   * a STORE_BYTE records where the result went. Only stored expressions
   * can be reused by later code.
   */
  protected pendingExpression: ExpressionKey | null = null;

  // ═══════════════════════════════════════════════════════════════════
  // State Management
  // ═══════════════════════════════════════════════════════════════════

  /**
   * Reset all tracking state for a new function or after a block boundary.
   *
   * Clears accumulator state, available expressions, and pending expression.
   */
  protected resetState(): void {
    this.accState = this.accUnknown();
    this.availableExpressions.clear();
    this.pendingExpression = null;
  }

  /**
   * Clear all tracked expressions (at block boundaries).
   *
   * Preserves nothing — conservative approach for local CSE.
   * Also resets accumulator state and pending expression since
   * we don't know what path was taken to reach this point.
   */
  protected clearAllExpressions(): void {
    this.availableExpressions.clear();
    this.accState = this.accUnknown();
    this.pendingExpression = null;
  }

  // ═══════════════════════════════════════════════════════════════════
  // Accumulator Tracking
  // ═══════════════════════════════════════════════════════════════════

  /**
   * Update accumulator state based on a LOAD instruction.
   *
   * Called when we encounter LOAD_BYTE or LOAD_IMM to record
   * what value is now in the accumulator.
   *
   * @param instr - The load instruction
   */
  protected updateAccFromLoad(instr: ILInstruction): void {
    if (instr.opcode === ILOpcode.LOAD_BYTE) {
      const slotName = this.getSlotName(instr);
      this.accState = slotName ? this.accFromSlot(slotName) : this.accUnknown();
    } else if (instr.opcode === ILOpcode.LOAD_IMM) {
      const value = this.getImmediateValue(instr);
      this.accState = value !== null ? this.accFromImmediate(value) : this.accUnknown();
    } else {
      // Any other instruction that loads into A makes it unknown
      this.accState = this.accUnknown();
    }

    // Loading a new value clears any pending expression
    // because the accumulator source changed
    this.pendingExpression = null;
  }

  // ═══════════════════════════════════════════════════════════════════
  // Expression Tracking
  // ═══════════════════════════════════════════════════════════════════

  /**
   * Try to form an expression key for a CSE-eligible instruction.
   *
   * Requires a known accumulator source. Returns null if the accumulator
   * state is unknown or the operand can't be extracted.
   *
   * @param instr - CSE-eligible instruction
   * @returns Expression key or null if key can't be formed
   */
  protected tryFormExpressionKey(instr: ILInstruction): ExpressionKey | null {
    // Need known accumulator source to form a key
    if (this.accState.source === null) return null;

    // Extract operand string from instruction
    const operand = this.getOperandString(instr);
    if (operand === null) return null;

    return {
      accSource: this.accState.source,
      opcode: instr.opcode,
      operand,
    };
  }

  /**
   * Look up a previously tracked expression by key.
   *
   * @param key - Expression key to look up
   * @returns Tracked expression or undefined if not available
   */
  protected lookupExpression(key: ExpressionKey): TrackedExpression | undefined {
    const serialized = this.serializeKey(key);
    return this.availableExpressions.get(serialized);
  }

  /**
   * Record a computed expression as available.
   *
   * Called after a STORE_BYTE that saves the result of a pending expression.
   * The expression becomes available for reuse in subsequent code.
   *
   * @param key - The expression key
   * @param resultSlot - Slot where the result was stored
   * @param instructionIndex - Index of the STORE instruction
   */
  protected recordExpression(
    key: ExpressionKey,
    resultSlot: string,
    instructionIndex: number
  ): void {
    const serialized = this.serializeKey(key);
    this.availableExpressions.set(serialized, {
      key,
      resultSlot,
      instructionIndex,
    });
  }

  /**
   * Set the pending expression after a CSE-eligible operation.
   *
   * The pending expression will be recorded if the next instruction
   * is a STORE_BYTE (which saves the result to a known slot).
   *
   * @param key - The expression key from the CSE-eligible operation
   */
  protected setPendingExpression(key: ExpressionKey): void {
    this.pendingExpression = key;
  }

  /**
   * Get and consume the pending expression.
   *
   * Returns the pending expression and clears it.
   *
   * @returns The pending expression or null
   */
  protected consumePendingExpression(): ExpressionKey | null {
    const pending = this.pendingExpression;
    this.pendingExpression = null;
    return pending;
  }

  // ═══════════════════════════════════════════════════════════════════
  // Invalidation
  // ═══════════════════════════════════════════════════════════════════

  /**
   * Invalidate all expressions that reference a given slot.
   *
   * When a slot is written to (STORE_BYTE, INC_BYTE, DEC_BYTE),
   * any expression that uses that slot as:
   * - An accumulator source (accSource)
   * - An operation operand (operand)
   * - A result store (resultSlot)
   * must be invalidated because the value has changed.
   *
   * Also invalidates the accumulator state if it referenced this slot.
   *
   * @param slotName - Name of the slot that was written to
   */
  protected invalidateSlot(slotName: string): void {
    // Remove all expressions that reference this slot
    const toDelete: string[] = [];

    for (const [serialized, tracked] of this.availableExpressions) {
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

    // If pending expression uses this slot, invalidate it
    if (
      this.pendingExpression &&
      (this.pendingExpression.accSource === slotName ||
        this.pendingExpression.operand === slotName)
    ) {
      this.pendingExpression = null;
    }
  }
}
