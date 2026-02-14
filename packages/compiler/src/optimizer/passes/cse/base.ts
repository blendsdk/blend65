/**
 * CSE Base Class — Core Utilities
 *
 * Foundation layer for the CSE pass providing:
 * - Instruction classification (CSE-eligible opcodes, block boundaries)
 * - Slot name and operand extraction from IL instructions
 * - Expression key serialization for map lookups
 *
 * **Inheritance Chain:**
 * ```
 * CSEBase (this file) → CSETracker → CSEPass
 * ```
 *
 * @module optimizer/passes/cse/base
 */

import { ILOpcode } from '../../../il/enums.js';
import type { ILInstruction } from '../../../il/instruction.js';
import { isSlotOperand, isImmediateOperand } from '../../../il/guards.js';
import type { ExpressionKey, AccumulatorState } from './types.js';

// ============================================================================
// CSE-Eligible Opcodes
// ============================================================================

/**
 * Set of opcodes that are eligible for CSE.
 *
 * These are binary/unary operations that compute a value in the accumulator
 * from a known accumulator source plus an operand. The expression identity
 * is: accSource + opcode + operand.
 *
 * **Slot-based operations** (operand is a slot name):
 * ADD_BYTE, SUB_BYTE, MUL_BYTE, DIV_BYTE, MOD_BYTE,
 * AND_BYTE, OR_BYTE, XOR_BYTE
 *
 * **Immediate operations** (operand is a constant value):
 * ADD_IMM, SUB_IMM, MUL_IMM, AND_IMM, OR_IMM, XOR_IMM,
 * SHL_BYTE, SHR_BYTE
 */
const CSE_ELIGIBLE_OPCODES = new Set<ILOpcode>([
  // Slot-based arithmetic
  ILOpcode.ADD_BYTE,
  ILOpcode.SUB_BYTE,
  ILOpcode.MUL_BYTE,
  ILOpcode.DIV_BYTE,
  ILOpcode.MOD_BYTE,

  // Slot-based bitwise
  ILOpcode.AND_BYTE,
  ILOpcode.OR_BYTE,
  ILOpcode.XOR_BYTE,

  // Immediate arithmetic
  ILOpcode.ADD_IMM,
  ILOpcode.SUB_IMM,
  ILOpcode.MUL_IMM,

  // Immediate bitwise
  ILOpcode.AND_IMM,
  ILOpcode.OR_IMM,
  ILOpcode.XOR_IMM,

  // Shift operations (immediate count)
  ILOpcode.SHL_BYTE,
  ILOpcode.SHR_BYTE,
]);

/**
 * Opcodes that use a slot operand (vs immediate operand).
 *
 * Used to determine how to extract the operand string from the instruction.
 */
const SLOT_OPERAND_OPCODES = new Set<ILOpcode>([
  ILOpcode.ADD_BYTE,
  ILOpcode.SUB_BYTE,
  ILOpcode.MUL_BYTE,
  ILOpcode.DIV_BYTE,
  ILOpcode.MOD_BYTE,
  ILOpcode.AND_BYTE,
  ILOpcode.OR_BYTE,
  ILOpcode.XOR_BYTE,
]);

// ============================================================================
// CSE Base Class
// ============================================================================

/**
 * Base class for CSE pass — provides core utility methods.
 *
 * This foundation layer handles:
 * - Classifying instructions as CSE-eligible, block boundaries, or writes
 * - Extracting slot names and operand values from IL instructions
 * - Serializing expression keys to strings for Map lookups
 * - Creating and managing accumulator state
 *
 * @example
 * ```typescript
 * // Used internally by CSETracker and CSEPass
 * const isEligible = this.isCSEEligible(instr);
 * const slotName = this.getSlotName(instr);
 * const keyStr = this.serializeKey(key);
 * ```
 */
export class CSEBase {
  // ═══════════════════════════════════════════════════════════════════
  // Instruction Classification
  // ═══════════════════════════════════════════════════════════════════

  /**
   * Check if an instruction is eligible for CSE.
   *
   * CSE-eligible instructions are binary operations that compute a value
   * from the accumulator plus an operand (slot or immediate).
   *
   * @param instr - Instruction to check
   * @returns true if the instruction can participate in CSE
   */
  protected isCSEEligible(instr: ILInstruction): boolean {
    return CSE_ELIGIBLE_OPCODES.has(instr.opcode);
  }

