/**
 * IL Type Guards
 *
 * Type guard functions for safe type narrowing of IL operands
 * and instructions. These enable type-safe pattern matching
 * without explicit casts.
 *
 * @module il/guards
 */

import { SlotLocation } from '../frame/enums.js';
import { ILOpcode } from './enums.js';
import { ILInstruction } from './instruction.js';
import {
  AddressOperand,
  FunctionOperand,
  ILOperand,
  ImmediateOperand,
  LabelOperand,
  SlotOperand,
} from './operands.js';

// ============================================================================
// Operand Type Guards
// ============================================================================

/**
 * Check if operand is a slot reference.
 *
 * @param op - Operand to check
 * @returns true if op is a SlotOperand
 *
 * @example
 * ```typescript
 * if (isSlotOperand(op)) {
 *   // TypeScript knows op is SlotOperand here
 *   console.log(op.slot.name);
 * }
 * ```
 */
export function isSlotOperand(op: ILOperand): op is SlotOperand {
  return op.kind === 'slot';
}

/**
 * Check if operand is an immediate value.
 *
 * @param op - Operand to check
 * @returns true if op is an ImmediateOperand
 *
 * @example
 * ```typescript
 * if (isImmediateOperand(op)) {
 *   console.log(`Immediate value: ${op.value}`);
 * }
 * ```
 */
export function isImmediateOperand(op: ILOperand): op is ImmediateOperand {
  return op.kind === 'immediate';
}

/**
 * Check if operand is a label.
 *
 * @param op - Operand to check
 * @returns true if op is a LabelOperand
 *
 * @example
 * ```typescript
 * if (isLabelOperand(op)) {
 *   console.log(`Jump target: ${op.name}`);
 * }
 * ```
 */
export function isLabelOperand(op: ILOperand): op is LabelOperand {
  return op.kind === 'label';
}

/**
 * Check if operand is a function reference.
 *
 * @param op - Operand to check
 * @returns true if op is a FunctionOperand
 *
 * @example
 * ```typescript
 * if (isFunctionOperand(op)) {
 *   console.log(`Calling: ${op.name}`);
 * }
 * ```
 */
export function isFunctionOperand(op: ILOperand): op is FunctionOperand {
  return op.kind === 'function';
}

/**
 * Check if operand is a raw address.
 *
 * @param op - Operand to check
 * @returns true if op is an AddressOperand
 *
 * @example
 * ```typescript
 * if (isAddressOperand(op)) {
 *   console.log(`Address: $${op.address.toString(16)}`);
 * }
 * ```
 */
export function isAddressOperand(op: ILOperand): op is AddressOperand {
  return op.kind === 'address';
}

// ============================================================================
// Instruction Classification Guards
// ============================================================================

/**
 * Check if instruction accesses zero page.
 *
 * Returns true if any operand is:
 * - A slot in zero page
 * - A raw address in zero page
 *
 * @param instr - Instruction to check
 * @returns true if instruction uses ZP addressing
 *
 * @example
 * ```typescript
 * if (isZeroPageInstruction(instr)) {
 *   // Can use 2-byte ZP addressing mode
 * }
 * ```
 */
export function isZeroPageInstruction(instr: ILInstruction): boolean {
  for (const op of instr.operands) {
    if (isSlotOperand(op) && op.slot.location === SlotLocation.ZeroPage) {
      return true;
    }
    if (isAddressOperand(op) && op.isZeroPage) {
      return true;
    }
  }
  return false;
}

/**
 * Check if instruction is a memory load operation.
 *
 * @param instr - Instruction to check
 * @returns true if instruction loads from memory
 */
export function isLoadInstruction(instr: ILInstruction): boolean {
  return (
    instr.opcode === ILOpcode.LOAD_BYTE ||
    instr.opcode === ILOpcode.LOAD_WORD ||
    instr.opcode === ILOpcode.LOAD_IMM ||
    instr.opcode === ILOpcode.LOAD_IMM_WORD ||
    instr.opcode === ILOpcode.PEEK ||
    instr.opcode === ILOpcode.PEEKW
  );
}

/**
 * Check if instruction is a memory store operation.
 *
 * @param instr - Instruction to check
 * @returns true if instruction stores to memory
 */
export function isStoreInstruction(instr: ILInstruction): boolean {
  return (
    instr.opcode === ILOpcode.STORE_BYTE ||
    instr.opcode === ILOpcode.STORE_WORD ||
    instr.opcode === ILOpcode.POKE ||
    instr.opcode === ILOpcode.POKEW
  );
}

/**
 * Check if instruction is an arithmetic operation.
 *
 * @param instr - Instruction to check
 * @returns true if instruction performs arithmetic
 */
