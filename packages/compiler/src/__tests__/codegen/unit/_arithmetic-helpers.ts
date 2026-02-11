/**
 * Shared Test Helpers for Arithmetic Operations Tests
 *
 * Common utilities used across all arithmetic operation unit tests.
 * Provides testable class, instruction factories, and assertion helpers.
 *
 * @module __tests__/codegen/unit/_arithmetic-helpers
 */

import { ILInstruction, ILOpcode, ILProgram } from '../../../il/index.js';
import { ILOperand } from '../../../il/operands.js';
import { FrameSlot } from '../../../frame/types.js';
import { ArithmeticOpsGenerator } from '../../../codegen/generator/arithmetic.js';
import { AsmILElement } from '../../../codegen/asm-il/types.js';
import { createSlotOp, createImmediateOp } from './_test-helpers.js';

// Re-export common helpers
export {
  createZpSlot,
  createAbsSlot,
  createZpWordSlot,
  createAbsWordSlot,
  createSlotOp,
  createImmediateOp,
  createPromoteByteWordInstr,
  getInstructions,
  getComments,
  findInstruction,
  findAllInstructions,
  countInstructions,
  hasCommentContaining,
  assertInstruction,
} from './_test-helpers.js';

// ============================================================================
// Testable Class for Arithmetic Operations
// ============================================================================

/**
 * Test subclass to expose protected arithmetic operation methods.
 *
 * Extends ArithmeticOpsGenerator to allow testing of:
 * - Individual arithmetic operation handlers (byte and word)
 * - Generated ASM-IL output
 */
export class TestableArithmeticOpsGenerator extends ArithmeticOpsGenerator {
  /**
   * Exposes genAddByte for direct testing.
   */
  public testGenAddByte(instr: ILInstruction): void {
    this.genAddByte(instr);
  }

  /**
   * Exposes genAddImm for direct testing.
   */
  public testGenAddImm(instr: ILInstruction): void {
    this.genAddImm(instr);
  }

  /**
   * Exposes genSubByte for direct testing.
   */
  public testGenSubByte(instr: ILInstruction): void {
    this.genSubByte(instr);
  }

  /**
   * Exposes genSubImm for direct testing.
   */
  public testGenSubImm(instr: ILInstruction): void {
    this.genSubImm(instr);
  }

  /**
   * Exposes genMulByte for direct testing.
   */
  public testGenMulByte(instr: ILInstruction): void {
    this.genMulByte(instr);
  }

  /**
   * Exposes genMulImm for direct testing.
   */
  public testGenMulImm(instr: ILInstruction): void {
    this.genMulImm(instr);
  }

  /**
   * Exposes genDivByte for direct testing.
   */
  public testGenDivByte(instr: ILInstruction): void {
    this.genDivByte(instr);
  }

  /**
   * Exposes genModByte for direct testing.
   */
  public testGenModByte(instr: ILInstruction): void {
    this.genModByte(instr);
  }

  /**
   * Exposes genIncByte for direct testing.
   */
  public testGenIncByte(instr: ILInstruction): void {
    this.genIncByte(instr);
  }

  /**
   * Exposes genDecByte for direct testing.
   */
  public testGenDecByte(instr: ILInstruction): void {
    this.genDecByte(instr);
  }

  // --- Word arithmetic test accessors ---

  /**
   * Exposes genAddWordByteImm for direct testing.
   */
  public testGenAddWordByteImm(instr: ILInstruction): void {
    this.genAddWordByteImm(instr);
  }

  /**
   * Exposes genAddWordImm for direct testing.
   */
  public testGenAddWordImm(instr: ILInstruction): void {
    this.genAddWordImm(instr);
  }

  /**
   * Exposes genAddWordByteSlot for direct testing.
   */
  public testGenAddWordByteSlot(instr: ILInstruction): void {
    this.genAddWordByteSlot(instr);
  }

  /**
   * Exposes genAddWordSlot for direct testing.
   */
  public testGenAddWordSlot(instr: ILInstruction): void {
    this.genAddWordSlot(instr);
  }

  /**
   * Exposes genSubWordByteImm for direct testing.
   */
  public testGenSubWordByteImm(instr: ILInstruction): void {
    this.genSubWordByteImm(instr);
  }

  /**
   * Exposes genSubWordImm for direct testing.
   */
  public testGenSubWordImm(instr: ILInstruction): void {
    this.genSubWordImm(instr);
  }

  /**
   * Exposes genSubWordByteSlot for direct testing.
   */
  public testGenSubWordByteSlot(instr: ILInstruction): void {
    this.genSubWordByteSlot(instr);
  }

