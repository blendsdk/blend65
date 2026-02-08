/**
 * Shared Test Helpers for Comparison Operations Tests
 *
 * Common utilities used across all comparison operation unit tests.
 * Provides testable class, instruction factories, and assertion helpers.
 *
 * @module __tests__/codegen/unit/_comparison-helpers
 */

import { ILInstruction, ILOpcode } from '../../../il/index.js';
import { ILOperand } from '../../../il/operands.js';
import { FrameSlot } from '../../../frame/types.js';
import { ComparisonOpsGenerator } from '../../../codegen/generator/comparison.js';
import { AsmILElement, AsmILProgram } from '../../../codegen/asm-il/types.js';
import { ILProgram } from '../../../il/index.js';
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
// Testable Class for Comparison Operations
// ============================================================================

/**
 * Test subclass to expose protected comparison operation methods.
 *
 * Extends ComparisonOpsGenerator to allow testing of:
 * - Individual comparison operation handlers
 * - Generated ASM-IL output
 */
export class TestableComparisonOpsGenerator extends ComparisonOpsGenerator {
  /**
   * Exposes genCmpByte for direct testing.
   */
  public testGenCmpByte(instr: ILInstruction): void {
    this.genCmpByte(instr);
  }

  /**
   * Exposes genCmpImm for direct testing.
   */
  public testGenCmpImm(instr: ILInstruction): void {
    this.genCmpImm(instr);
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
  public generate(_program: ILProgram): AsmILProgram {
    throw new Error('Not implemented for testing');
  }
}

// ============================================================================
// Comparison IL Instruction Factories
// ============================================================================

/**
 * Creates a CMP_BYTE instruction.
 *
 * @param slot - Slot to compare with
 * @returns IL instruction
 */
export function createCmpByteInstr(slot: FrameSlot): ILInstruction {
  return {
    opcode: ILOpcode.CMP_BYTE,
    operands: [createSlotOp(slot)] as ILOperand[],
    comment: `Compare with ${slot.name}`,
  };
}

/**
 * Creates a CMP_IMM instruction.
 *
 * @param value - Immediate value to compare with
 * @returns IL instruction
 */
export function createCmpImmInstr(value: number): ILInstruction {
  return {
    opcode: ILOpcode.CMP_IMM,
    operands: [createImmediateOp(value)] as ILOperand[],
    comment: `Compare with immediate ${value}`,
  };
}