  /**
   * Check if an instruction is a basic block boundary.
   *
   * Block boundaries terminate the current basic block, requiring
   * all tracked expressions to be cleared (conservative approach).
   * Boundaries include labels (merge points), jumps (diverge points),
   * and calls (callee may modify any slot).
   *
   * @param instr - Instruction to check
   * @returns true if this instruction is a block boundary
   */
  protected isBlockBoundary(instr: ILInstruction): boolean {
    const opcode = instr.opcode;

    // Labels are control flow merge points
    if (opcode === ILOpcode.LABEL) return true;

    // All jumps diverge control flow
    if (
      opcode === ILOpcode.JUMP ||
      opcode === ILOpcode.JUMP_EQ ||
      opcode === ILOpcode.JUMP_NE ||
      opcode === ILOpcode.JUMP_LT ||
      opcode === ILOpcode.JUMP_LE ||
      opcode === ILOpcode.JUMP_GE ||
      opcode === ILOpcode.JUMP_GT
    ) {
      return true;
    }

    // Calls may modify any slot (callee could write to memory)
    if (opcode === ILOpcode.CALL) return true;

    // Return terminates the block
    if (opcode === ILOpcode.RETURN) return true;

    return false;
  }

  /**
   * Check if an instruction writes to a slot (modifying its value).
   *
   * Used for invalidation — when a slot is written, all expressions
   * using that slot as input OR storing their result in that slot
   * become invalid.
   *
   * @param instr - Instruction to check
   * @returns true if the instruction writes to a slot
   */
  protected isSlotWrite(instr: ILInstruction): boolean {
    return (
      instr.opcode === ILOpcode.STORE_BYTE ||
      instr.opcode === ILOpcode.STORE_WORD ||
      // Byte and word INC/DEC both modify their slot in place
      instr.opcode === ILOpcode.INC_BYTE ||
      instr.opcode === ILOpcode.DEC_BYTE ||
      instr.opcode === ILOpcode.INC_WORD ||
      instr.opcode === ILOpcode.DEC_WORD
    );
  }

  // ═══════════════════════════════════════════════════════════════════
  // Operand Extraction
  // ═══════════════════════════════════════════════════════════════════

  /**
   * Extract slot name from the first operand of an instruction.
   *
   * @param instr - Instruction with a slot operand
   * @returns Slot name or null if first operand is not a slot
   */
  protected getSlotName(instr: ILInstruction): string | null {
    if (instr.operands.length === 0) return null;
    const op = instr.operands[0];
    return isSlotOperand(op) ? op.slot.name : null;
  }

  /**
   * Extract immediate value from the first operand of an instruction.
   *
   * @param instr - Instruction with an immediate operand
   * @returns Value or null if first operand is not an immediate
   */
  protected getImmediateValue(instr: ILInstruction): number | null {
    if (instr.operands.length === 0) return null;
    const op = instr.operands[0];
    return isImmediateOperand(op) ? op.value : null;
  }

  /**
   * Get the operand string for CSE key construction.
   *
   * For slot-based operations, returns the slot name.
   * For immediate-based operations, returns the stringified value.
   *
   * @param instr - CSE-eligible instruction
   * @returns Operand string or null if operand can't be extracted
   */
  protected getOperandString(instr: ILInstruction): string | null {
    if (instr.operands.length === 0) return null;
    const op = instr.operands[0];

    // Slot-based operations: use slot name
    if (SLOT_OPERAND_OPCODES.has(instr.opcode)) {
      return isSlotOperand(op) ? op.slot.name : null;
    }

    // Immediate-based operations: use stringified value
    return isImmediateOperand(op) ? String(op.value) : null;
  }

  // ═══════════════════════════════════════════════════════════════════
  // Expression Key Utilities
  // ═══════════════════════════════════════════════════════════════════

  /**
   * Serialize an expression key to a string for Map lookups.
   *
   * Format: `{accSource}:{opcode}:{operand}`
   *
   * @param key - Expression key to serialize
   * @returns String representation suitable for Map keys
   *
   * @example
   * ```typescript
   * const str = this.serializeKey({
   *   accSource: 'x',
   *   opcode: ILOpcode.ADD_BYTE,
   *   operand: 'y',
   * });
   * // Returns: 'x:ADD_BYTE:y'
   * ```
   */
  protected serializeKey(key: ExpressionKey): string {
    return `${key.accSource}:${key.opcode}:${key.operand}`;
  }

  // ═══════════════════════════════════════════════════════════════════
  // Accumulator State
  // ═══════════════════════════════════════════════════════════════════

  /**
   * Create an accumulator state from a LOAD_BYTE instruction.
   *
   * @param slotName - Name of the slot loaded into accumulator
   * @returns AccumulatorState with the slot source
   */
  protected accFromSlot(slotName: string): AccumulatorState {
    return { source: slotName, kind: 'slot' };
  }

  /**
   * Create an accumulator state from a LOAD_IMM instruction.
   *
   * @param value - Immediate value loaded into accumulator
   * @returns AccumulatorState with the immediate source
   */
  protected accFromImmediate(value: number): AccumulatorState {
    return { source: String(value), kind: 'immediate' };
  }

  /**
   * Create an unknown accumulator state.
   *
   * Used when the accumulator value can't be determined
   * (after operations that transform A in unpredictable ways).
   *
   * @returns AccumulatorState with unknown source
   */
  protected accUnknown(): AccumulatorState {
    return { source: null, kind: 'unknown' };
  }
}
