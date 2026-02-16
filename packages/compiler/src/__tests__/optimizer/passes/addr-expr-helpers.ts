/**
 * Shared test helpers for Address Expression Folding tests.
 *
 * Provides factory functions for creating IL instructions used in
 * the LOAD_ADDRESS + SHR_WORD + LO → LOAD_ADDRESS_EXPR pattern tests.
 *
 * @module __tests__/optimizer/passes/addr-expr-helpers
 */

import { ILPeepholePass } from '../../../optimizer/passes/il-peephole.js';
import type { OptimizationOptions } from '../../../optimizer/options.js';
import type { PassResult } from '../../../optimizer/pass.js';
import { ILOpcode } from '../../../il/enums.js';
import type { ILFunction } from '../../../il/structures.js';
import type { ILInstruction } from '../../../il/instruction.js';
import {
  createSlotOperand,
  createImmediateOperand,
} from '../../../il/factories.js';
import { SlotKind, SlotLocation, ZpDirective } from '../../../frame/enums.js';
import type { FrameSlot } from '../../../frame/types.js';
import { TypeKind } from '../../../semantic/types.js';
import { isImmediateOperand, isSlotOperand } from '../../../il/guards.js';

// ============================================================================
// Slot Factories
// ============================================================================

/**
 * Create a test frame slot for a @data variable (has dataLabel).
 *
 * Address expression folding requires the LOAD_ADDRESS slot to have
 * a dataLabel — this simulates a @data or @sprite storage class variable.
 *
 * @param name - Slot name (e.g., 'lineFrames')
 * @param dataLabel - ACME assembler label (e.g., '__data_Module_lineFrames')
 */
export function createDataSlot(name: string, dataLabel: string): FrameSlot {
  return {
    name,
    kind: SlotKind.Local,
    type: { kind: TypeKind.Word, name: 'word', size: 2, isSigned: false, isAssignable: true },
    location: SlotLocation.FrameRegion,
    address: 0x2000,
    offset: 0,
    size: 2, // word-sized (address)
    zpDirective: ZpDirective.None,
    zpScore: 0,
    accessCount: 0,
    maxLoopDepth: 0,
    isArrayElement: false,
    dataLabel,
  };
}

/**
 * Create a test frame slot for a regular variable (no dataLabel).
 * Used for intermediate store/reload slots in the gap pattern.
 *
 * @param name - Slot name (e.g., 'paramSlot')
 */
export function createRegularSlot(name: string): FrameSlot {
  return {
    name,
    kind: SlotKind.Local,
    type: { kind: TypeKind.Word, name: 'word', size: 2, isSigned: false, isAssignable: true },
    location: SlotLocation.ZeroPage,
    address: 0x10,
    offset: 0,
    size: 2,
    zpDirective: ZpDirective.None,
    zpScore: 0,
    accessCount: 0,
    maxLoopDepth: 0,
    isArrayElement: false,
  };
}

// ============================================================================
// Instruction Factories
// ============================================================================

/** Create LOAD_ADDRESS instruction for a @data slot */
export function createLoadAddressInstr(
  name: string,
  dataLabel: string
): ILInstruction {
  const slot = createDataSlot(name, dataLabel);
  return {
    opcode: ILOpcode.LOAD_ADDRESS,
    operands: [createSlotOperand(slot)],
    defUse: { defs: [], uses: [name] },
  };
}

/** Create SHR_WORD instruction with given shift count */
export function createShrWordInstr(shiftCount: number): ILInstruction {
  return {
    opcode: ILOpcode.SHR_WORD,
    operands: [createImmediateOperand(shiftCount, true)],
    defUse: { defs: [], uses: [] },
  };
}

/** Create LO instruction (narrow word to low byte) */
export function createLoInstr(): ILInstruction {
  return {
    opcode: ILOpcode.LO,
    operands: [],
    defUse: { defs: [], uses: [] },
  };
}

/** Create STORE_WORD instruction to given slot */
export function createStoreWordInstr(slotName: string): ILInstruction {
  const slot = createRegularSlot(slotName);
  return {
    opcode: ILOpcode.STORE_WORD,
    operands: [createSlotOperand(slot)],
    defUse: { defs: [slotName], uses: [] },
  };
}

/** Create LOAD_WORD instruction from given slot */
export function createLoadWordInstr(slotName: string): ILInstruction {
  const slot = createRegularSlot(slotName);
  return {
    opcode: ILOpcode.LOAD_WORD,
    operands: [createSlotOperand(slot)],
    defUse: { defs: [], uses: [slotName] },
  };
}

