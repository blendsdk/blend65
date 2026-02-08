/**
 * Shared Test Helpers for Control Flow Operations Tests
 *
 * Common utilities used across all control flow operation unit tests.
 * Provides testable class, instruction factories, and assertion helpers.
 *
 * @module __tests__/codegen/unit/_control-flow-helpers
 */

import { ILInstruction, ILOpcode } from '../../../il/index.js';
import { ILOperand, LabelOperand } from '../../../il/operands.js';
import { ControlFlowOpsGenerator } from '../../../codegen/generator/control.js';
import { AsmILElement, AsmILProgram, isLabelElement } from '../../../codegen/asm-il/types.js';
import { ILProgram } from '../../../il/index.js';

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
// Testable Class for Control Flow Operations
// ============================================================================

/**
 * Test subclass to expose protected control flow operation methods.
 *
 * Extends ControlFlowOpsGenerator to allow testing of:
 * - Individual control flow operation handlers
 * - Generated ASM-IL output
 */
export class TestableControlFlowOpsGenerator extends ControlFlowOpsGenerator {
  /**
   * Exposes genLabel for direct testing.
   */
  public testGenLabel(instr: ILInstruction): void {
    this.genLabel(instr);
  }

  /**
   * Exposes genJump for direct testing.
   */
  public testGenJump(instr: ILInstruction): void {
    this.genJump(instr);
  }

  /**
   * Exposes genJumpEq for direct testing.
   */
  public testGenJumpEq(instr: ILInstruction): void {
    this.genJumpEq(instr);
  }

  /**
   * Exposes genJumpNe for direct testing.
   */
  public testGenJumpNe(instr: ILInstruction): void {
    this.genJumpNe(instr);
  }

  /**
   * Exposes genJumpLt for direct testing.
   */
  public testGenJumpLt(instr: ILInstruction): void {
    this.genJumpLt(instr);
  }

  /**
   * Exposes genJumpLe for direct testing.
   */
  public testGenJumpLe(instr: ILInstruction): void {
    this.genJumpLe(instr);
  }

  /**
   * Exposes genJumpGe for direct testing.
   */
  public testGenJumpGe(instr: ILInstruction): void {
    this.genJumpGe(instr);
  }

  /**
   * Exposes genJumpGt for direct testing.
   */
  public testGenJumpGt(instr: ILInstruction): void {
    this.genJumpGt(instr);
  }

  /**
   * Exposes genNop for direct testing.
   */
  public testGenNop(instr: ILInstruction): void {
    this.genNop(instr);
  }

  /**
   * Exposes genPushA for direct testing.
   */
  public testGenPushA(instr: ILInstruction): void {
    this.genPushA(instr);
  }

  /**
   * Exposes genPopA for direct testing.
   */
  public testGenPopA(instr: ILInstruction): void {
    this.genPopA(instr);
  }

  /**
   * Exposes genTransferAX for direct testing.
   */
  public testGenTransferAX(instr: ILInstruction): void {
    this.genTransferAX(instr);
  }

  /**
   * Exposes genTransferAY for direct testing.
   */
  public testGenTransferAY(instr: ILInstruction): void {
    this.genTransferAY(instr);
  }

  /**
   * Exposes genTransferXA for direct testing.
   */
  public testGenTransferXA(instr: ILInstruction): void {
    this.genTransferXA(instr);
  }

