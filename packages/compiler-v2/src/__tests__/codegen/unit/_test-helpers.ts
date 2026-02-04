/**
 * Shared Test Helpers for Memory Operations Tests
 *
 * Common utilities used across all memory operation unit tests.
 * Provides factory functions, test data creators, and assertion helpers.
 *
 * @module __tests__/codegen/unit/_test-helpers
 */

import { ILInstruction, ILOpcode } from '../../../il/index.js';
import { AddressingModeHint } from '../../../il/enums.js';
import {
  ILOperand,
  SlotOperand,
  ImmediateOperand,
} from '../../../il/operands.js';
import { createFrameSlot, FrameSlot } from '../../../frame/types.js';
import { SlotKind, SlotLocation } from '../../../frame/enums.js';
import { BUILTIN_TYPES } from '../../../semantic/types.js';
import { MemoryOpsGenerator } from '../../../codegen/generator/memory.js';
import { ILProgram } from '../../../il/index.js';
import {
  AsmILElement,
  AsmAddressingMode,
  isInstructionElement,
  isCommentElement,
} from '../../../codegen/asm-il/types.js';

// ============================================================================
// Testable Class for Protected Method Access
// ============================================================================

/**
 * Test subclass to expose protected methods and internal state.
 *
 * Extends MemoryOpsGenerator to allow testing of:
 * - Individual memory operation handlers
 * - Accumulator state tracking
 * - Generated ASM-IL output
 */
export class TestableMemoryOpsGenerator extends MemoryOpsGenerator {
  /**
   * Exposes genLoadByte for direct testing.
   */
  public testGenLoadByte(instr: ILInstruction): void {
    this.genLoadByte(instr);
  }

  /**
   * Exposes genStoreByte for direct testing.
   */
  public testGenStoreByte(instr: ILInstruction): void {
    this.genStoreByte(instr);
  }

  /**
   * Exposes genLoadWord for direct testing.
   */
  public testGenLoadWord(instr: ILInstruction): void {
    this.genLoadWord(instr);
  }

  /**
   * Exposes genStoreWord for direct testing.
   */
  public testGenStoreWord(instr: ILInstruction): void {
    this.genStoreWord(instr);
  }

  /**
   * Exposes genLoadImm for direct testing.
   */
  public testGenLoadImm(instr: ILInstruction): void {
    this.genLoadImm(instr);
  }

  /**
   * Exposes genLoadImmWord for direct testing.
   */
  public testGenLoadImmWord(instr: ILInstruction): void {
    this.genLoadImmWord(instr);
  }

  /**
   * Gets the generated ASM-IL elements for inspection.
   */
  public getElements(): AsmILElement[] {
    return this.asm.getAllElements();
  }

  /**
   * Manually sets the accumulator state for testing.
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
   * Checks if A has the specified immediate value.
   */
  public testAHasImmediate(value: number): boolean {
    return this.aHasImmediate(value);
  }

  /**
   * Override to not throw on unhandled opcodes during testing.
   */
  public generate(_program: ILProgram): never {
    throw new Error('Not implemented for testing');
  }
}

// ============================================================================
// Frame Slot Factories
// ============================================================================

/**
 * Creates a zero page slot for testing.
 *
 * @param name - Slot name
 * @param address - ZP address (0x00-0xFF)
 * @returns FrameSlot configured for zero page
 */
export function createZpSlot(name: string, address: number): FrameSlot {
  return createFrameSlot(name, SlotKind.Local, BUILTIN_TYPES.BYTE, {
    location: SlotLocation.ZeroPage,
    address,
  });
}

/**
 * Creates an absolute (frame region) slot for testing.
 *
 * @param name - Slot name
 * @param address - Absolute address (typically 0x0200+)
 * @returns FrameSlot configured for frame region
 */
export function createAbsSlot(name: string, address: number): FrameSlot {
  return createFrameSlot(name, SlotKind.Local, BUILTIN_TYPES.BYTE, {
    location: SlotLocation.FrameRegion,
    address,
  });
}

/**
 * Creates a word slot in zero page for testing.
 *
 * @param name - Slot name
 * @param address - ZP address
 * @returns FrameSlot configured for word in zero page
 */
export function createZpWordSlot(name: string, address: number): FrameSlot {
  return createFrameSlot(name, SlotKind.Local, BUILTIN_TYPES.WORD, {
    location: SlotLocation.ZeroPage,
    address,
  });
}

/**
 * Creates a word slot in frame region for testing.
 *
 * @param name - Slot name
 * @param address - Absolute address
 * @returns FrameSlot configured for word in frame region
 */
export function createAbsWordSlot(name: string, address: number): FrameSlot {
  return createFrameSlot(name, SlotKind.Local, BUILTIN_TYPES.WORD, {
    location: SlotLocation.FrameRegion,
    address,
  });
}

// ============================================================================
// Operand Factories
// ============================================================================

/**
 * Creates a slot operand for testing.
 *
 * @param slot - Frame slot to wrap
 * @param hint - Addressing mode hint (auto-detected if not provided)
 * @returns SlotOperand
 */
export function createSlotOp(
  slot: FrameSlot,
  hint?: AddressingModeHint
): SlotOperand {
  const autoHint =
    slot.location === SlotLocation.ZeroPage
      ? AddressingModeHint.ZeroPage
      : AddressingModeHint.Absolute;

  return {
    kind: 'slot',
    slot,
    addressingHint: hint ?? autoHint,
  };
}

/**
 * Creates an immediate operand for testing.
 *
 * @param value - Immediate value
 * @param isWord - Whether this is a 16-bit value
 * @returns ImmediateOperand
 */