export function isArithmeticInstruction(instr: ILInstruction): boolean {
  return (
    // Byte arithmetic
    instr.opcode === ILOpcode.ADD_BYTE ||
    instr.opcode === ILOpcode.SUB_BYTE ||
    instr.opcode === ILOpcode.ADD_IMM ||
    instr.opcode === ILOpcode.SUB_IMM ||
    instr.opcode === ILOpcode.MUL_BYTE ||
    instr.opcode === ILOpcode.MUL_IMM ||
    instr.opcode === ILOpcode.DIV_BYTE ||
    instr.opcode === ILOpcode.DIV_IMM ||
    instr.opcode === ILOpcode.MOD_BYTE ||
    instr.opcode === ILOpcode.MOD_IMM ||
    instr.opcode === ILOpcode.INC_BYTE ||
    instr.opcode === ILOpcode.DEC_BYTE ||
    // Word (16-bit) arithmetic
    instr.opcode === ILOpcode.ADD_WORD_IMM ||
    instr.opcode === ILOpcode.ADD_WORD_BYTE_IMM ||
    instr.opcode === ILOpcode.ADD_WORD_SLOT ||
    instr.opcode === ILOpcode.ADD_WORD_BYTE_SLOT ||
    instr.opcode === ILOpcode.SUB_WORD_IMM ||
    instr.opcode === ILOpcode.SUB_WORD_BYTE_IMM ||
    instr.opcode === ILOpcode.SUB_WORD_SLOT ||
    instr.opcode === ILOpcode.SUB_WORD_BYTE_SLOT ||
    instr.opcode === ILOpcode.INC_WORD ||
    instr.opcode === ILOpcode.DEC_WORD ||
    instr.opcode === ILOpcode.PROMOTE_BYTE_WORD
  );
}

/**
 * Check if instruction is a bitwise operation.
 *
 * @param instr - Instruction to check
 * @returns true if instruction performs bitwise ops
 */
export function isBitwiseInstruction(instr: ILInstruction): boolean {
  return (
    instr.opcode === ILOpcode.AND_BYTE ||
    instr.opcode === ILOpcode.OR_BYTE ||
    instr.opcode === ILOpcode.XOR_BYTE ||
    instr.opcode === ILOpcode.AND_IMM ||
    instr.opcode === ILOpcode.OR_IMM ||
    instr.opcode === ILOpcode.XOR_IMM ||
    instr.opcode === ILOpcode.NOT_BYTE ||
    instr.opcode === ILOpcode.SHL_BYTE ||
    instr.opcode === ILOpcode.SHR_BYTE
  );
}

/**
 * Check if instruction is a comparison operation.
 *
 * @param instr - Instruction to check
 * @returns true if instruction compares values
 */
export function isComparisonInstruction(instr: ILInstruction): boolean {
  return (
    instr.opcode === ILOpcode.CMP_BYTE ||
    instr.opcode === ILOpcode.CMP_IMM ||
    // Word (16-bit) comparisons
    instr.opcode === ILOpcode.CMP_WORD_IMM ||
    instr.opcode === ILOpcode.CMP_WORD_SLOT
  );
}

/**
 * Check if instruction is a control flow operation.
 *
 * @param instr - Instruction to check
 * @returns true if instruction affects control flow
 */
export function isControlFlowInstruction(instr: ILInstruction): boolean {
  return (
    instr.opcode === ILOpcode.LABEL ||
    instr.opcode === ILOpcode.JUMP ||
    instr.opcode === ILOpcode.JUMP_EQ ||
    instr.opcode === ILOpcode.JUMP_NE ||
    instr.opcode === ILOpcode.JUMP_LT ||
    instr.opcode === ILOpcode.JUMP_LE ||
    instr.opcode === ILOpcode.JUMP_GE ||
    instr.opcode === ILOpcode.JUMP_GT
  );
}

/**
 * Check if instruction is a conditional jump.
 *
 * @param instr - Instruction to check
 * @returns true if instruction is a conditional branch
 */
export function isConditionalJumpInstruction(instr: ILInstruction): boolean {
  return (
    instr.opcode === ILOpcode.JUMP_EQ ||
    instr.opcode === ILOpcode.JUMP_NE ||
    instr.opcode === ILOpcode.JUMP_LT ||
    instr.opcode === ILOpcode.JUMP_LE ||
    instr.opcode === ILOpcode.JUMP_GE ||
    instr.opcode === ILOpcode.JUMP_GT
  );
}

/**
 * Check if instruction is a function call/return operation.
 *
 * @param instr - Instruction to check
 * @returns true if instruction is call or return
 */