  /**
   * Exposes genTransferYA for direct testing.
   */
  public testGenTransferYA(instr: ILInstruction): void {
    this.genTransferYA(instr);
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
   * Checks if A has the specified immediate value.
   */
  public testAHasImmediate(value: number): boolean {
    return this.aHasImmediate(value);
  }

  /**
   * Override to not throw on unhandled opcodes during testing.
   */
  public generate(_program: ILProgram): AsmILProgram {
    throw new Error('Not implemented for testing');
  }
}

// ============================================================================
// Label Operand Factory
// ============================================================================

/**
 * Creates a label operand for testing.
 *
 * @param name - Label name
 * @returns LabelOperand
 */
export function createLabelOp(name: string): LabelOperand {
  return {
    kind: 'label',
    name,
  };
}

// ============================================================================
// Control Flow IL Instruction Factories
// ============================================================================

/**
 * Creates a LABEL instruction.
 *
 * @param name - Label name
 * @returns IL instruction
 */
export function createLabelInstr(name: string): ILInstruction {
  return {
    opcode: ILOpcode.LABEL,
    operands: [createLabelOp(name)] as ILOperand[],
  };
}

/**
 * Creates a JUMP instruction.
 *
 * @param label - Target label name
 * @returns IL instruction
 */
export function createJumpInstr(label: string): ILInstruction {
  return {
    opcode: ILOpcode.JUMP,
    operands: [createLabelOp(label)] as ILOperand[],
    comment: `Jump to ${label}`,
  };
}

/**
 * Creates a JUMP_EQ instruction (branch if equal).
 *
 * @param label - Target label name
 * @returns IL instruction
 */
export function createJumpEqInstr(label: string): ILInstruction {
  return {
    opcode: ILOpcode.JUMP_EQ,
    operands: [createLabelOp(label)] as ILOperand[],
    comment: `Jump if equal to ${label}`,
  };
}

/**
 * Creates a JUMP_NE instruction (branch if not equal).
 *
 * @param label - Target label name
 * @returns IL instruction
 */
export function createJumpNeInstr(label: string): ILInstruction {
  return {
    opcode: ILOpcode.JUMP_NE,
    operands: [createLabelOp(label)] as ILOperand[],
    comment: `Jump if not equal to ${label}`,
  };
}

/**
 * Creates a JUMP_LT instruction (branch if less than).
 *
 * @param label - Target label name
 * @returns IL instruction
 */
export function createJumpLtInstr(label: string): ILInstruction {
  return {
    opcode: ILOpcode.JUMP_LT,
    operands: [createLabelOp(label)] as ILOperand[],
    comment: `Jump if less than to ${label}`,
  };
}

/**
 * Creates a JUMP_LE instruction (branch if less or equal).
 *
 * @param label - Target label name
 * @returns IL instruction
 */
export function createJumpLeInstr(label: string): ILInstruction {
  return {
    opcode: ILOpcode.JUMP_LE,
    operands: [createLabelOp(label)] as ILOperand[],
    comment: `Jump if less or equal to ${label}`,
  };
}

/**
 * Creates a JUMP_GE instruction (branch if greater or equal).
 *
 * @param label - Target label name
 * @returns IL instruction
 */
export function createJumpGeInstr(label: string): ILInstruction {
  return {
    opcode: ILOpcode.JUMP_GE,
    operands: [createLabelOp(label)] as ILOperand[],
    comment: `Jump if greater or equal to ${label}`,
  };
}

/**
 * Creates a JUMP_GT instruction (branch if greater than).
 *
 * @param label - Target label name
 * @returns IL instruction
 */
export function createJumpGtInstr(label: string): ILInstruction {
  return {
    opcode: ILOpcode.JUMP_GT,
    operands: [createLabelOp(label)] as ILOperand[],
    comment: `Jump if greater than to ${label}`,
  };
}

/**
 * Creates a NOP instruction.
 *
 * @returns IL instruction
 */
export function createNopInstr(): ILInstruction {
  return {
    opcode: ILOpcode.NOP,
    operands: [] as ILOperand[],
    comment: 'No operation',
  };
}

/**
 * Creates a PUSH_A instruction.
 *
 * @returns IL instruction
 */
export function createPushAInstr(): ILInstruction {
  return {
    opcode: ILOpcode.PUSH_A,
    operands: [] as ILOperand[],
    comment: 'Push accumulator',
  };
}

/**
 * Creates a POP_A instruction.
 *
 * @returns IL instruction
 */
export function createPopAInstr(): ILInstruction {
  return {
    opcode: ILOpcode.POP_A,
    operands: [] as ILOperand[],
    comment: 'Pop accumulator',
  };
}

/**
 * Creates a TRANSFER_AX instruction.
 *
 * @returns IL instruction
 */
export function createTransferAXInstr(): ILInstruction {
  return {
    opcode: ILOpcode.TRANSFER_AX,
    operands: [] as ILOperand[],
    comment: 'Transfer A to X',
  };
}

/**
 * Creates a TRANSFER_AY instruction.
 *
 * @returns IL instruction
 */
export function createTransferAYInstr(): ILInstruction {
  return {
    opcode: ILOpcode.TRANSFER_AY,
    operands: [] as ILOperand[],
    comment: 'Transfer A to Y',
  };
}

/**
 * Creates a TRANSFER_XA instruction.
 *
 * @returns IL instruction
 */
export function createTransferXAInstr(): ILInstruction {
  return {
    opcode: ILOpcode.TRANSFER_XA,
    operands: [] as ILOperand[],
    comment: 'Transfer X to A',
  };
}

/**
 * Creates a TRANSFER_YA instruction.
 *
 * @returns IL instruction
 */
export function createTransferYAInstr(): ILInstruction {
  return {
    opcode: ILOpcode.TRANSFER_YA,
    operands: [] as ILOperand[],
    comment: 'Transfer Y to A',
  };
}

// ============================================================================
// Label Element Helpers
// ============================================================================

/**
 * Finds all label elements in the generated output.
 *
 * @param elements - All ASM-IL elements
 * @returns Only label elements
 */
export function getLabels(elements: AsmILElement[]): AsmILElement[] {
  return elements.filter(isLabelElement);
}

/**
 * Finds a label element by name.
 *
 * @param elements - All ASM-IL elements
 * @param name - Label name to find (without the '.' prefix)
 * @returns The label element or undefined
 */
export function findLabel(
  elements: AsmILElement[],
  name: string
): AsmILElement | undefined {
  return elements.find(
    (e) => isLabelElement(e) && e.label.name === `.${name}`
  );
}

/**
 * Counts the number of labels in the output.
 *
 * @param elements - All ASM-IL elements
 * @returns Count of labels
 */
export function countLabels(elements: AsmILElement[]): number {
  return getLabels(elements).length;
}