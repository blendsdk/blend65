/**
 * Shared Test Helpers for Bitwise Operations Tests
 *
 * Common utilities used across all bitwise operation unit tests.
 * Provides testable class, instruction factories, and assertion helpers.
 *
 * @module __tests__/codegen/unit/_bitwise-helpers
 */

import { ILInstruction, ILOpcode, ILProgram } from '../../../il/index.js';
import { ILOperand } from '../../../il/operands.js';
import { FrameSlot } from '../../../frame/types.js';
import { BitwiseOpsGenerator } from '../../../codegen/generator/bitwise.js';
import { AsmILElement } from '../../../codegen/asm-il/types.js';
import { createSlotOp, createImmediateOp } from './_test-helpers.js';

// Re-export common helpers
export {
  createZpSlot,
  createAbsSlot,
  createSlotOp,
  createImmediateOp,
  getInstructions,
  getComments,
  findInstruction,
  findAllInstructions,
  countInstructions,
  hasCommentContaining,
  assertInstruction,
} from './_test-helpers.js';

// ============================================================================
// Testable Class for Bitwise Operations
// ============================================================================

/**
 * Test subclass to expose protected bitwise operation methods.
 *
 * Extends BitwiseOpsGenerator to allow testing of:
 * - Individual bitwise operation handlers
 * - Generated ASM-IL output
 */
export class TestableBitwiseOpsGenerator extends BitwiseOpsGenerator {
  /**
   * Exposes genAndByte for direct testing.
   */
  public testGenAndByte(instr: ILInstruction): void {
    this.genAndByte(instr);
  }

  /**
   * Exposes genAndImm for direct testing.
   */
  public testGenAndImm(instr: ILInstruction): void {
    this.genAndImm(instr);
  }

  /**
   * Exposes genOrByte for direct testing.
   */
  public testGenOrByte(instr: ILInstruction): void {
    this.genOrByte(instr);
  }

  /**
   * Exposes genOrImm for direct testing.
   */
  public testGenOrImm(instr: ILInstruction): void {
    this.genOrImm(instr);
  }

  /**
   * Exposes genXorByte for direct testing.
   */
  public testGenXorByte(instr: ILInstruction): void {
    this.genXorByte(instr);
  }

  /**
   * Exposes genXorImm for direct testing.
   */
  public testGenXorImm(instr: ILInstruction): void {
    this.genXorImm(instr);
  }

  /**
   * Exposes genNotByte for direct testing.
   */
  public testGenNotByte(instr: ILInstruction): void {
    this.genNotByte(instr);
  }

  /**
   * Exposes genShlByte for direct testing.
   */
  public testGenShlByte(instr: ILInstruction): void {
    this.genShlByte(instr);
  }

  /**
   * Exposes genShrByte for direct testing.
   */
  public testGenShrByte(instr: ILInstruction): void {
    this.genShrByte(instr);
  }

  /**
   * Exposes genShrWord for direct testing.
   */
  public testGenShrWord(instr: ILInstruction): void {
    this.genShrWord(instr);
  }

  /**
   * Exposes genShrWordLo for direct testing.
   */
  public testGenShrWordLo(instr: ILInstruction): void {
    this.genShrWordLo(instr);
  }

  /**
   * Gets the generated ASM-IL elements for inspection.
   */
  public getElements(): AsmILElement[] {
    return this.asm.getAllElements();
  }

  /**
   * Manually sets the accumulator state from slot for testing.
   */
  public testSetAFromSlot(address: number): void {
    this.setAFromSlot(address);
  }

  /**
   * Manually sets the accumulator state from immediate for testing.
   */
  public testSetAFromImmediate(value: number): void {
    this.setAFromImmediate(value);
  }

  /**
   * Manually invalidates accumulator state for testing.
   */
  public testInvalidateA(): void {
    this.invalidateA();
  }

  /**
   * Checks if A has the specified slot address.
   */
  public testAHasSlot(address: number): boolean {
    return this.aHasSlot(address);
  }

  /**
   * Override to not throw on unhandled opcodes during testing.
   */
  public generate(_program: ILProgram): never {
    throw new Error('Not implemented for testing');
  }
}

// ============================================================================
// Bitwise IL Instruction Factories
// ============================================================================

