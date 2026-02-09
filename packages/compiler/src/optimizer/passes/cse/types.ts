/**
 * CSE Pass Types and Interfaces
 *
 * Defines the data types used by the Common Subexpression Elimination pass.
 * CSE tracks expression computations within basic blocks and eliminates
 * redundant re-computations by reusing previously stored results.
 *
 * **Expression Model for Accumulator-Centric IL:**
 * In the Blend65 IL, most computations follow this pattern:
 * ```
 * LOAD_BYTE x     ; A ← x
 * ADD_BYTE y      ; A ← A + y  (expression: x + y)
 * STORE_BYTE z    ; z ← result
 * ```
 *
 * The CSE "expression" is identified by:
 * - The accumulator source (what was loaded into A)
 * - The operation opcode
 * - The operation operand (slot name or immediate value)
 *
 * @module optimizer/passes/cse/types
 */

import type { ILOpcode } from '../../../il/enums.js';

// ============================================================================
// Expression Key
// ============================================================================

/**
 * Represents the identity of a computed expression.
 *
 * Two expressions are "the same" if they have the same accumulator source,
 * the same opcode, and the same operand. This is the key used to detect
 * common subexpressions.
 *
 * @example
 * ```typescript
 * // LOAD_BYTE x → ADD_BYTE y
 * const key: ExpressionKey = {
 *   accSource: 'x',
 *   opcode: ILOpcode.ADD_BYTE,
 *   operand: 'y',
 * };
 * ```
 */
export interface ExpressionKey {
  /** What was loaded into the accumulator before the operation */
  readonly accSource: string;

  /** The operation opcode (ADD_BYTE, SUB_BYTE, AND_BYTE, etc.) */
  readonly opcode: ILOpcode;

  /** The operand: slot name for _BYTE ops, or stringified value for _IMM ops */
  readonly operand: string;
}

// ============================================================================
// Tracked Expression
// ============================================================================

/**
 * A previously computed expression whose result is stored in a known slot.
 *
 * When CSE detects a duplicate computation, it replaces the LOAD+OP sequence
 * with a single LOAD_BYTE from the result slot.
 *
 * @example
 * ```typescript
 * // After: LOAD_BYTE x → ADD_BYTE y → STORE_BYTE z
 * const tracked: TrackedExpression = {
 *   key: { accSource: 'x', opcode: ILOpcode.ADD_BYTE, operand: 'y' },
 *   resultSlot: 'z',
 *   instructionIndex: 2, // index of STORE_BYTE
 * };
 * ```
 */
export interface TrackedExpression {
  /** The expression identity */
  readonly key: ExpressionKey;

  /** Slot where the result was stored */
  readonly resultSlot: string;

  /** Index of the STORE instruction that saved the result */
  readonly instructionIndex: number;
}

// ============================================================================
// Accumulator State
// ============================================================================

/**
 * Tracks what is currently in the accumulator.
 *
 * The accumulator source is used as part of the expression key.
 * It's set by LOAD_BYTE/LOAD_IMM and cleared by operations that
 * make the accumulator value unknown.
 *
 * @example
 * ```typescript
 * // After LOAD_BYTE x:
 * const state: AccumulatorState = { source: 'x', kind: 'slot' };
 *
 * // After LOAD_IMM 42:
 * const state: AccumulatorState = { source: '42', kind: 'immediate' };
 *
 * // After unknown operation:
 * const state: AccumulatorState = { source: null, kind: 'unknown' };
 * ```
 */
export interface AccumulatorState {
  /** String identifier for the accumulator source (slot name or immediate value) */
  readonly source: string | null;

  /** Kind of accumulator source */
  readonly kind: 'slot' | 'immediate' | 'unknown';
}

// ============================================================================
// CSE Statistics
// ============================================================================

/**
 * Statistics collected during CSE pass execution.
 *
 * Used for pass result reporting and debug output.
 */
export interface CSEStats {
  /** Number of expressions eliminated (replaced with loads) */
  expressionsEliminated: number;

  /** Number of instructions removed (LOAD+OP replaced with single LOAD) */
  instructionsRemoved: number;

  /** Debug messages collected during the pass */
  debugInfo: string[];
}