/** Create STORE_BYTE instruction to given slot */
export function createStoreByteInstr(slotName: string): ILInstruction {
  const slot = createRegularSlot(slotName);
  return {
    opcode: ILOpcode.STORE_BYTE,
    operands: [createSlotOperand(slot)],
    defUse: { defs: [slotName], uses: [] },
  };
}

/** Create LOAD_BYTE instruction from given slot */
export function createLoadByteInstr(slotName: string): ILInstruction {
  const slot = createRegularSlot(slotName);
  return {
    opcode: ILOpcode.LOAD_BYTE,
    operands: [createSlotOperand(slot)],
    defUse: { defs: [], uses: [slotName] },
  };
}

/** Create LOAD_IMM instruction with given value */
export function createLoadImmInstr(value: number): ILInstruction {
  return {
    opcode: ILOpcode.LOAD_IMM,
    operands: [createImmediateOperand(value, false)],
    defUse: { defs: [], uses: [] },
  };
}

/** Create RETURN instruction */
export function createReturnInstr(): ILInstruction {
  return {
    opcode: ILOpcode.RETURN,
    operands: [],
    defUse: { defs: [], uses: [] },
  };
}

/** Create ADD_IMM instruction */
export function createAddImmInstr(value: number): ILInstruction {
  return {
    opcode: ILOpcode.ADD_IMM,
    operands: [createImmediateOperand(value, false)],
    defUse: { defs: [], uses: [] },
  };
}

// ============================================================================
// Pattern Builders
// ============================================================================

/**
 * Build the direct 3-instruction address expression pattern.
 *
 * Pattern: LOAD_ADDRESS slot → SHR_WORD N → LO
 *
 * @param slotName - Data variable name
 * @param dataLabel - ACME label for the data
 * @param shiftCount - Number of bits to shift right
 */
export function createDirectPattern(
  slotName: string,
  dataLabel: string,
  shiftCount: number
): ILInstruction[] {
  return [
    createLoadAddressInstr(slotName, dataLabel),
    createShrWordInstr(shiftCount),
    createLoInstr(),
  ];
}

/**
 * Build the gap 5-instruction address expression pattern.
 *
 * Pattern: LOAD_ADDRESS slot → STORE_WORD paramSlot → LOAD_WORD paramSlot → SHR_WORD N → LO
 *
 * @param slotName - Data variable name
 * @param dataLabel - ACME label for the data
 * @param paramSlot - Intermediate parameter slot name
 * @param shiftCount - Number of bits to shift right
 */
export function createGapPattern(
  slotName: string,
  dataLabel: string,
  paramSlot: string,
  shiftCount: number
): ILInstruction[] {
  return [
    createLoadAddressInstr(slotName, dataLabel),
    createStoreWordInstr(paramSlot),
    createLoadWordInstr(paramSlot),
    createShrWordInstr(shiftCount),
    createLoInstr(),
  ];
}

// ============================================================================
// Test Function Factory
// ============================================================================

/** Create test ILFunction with given instructions */
export function createTestFunction(instructions: ILInstruction[]): ILFunction {
  return {
    name: 'test',
    frame: {} as never,
    instructions,
    isExported: false,
    isCallback: false,
    loops: [],
    maxLoopDepth: 0,
  };
}

// ============================================================================
// Assertion Helpers
// ============================================================================

/** Extract immediate value from instruction's first operand */
export function getImmValue(instr: ILInstruction): number | null {
  if (instr.operands.length === 0) return null;
  const op = instr.operands[0];
  return isImmediateOperand(op) ? op.value : null;
}

/** Extract slot name from instruction's first operand */
export function getSlotName(instr: ILInstruction): string | null {
  if (instr.operands.length === 0) return null;
  const op = instr.operands[0];
  return isSlotOperand(op) ? op.slot.name : null;
}

// ============================================================================
// Testable Subclass
// ============================================================================

/**
 * Subclass of ILPeepholePass that exposes the protected addressExprFolding
 * method for isolated testing.
 *
 * This is needed because the full `run()` method runs load-store elimination
 * BEFORE address expression folding, which removes the STORE_WORD/LOAD_WORD
 * gap before the gap pattern matcher can see it. Testing the method directly
 * allows verifying the gap pattern matching logic in isolation.
 */
export class TestableILPeepholePass extends ILPeepholePass {
  /**
   * Run ONLY the addressExprFolding pattern (Pattern 6) in isolation.
   * Bypasses all other peephole patterns so the input is not modified first.
   */
  public runAddressExprFoldingOnly(
    func: ILFunction,
    options: OptimizationOptions
  ): PassResult {
    return this.addressExprFolding(func, options);
  }
}