  /**
   * Exposes genSubWordSlot for direct testing.
   */
  public testGenSubWordSlot(instr: ILInstruction): void {
    this.genSubWordSlot(instr);
  }

  /**
   * Exposes genIncWord for direct testing.
   */
  public testGenIncWord(instr: ILInstruction): void {
    this.genIncWord(instr);
  }

  /**
   * Exposes genDecWord for direct testing.
   */
  public testGenDecWord(instr: ILInstruction): void {
    this.genDecWord(instr);
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
// Arithmetic IL Instruction Factories
// ============================================================================

/**
 * Creates an ADD_BYTE instruction.
 *
 * @param slot - Slot to add from
 * @returns IL instruction
 */
export function createAddByteInstr(slot: FrameSlot): ILInstruction {
  return {
    opcode: ILOpcode.ADD_BYTE,
    operands: [createSlotOp(slot)] as ILOperand[],
    comment: `Add ${slot.name}`,
  };
}

/**
 * Creates an ADD_IMM instruction.
 *
 * @param value - Immediate value to add
 * @returns IL instruction
 */
export function createAddImmInstr(value: number): ILInstruction {
  return {
    opcode: ILOpcode.ADD_IMM,
    operands: [createImmediateOp(value)] as ILOperand[],
    comment: `Add immediate ${value}`,
  };
}

/**
 * Creates a SUB_BYTE instruction.
 *
 * @param slot - Slot to subtract
 * @returns IL instruction
 */
export function createSubByteInstr(slot: FrameSlot): ILInstruction {
  return {
    opcode: ILOpcode.SUB_BYTE,
    operands: [createSlotOp(slot)] as ILOperand[],
    comment: `Sub ${slot.name}`,
  };
}

/**
 * Creates a SUB_IMM instruction.
 *
 * @param value - Immediate value to subtract
 * @returns IL instruction
 */
export function createSubImmInstr(value: number): ILInstruction {
  return {
    opcode: ILOpcode.SUB_IMM,
    operands: [createImmediateOp(value)] as ILOperand[],
    comment: `Sub immediate ${value}`,
  };
}

/**
 * Creates a MUL_BYTE instruction.
 *
 * @param slot - Slot to multiply with
 * @returns IL instruction
 */
export function createMulByteInstr(slot: FrameSlot): ILInstruction {
  return {
    opcode: ILOpcode.MUL_BYTE,
    operands: [createSlotOp(slot)] as ILOperand[],
    comment: `Mul ${slot.name}`,
  };
}

/**
 * Creates a MUL_IMM instruction.
 *
 * @param value - Immediate value to multiply with
 * @returns IL instruction
 */
export function createMulImmInstr(value: number): ILInstruction {
  return {
    opcode: ILOpcode.MUL_IMM,
    operands: [createImmediateOp(value)] as ILOperand[],
    comment: `Mul immediate ${value}`,
  };
}

/**
 * Creates a DIV_BYTE instruction.
 *
 * @param slot - Slot to divide by
 * @returns IL instruction
 */
export function createDivByteInstr(slot: FrameSlot): ILInstruction {
  return {
    opcode: ILOpcode.DIV_BYTE,
    operands: [createSlotOp(slot)] as ILOperand[],
    comment: `Div ${slot.name}`,
  };
}

/**
 * Creates a MOD_BYTE instruction.
 *
 * @param slot - Slot to mod by
 * @returns IL instruction
 */
export function createModByteInstr(slot: FrameSlot): ILInstruction {
  return {
    opcode: ILOpcode.MOD_BYTE,
    operands: [createSlotOp(slot)] as ILOperand[],
    comment: `Mod ${slot.name}`,
  };
}

/**
 * Creates an INC_BYTE instruction.
 *
 * @param slot - Slot to increment
 * @returns IL instruction
 */
export function createIncByteInstr(slot: FrameSlot): ILInstruction {
  return {
    opcode: ILOpcode.INC_BYTE,
    operands: [createSlotOp(slot)] as ILOperand[],
    comment: `Inc ${slot.name}`,
  };
}

/**
 * Creates a DEC_BYTE instruction.
 *
 * @param slot - Slot to decrement
 * @returns IL instruction
 */
export function createDecByteInstr(slot: FrameSlot): ILInstruction {
  return {
    opcode: ILOpcode.DEC_BYTE,
    operands: [createSlotOp(slot)] as ILOperand[],
    comment: `Dec ${slot.name}`,
  };
}

// ============================================================================
// Word Arithmetic IL Instruction Factories
// ============================================================================

/**
 * Creates an ADD_WORD_BYTE_IMM instruction.
 *
 * @param value - Byte immediate to add to A:X
 * @returns IL instruction
 */
export function createAddWordByteImmInstr(value: number): ILInstruction {
  return {
    opcode: ILOpcode.ADD_WORD_BYTE_IMM,
    operands: [createImmediateOp(value)] as ILOperand[],
    comment: `A:X += ${value} (byte imm)`,
  };
}

/**
 * Creates an ADD_WORD_IMM instruction.
 *
 * @param value - Word immediate to add to A:X
 * @returns IL instruction
 */
export function createAddWordImmInstr(value: number): ILInstruction {
  return {
    opcode: ILOpcode.ADD_WORD_IMM,
    operands: [createImmediateOp(value, true)] as ILOperand[],
    comment: `A:X += ${value} (word imm)`,
  };
}

/**
 * Creates an ADD_WORD_BYTE_SLOT instruction.
 *
 * @param slot - Byte slot to add (zero-extended) to A:X
 * @returns IL instruction
 */
export function createAddWordByteSlotInstr(slot: FrameSlot): ILInstruction {
  return {
    opcode: ILOpcode.ADD_WORD_BYTE_SLOT,
    operands: [createSlotOp(slot)] as ILOperand[],
    comment: `A:X += ${slot.name} (byte slot)`,
  };
}

/**
 * Creates an ADD_WORD_SLOT instruction.
 *
 * @param slot - Word slot to add to A:X
 * @returns IL instruction
 */
export function createAddWordSlotInstr(slot: FrameSlot): ILInstruction {
  return {
    opcode: ILOpcode.ADD_WORD_SLOT,
    operands: [createSlotOp(slot)] as ILOperand[],
    comment: `A:X += ${slot.name} (word slot)`,
  };
}

/**
 * Creates a SUB_WORD_BYTE_IMM instruction.
 *
 * @param value - Byte immediate to subtract from A:X
 * @returns IL instruction
 */
export function createSubWordByteImmInstr(value: number): ILInstruction {
  return {
    opcode: ILOpcode.SUB_WORD_BYTE_IMM,
    operands: [createImmediateOp(value)] as ILOperand[],
    comment: `A:X -= ${value} (byte imm)`,
  };
}

/**
 * Creates a SUB_WORD_IMM instruction.
 *
 * @param value - Word immediate to subtract from A:X
 * @returns IL instruction
 */
export function createSubWordImmInstr(value: number): ILInstruction {
  return {
    opcode: ILOpcode.SUB_WORD_IMM,
    operands: [createImmediateOp(value, true)] as ILOperand[],
    comment: `A:X -= ${value} (word imm)`,
  };
}

/**
 * Creates a SUB_WORD_BYTE_SLOT instruction.
 *
 * @param slot - Byte slot to subtract (zero-extended) from A:X
 * @returns IL instruction
 */
export function createSubWordByteSlotInstr(slot: FrameSlot): ILInstruction {
  return {
    opcode: ILOpcode.SUB_WORD_BYTE_SLOT,
    operands: [createSlotOp(slot)] as ILOperand[],
    comment: `A:X -= ${slot.name} (byte slot)`,
  };
}

/**
 * Creates a SUB_WORD_SLOT instruction.
 *
 * @param slot - Word slot to subtract from A:X
 * @returns IL instruction
 */
export function createSubWordSlotInstr(slot: FrameSlot): ILInstruction {
  return {
    opcode: ILOpcode.SUB_WORD_SLOT,
    operands: [createSlotOp(slot)] as ILOperand[],
    comment: `A:X -= ${slot.name} (word slot)`,
  };
}

/**
 * Creates an INC_WORD instruction.
 *
 * @param slot - Word slot to increment
 * @returns IL instruction
 */
export function createIncWordInstr(slot: FrameSlot): ILInstruction {
  return {
    opcode: ILOpcode.INC_WORD,
    operands: [createSlotOp(slot)] as ILOperand[],
    comment: `Inc word ${slot.name}`,
  };
}

/**
 * Creates a DEC_WORD instruction.
 *
 * @param slot - Word slot to decrement
 * @returns IL instruction
 */
export function createDecWordInstr(slot: FrameSlot): ILInstruction {
  return {
    opcode: ILOpcode.DEC_WORD,
    operands: [createSlotOp(slot)] as ILOperand[],
    comment: `Dec word ${slot.name}`,
  };
}