/**
 * Creates an AND_BYTE instruction.
 *
 * @param slot - Slot to AND with
 * @returns IL instruction
 */
export function createAndByteInstr(slot: FrameSlot): ILInstruction {
  return {
    opcode: ILOpcode.AND_BYTE,
    operands: [createSlotOp(slot)] as ILOperand[],
    comment: `AND ${slot.name}`,
  };
}

/**
 * Creates an AND_IMM instruction.
 *
 * @param value - Immediate value to AND with
 * @returns IL instruction
 */
export function createAndImmInstr(value: number): ILInstruction {
  return {
    opcode: ILOpcode.AND_IMM,
    operands: [createImmediateOp(value)] as ILOperand[],
    comment: `AND immediate ${value}`,
  };
}

/**
 * Creates an OR_BYTE instruction.
 *
 * @param slot - Slot to OR with
 * @returns IL instruction
 */
export function createOrByteInstr(slot: FrameSlot): ILInstruction {
  return {
    opcode: ILOpcode.OR_BYTE,
    operands: [createSlotOp(slot)] as ILOperand[],
    comment: `OR ${slot.name}`,
  };
}

/**
 * Creates an OR_IMM instruction.
 *
 * @param value - Immediate value to OR with
 * @returns IL instruction
 */
export function createOrImmInstr(value: number): ILInstruction {
  return {
    opcode: ILOpcode.OR_IMM,
    operands: [createImmediateOp(value)] as ILOperand[],
    comment: `OR immediate ${value}`,
  };
}

/**
 * Creates a XOR_BYTE instruction.
 *
 * @param slot - Slot to XOR with
 * @returns IL instruction
 */
export function createXorByteInstr(slot: FrameSlot): ILInstruction {
  return {
    opcode: ILOpcode.XOR_BYTE,
    operands: [createSlotOp(slot)] as ILOperand[],
    comment: `XOR ${slot.name}`,
  };
}

/**
 * Creates a XOR_IMM instruction.
 *
 * @param value - Immediate value to XOR with
 * @returns IL instruction
 */
export function createXorImmInstr(value: number): ILInstruction {
  return {
    opcode: ILOpcode.XOR_IMM,
    operands: [createImmediateOp(value)] as ILOperand[],
    comment: `XOR immediate ${value}`,
  };
}

/**
 * Creates a NOT_BYTE instruction.
 *
 * @returns IL instruction
 */
export function createNotByteInstr(): ILInstruction {
  return {
    opcode: ILOpcode.NOT_BYTE,
    operands: [] as ILOperand[],
    comment: 'Bitwise NOT',
  };
}

/**
 * Creates a SHL_BYTE instruction.
 *
 * @param count - Number of positions to shift left
 * @returns IL instruction
 */
export function createShlByteInstr(count: number): ILInstruction {
  return {
    opcode: ILOpcode.SHL_BYTE,
    operands: [createImmediateOp(count)] as ILOperand[],
    comment: `Shift left ${count}`,
  };
}

/**
 * Creates a SHR_BYTE instruction.
 *
 * @param count - Number of positions to shift right
 * @returns IL instruction
 */
export function createShrByteInstr(count: number): ILInstruction {
  return {
    opcode: ILOpcode.SHR_BYTE,
    operands: [createImmediateOp(count)] as ILOperand[],
    comment: `Shift right ${count}`,
  };
}

/**
 * Creates a SHR_WORD instruction (16-bit logical shift right).
 *
 * @param count - Number of positions to shift right
 * @returns IL instruction
 */
export function createShrWordInstr(count: number): ILInstruction {
  return {
    opcode: ILOpcode.SHR_WORD,
    operands: [createImmediateOp(count)] as ILOperand[],
    comment: `Shift right word ${count}`,
  };
}

/**
 * Creates a SHR_WORD_LO instruction (optimized lo(word >> N) for N=3-7).
 *
 * Uses the shift-left technique: lo(word >> N) = hi(word << (8-N)).
 *
 * @param count - Shift count (typically 3-7)
 * @returns IL instruction
 */
export function createShrWordLoInstr(count: number): ILInstruction {
  return {
    opcode: ILOpcode.SHR_WORD_LO,
    operands: [createImmediateOp(count)] as ILOperand[],
    comment: `SHR_WORD_LO ${count} (shift-left technique)`,
  };
}
