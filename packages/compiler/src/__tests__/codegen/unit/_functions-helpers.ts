/**
 * Shared Test Helpers for Function Operations Tests
 *
 * Common utilities used across all function operation unit tests.
 * Provides testable class, instruction factories, and assertion helpers.
 *
 * @module __tests__/codegen/unit/_functions-helpers
 */

import { ILInstruction, ILOpcode } from '../../../il/index.js';
import { ILOperand, FunctionOperand } from '../../../il/operands.js';
import { FunctionOpsGenerator } from '../../../codegen/generator/functions.js';
import { AsmILElement, AsmILProgram } from '../../../codegen/asm-il/types.js';
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

// Re-export label helpers
export { findLabel, countLabels } from './_control-flow-helpers.js';

// ============================================================================
// Testable Class for Function Operations
// ============================================================================

/**
 * Test subclass to expose protected function operation methods.
 *
 * Extends FunctionOpsGenerator to allow testing of:
 * - Individual function operation handlers
 * - Generated ASM-IL output
 */
export class TestableFunctionOpsGenerator extends FunctionOpsGenerator {
  /**
   * Exposes genCall for direct testing.
   */
  public testGenCall(instr: ILInstruction): void {
    this.genCall(instr);
  }

  /**
   * Exposes genReturn for direct testing.
   */
  public testGenReturn(instr: ILInstruction): void {
    this.genReturn(instr);
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
// Function Operand Factory
// ============================================================================

/**
 * Creates a function operand for testing.
 *
 * @param name - Function name
 * @param isCallback - Whether this is a callback/ISR (default: false)
 * @param coalesceGroup - Coalesce group number (default: 0)
 * @returns FunctionOperand
 */
export function createFunctionOp(
  name: string,
  isCallback: boolean = false,
  coalesceGroup: number = 0
): FunctionOperand {
  return {
    kind: 'function',
    name,
    isCallback,
    coalesceGroup,
  };
}

// ============================================================================
// Function IL Instruction Factories
// ============================================================================

/**
 * Creates a CALL instruction.
 *
 * @param funcName - Name of function to call
 * @param isCallback - Whether function is a callback/ISR
 * @param coalesceGroup - Coalesce group for optimization
 * @returns IL instruction
 */
export function createCallInstr(
  funcName: string,
  isCallback: boolean = false,
  coalesceGroup: number = 0
): ILInstruction {
  return {
    opcode: ILOpcode.CALL,
    operands: [createFunctionOp(funcName, isCallback, coalesceGroup)] as ILOperand[],
    comment: `Call ${funcName}`,
  };
}

/**
 * Creates a RETURN instruction.
 *
 * @returns IL instruction
 */
export function createReturnInstr(): ILInstruction {
  return {
    opcode: ILOpcode.RETURN,
    operands: [] as ILOperand[],
    comment: 'Return from function',
  };
}