export function createImmediateOp(
  value: number,
  isWord: boolean = false
): ImmediateOperand {
  return {
    kind: 'immediate',
    value,
    isWord,
  };
}

// ============================================================================
// IL Instruction Factories
// ============================================================================

/**
 * Creates a LOAD_BYTE instruction.
 *
 * @param slot - Slot to load from
 * @returns IL instruction
 */
export function createLoadByteInstr(slot: FrameSlot): ILInstruction {
  return {
    opcode: ILOpcode.LOAD_BYTE,
    operands: [createSlotOp(slot)] as ILOperand[],
    comment: `Load ${slot.name}`,
  };
}

/**
 * Creates a STORE_BYTE instruction.
 *
 * @param slot - Slot to store to
 * @returns IL instruction
 */
export function createStoreByteInstr(slot: FrameSlot): ILInstruction {
  return {
    opcode: ILOpcode.STORE_BYTE,
    operands: [createSlotOp(slot)] as ILOperand[],
    comment: `Store to ${slot.name}`,
  };
}

/**
 * Creates a LOAD_WORD instruction.
 *
 * @param slot - Word slot to load from
 * @returns IL instruction
 */
export function createLoadWordInstr(slot: FrameSlot): ILInstruction {
  return {
    opcode: ILOpcode.LOAD_WORD,
    operands: [createSlotOp(slot)] as ILOperand[],
    comment: `Load word ${slot.name}`,
  };
}

/**
 * Creates a STORE_WORD instruction.
 *
 * @param slot - Word slot to store to
 * @returns IL instruction
 */
export function createStoreWordInstr(slot: FrameSlot): ILInstruction {
  return {
    opcode: ILOpcode.STORE_WORD,
    operands: [createSlotOp(slot)] as ILOperand[],
    comment: `Store word to ${slot.name}`,
  };
}

/**
 * Creates a LOAD_IMM instruction.
 *
 * @param value - Immediate value to load
 * @returns IL instruction
 */
export function createLoadImmInstr(value: number): ILInstruction {
  return {
    opcode: ILOpcode.LOAD_IMM,
    operands: [createImmediateOp(value)] as ILOperand[],
    comment: `Load immediate ${value}`,
  };
}

/**
 * Creates a LOAD_IMM_WORD instruction.
 *
 * @param value - 16-bit immediate value to load
 * @returns IL instruction
 */
export function createLoadImmWordInstr(value: number): ILInstruction {
  return {
    opcode: ILOpcode.LOAD_IMM_WORD,
    operands: [createImmediateOp(value, true)] as ILOperand[],
    comment: `Load immediate word ${value}`,
  };
}

// ============================================================================
// Assertion Helpers
// ============================================================================

/**
 * Gets all instruction elements from the generated output.
 *
 * @param elements - All ASM-IL elements
 * @returns Only instruction elements
 */
export function getInstructions(elements: AsmILElement[]): AsmILElement[] {
  return elements.filter(isInstructionElement);
}

/**
 * Gets all comment elements from the generated output.
 *
 * @param elements - All ASM-IL elements
 * @returns Only comment elements
 */
export function getComments(elements: AsmILElement[]): AsmILElement[] {
  return elements.filter(isCommentElement);
}

/**
 * Finds an instruction by mnemonic.
 *
 * @param elements - All ASM-IL elements
 * @param mnemonic - Mnemonic to find (e.g., 'LDA', 'STA')
 * @returns First matching instruction or undefined
 */
export function findInstruction(
  elements: AsmILElement[],
  mnemonic: string
): AsmILElement | undefined {
  return elements.find(
    (e) => isInstructionElement(e) && e.instruction.mnemonic === mnemonic
  );
}

/**
 * Finds all instructions by mnemonic.
 *
 * @param elements - All ASM-IL elements
 * @param mnemonic - Mnemonic to find
 * @returns All matching instructions
 */
export function findAllInstructions(
  elements: AsmILElement[],
  mnemonic: string
): AsmILElement[] {
  return elements.filter(
    (e) => isInstructionElement(e) && e.instruction.mnemonic === mnemonic
  );
}

/**
 * Asserts that an instruction exists with the expected properties.
 *
 * @param elements - All ASM-IL elements
 * @param mnemonic - Expected mnemonic
 * @param mode - Expected addressing mode
 * @param operand - Expected operand value (optional)
 */
export function assertInstruction(
  elements: AsmILElement[],
  mnemonic: string,
  mode: AsmAddressingMode,
  operand?: number
): void {
  const instr = findInstruction(elements, mnemonic);
  if (!instr || !isInstructionElement(instr)) {
    throw new Error(`Expected to find ${mnemonic} instruction`);
  }
  if (instr.instruction.mode !== mode) {
    throw new Error(
      `Expected ${mnemonic} mode to be ${mode}, got ${instr.instruction.mode}`
    );
  }
  if (operand !== undefined && instr.instruction.operand !== operand) {
    throw new Error(
      `Expected ${mnemonic} operand to be ${operand}, got ${instr.instruction.operand}`
    );
  }
}

/**
 * Counts instructions with a specific mnemonic.
 *
 * @param elements - All ASM-IL elements
 * @param mnemonic - Mnemonic to count
 * @returns Count of matching instructions
 */
export function countInstructions(
  elements: AsmILElement[],
  mnemonic: string
): number {
  return findAllInstructions(elements, mnemonic).length;
}

/**
 * Checks if the output contains a comment with specific text.
 *
 * @param elements - All ASM-IL elements
 * @param text - Text to search for
 * @returns true if comment containing text is found
 */
export function hasCommentContaining(
  elements: AsmILElement[],
  text: string
): boolean {
  return elements.some(
    (e) => isCommentElement(e) && e.comment.text.includes(text)
  );
}