export function isFunctionInstruction(instr: ILInstruction): boolean {
  return instr.opcode === ILOpcode.CALL || instr.opcode === ILOpcode.RETURN;
}

/**
 * Check if instruction is a register transfer.
 *
 * @param instr - Instruction to check
 * @returns true if instruction transfers between registers
 */
export function isRegisterTransferInstruction(instr: ILInstruction): boolean {
  return (
    instr.opcode === ILOpcode.TRANSFER_AX ||
    instr.opcode === ILOpcode.TRANSFER_AY ||
    instr.opcode === ILOpcode.TRANSFER_XA ||
    instr.opcode === ILOpcode.TRANSFER_YA
  );
}

/**
 * Check if instruction is a stack operation.
 *
 * @param instr - Instruction to check
 * @returns true if instruction uses stack
 */
export function isStackInstruction(instr: ILInstruction): boolean {
  return instr.opcode === ILOpcode.PUSH_A || instr.opcode === ILOpcode.POP_A;
}

/**
 * Check if instruction is an intrinsic (peek/poke/hi/lo).
 *
 * @param instr - Instruction to check
 * @returns true if instruction is an intrinsic
 */
export function isIntrinsicInstruction(instr: ILInstruction): boolean {
  return (
    instr.opcode === ILOpcode.PEEK ||
    instr.opcode === ILOpcode.POKE ||
    instr.opcode === ILOpcode.PEEKW ||
    instr.opcode === ILOpcode.POKEW ||
    instr.opcode === ILOpcode.HI ||
    instr.opcode === ILOpcode.LO ||
    // Indirect addressing intrinsics (word pointer via ZP)
    instr.opcode === ILOpcode.STORE_ZP_PTR ||
    instr.opcode === ILOpcode.POKE_INDIRECT ||
    instr.opcode === ILOpcode.PEEK_INDIRECT ||
    instr.opcode === ILOpcode.POKEW_INDIRECT ||
    instr.opcode === ILOpcode.PEEKW_INDIRECT ||
    // Block memory operations
    instr.opcode === ILOpcode.MEMCPY
  );
}

/**
 * Check if instruction is a label (pseudo-instruction).
 *
 * @param instr - Instruction to check
 * @returns true if instruction is a label definition
 */
export function isLabelInstruction(instr: ILInstruction): boolean {
  return instr.opcode === ILOpcode.LABEL;
}

/**
 * Check if a LABEL instruction is an inline continuation label.
 *
 * Inline continuation labels are placed after inlined function bodies
 * by the function-inlining pass. They follow the naming pattern
 * `_inline_{calleeName}_{counter}_cont`. These labels are sequencing-only —
 * no code from outside the inlined body jumps to them — so they are NOT
 * real control-flow merge points. Optimization passes (constant-prop,
 * copy-prop) can safely propagate state through these labels.
 *
 * @param instr - Instruction to check (must be a LABEL opcode)
 * @returns true if this is an inline continuation label
 *
 * @example
 * ```typescript
 * if (instr.opcode === ILOpcode.LABEL && isInlineContinuationLabel(instr)) {
 *   // Don't kill propagation state — this is not a real merge point
 * }
 * ```
 */
export function isInlineContinuationLabel(instr: ILInstruction): boolean {
  // Only applies to LABEL instructions
  if (instr.opcode !== ILOpcode.LABEL) return false;
  if (instr.operands.length === 0) return false;

  const op = instr.operands[0];
  if (!isLabelOperand(op)) return false;

  // Inline continuation labels follow the pattern: _inline_{name}_{counter}_cont
  // They start with '_inline_' and end with '_cont'
  return op.name.startsWith('_inline_') && op.name.endsWith('_cont');
}

/**
 * Check if instruction has side effects.
 *
 * Instructions with side effects:
 * - Store to memory
 * - Function calls
 * - Stack operations
 * - Intrinsics (poke)
 *
 * @param instr - Instruction to check
 * @returns true if instruction has side effects
 */
export function hasSideEffects(instr: ILInstruction): boolean {
  return (
    isStoreInstruction(instr) ||
    instr.opcode === ILOpcode.CALL ||
    isStackInstruction(instr) ||
    instr.opcode === ILOpcode.POKE ||
    instr.opcode === ILOpcode.POKEW ||
    // Indirect addressing side effects (write through ZP pointer)
    instr.opcode === ILOpcode.STORE_ZP_PTR ||
    instr.opcode === ILOpcode.POKE_INDIRECT ||
    instr.opcode === ILOpcode.POKEW_INDIRECT ||
    // Block memory operations (reads AND writes memory)
    instr.opcode === ILOpcode.MEMCPY
  );
}
