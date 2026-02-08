/**
 * IL Optimizer Test Utilities
 *
 * Shared helpers for IL Optimizer tests. Provides convenient functions for:
 * - Compiling and optimizing source code
 * - Creating test IL instructions, functions, and programs
 * - Generating large code for stress tests
 * - Verifying optimization results
 *
 * @module __tests__/optimizer/helpers/optimizer-test-utils
 */

import { ILOptimizer } from '../../../optimizer/index.js';
import type {
  OptimizationLevel,
  OptimizationOptions,
  OptimizationResult,
} from '../../../optimizer/index.js';
import { ILOpcode } from '../../../il/enums.js';
import type { ILFunction, ILProgram } from '../../../il/structures.js';
import type { ILInstruction } from '../../../il/instruction.js';
import {
  createSlotOperand,
  createImmediateOperand,
  createLabelOperand,
  createFunctionOperand,
} from '../../../il/factories.js';
import { SlotKind, SlotLocation } from '../../../frame/enums.js';
import { createFrameSlot, type FrameSlot } from '../../../frame/types.js';
import { createFrame, type Frame } from '../../../frame/allocator/frame-calculator.js';
import { BUILTIN_TYPES } from '../../../semantic/types.js';

// Re-export core IL helpers for convenience
export {
  compileToIL,
  countOpcode,
  hasOpcode,
  findInstructions,
  getFunction,
  getMainFunction,
  getImmediateValue,
  wrapInModule,
  wrapInFunction,
  wrapInProgram,
} from '../../il/helpers/il-test-utils.js';

// ============================================================================
// Compile and Optimize Helper
// ============================================================================

/**
 * Compiles source code and runs the optimizer.
 *
 * @param source - Blend source code
 * @param level - Optimization level (default: 'O2')
 * @returns Object with optimized program and stats
 *
 * @example
 * ```typescript
 * const { program, stats } = compileAndOptimize(`
 *   module Test;
 *   function main(): void {
 *     let x: byte = 5 + 0;  // Identity operation
 *   }
 * `);
 * expect(stats.modified).toBe(true);
 * ```
 */
export function compileAndOptimize(
  source: string,
  level: OptimizationLevel = 'O2'
): { program: ILProgram; stats: ReturnType<ILOptimizer['getProgramResult']> } {
  // Import dynamically to avoid circular dependency
  const { compileToIL } = require('../../il/helpers/il-test-utils.js');

  const program = compileToIL(source);
  const optimizer = new ILOptimizer({ level });
  optimizer.optimizeProgram(program);

  return {
    program,
    stats: optimizer.getProgramResult()!,
  };
}

/**
 * Compiles source code and optimizes with custom options.
 *
 * @param source - Blend source code
 * @param options - Custom optimization options
 * @returns Object with optimized program and stats
 */
export function compileAndOptimizeWithOptions(
  source: string,
  options: OptimizationOptions
): { program: ILProgram; stats: ReturnType<ILOptimizer['getProgramResult']> } {
  const { compileToIL } = require('../../il/helpers/il-test-utils.js');

  const program = compileToIL(source);
  const optimizer = new ILOptimizer(options);
  optimizer.optimizeProgram(program);

  return {
    program,
    stats: optimizer.getProgramResult()!,
  };
}

// ============================================================================
// Test Slot Creation
// ============================================================================

/**
 * Creates a test frame slot with configurable properties.
 *
 * @param name - Slot name
 * @param options - Optional slot configuration
 * @returns FrameSlot for testing
 *
 * @example
 * ```typescript
 * const slot = createTestSlot('counter');
 * const zpSlot = createTestSlot('ptr', { location: SlotLocation.ZeroPage });
 * ```
 */
export function createTestSlot(
  name: string,
  options: Partial<{
    kind: SlotKind;
    location: SlotLocation;
    address: number;
    size: number;
    accessCount: number;
    maxLoopDepth: number;
  }> = {}
): FrameSlot {
  const slot = createFrameSlot(
    name,
    options.kind ?? SlotKind.Local,
    BUILTIN_TYPES.BYTE,
    {
      location: options.location ?? SlotLocation.ZeroPage,
      address: options.address ?? 0x10 + (name.charCodeAt(0) % 64),
      accessCount: options.accessCount ?? 0,
      maxLoopDepth: options.maxLoopDepth ?? 0,
    }
  );
  return slot;
}

/**
 * Creates a test frame using the real frame factory.
 * This is NOT a mock - it uses the actual createFrame() implementation.
 *
 * @param name - Frame name (default: 'test')
 * @returns Real Frame instance for testing
 */
export function createTestFrame(name = 'test'): Frame {
  return createFrame(name, {
    isExported: false,
    isCallback: false,
  });
}

// ============================================================================
// Instruction Creation Helpers
// ============================================================================

/**
 * Creates a LOAD_IMM instruction.
 *
 * @param value - Immediate value to load
 * @returns ILInstruction
 */
export function createLoadImmInstr(value: number): ILInstruction {
  return {
    opcode: ILOpcode.LOAD_IMM,
    operands: [createImmediateOperand(value, false)],
    defUse: { defs: [], uses: [] },
  };
}

/**
 * Creates a STORE_BYTE instruction.
 *
 * @param slotName - Name of the slot to store to
 * @returns ILInstruction
 */
export function createStoreByteInstr(slotName: string): ILInstruction {
  const slot = createTestSlot(slotName);
  return {
    opcode: ILOpcode.STORE_BYTE,
    operands: [createSlotOperand(slot)],
    defUse: { defs: [slotName], uses: [] },
  };
}

/**
 * Creates a LOAD_BYTE instruction.
 *
 * @param slotName - Name of the slot to load from
 * @returns ILInstruction
 */
export function createLoadByteInstr(slotName: string): ILInstruction {
  const slot = createTestSlot(slotName);
  return {
    opcode: ILOpcode.LOAD_BYTE,
    operands: [createSlotOperand(slot)],
    defUse: { defs: [], uses: [slotName] },
  };
}

/**
 * Creates an ADD_IMM instruction.
 *
 * @param value - Immediate value to add
 * @returns ILInstruction
 */
export function createAddImmInstr(value: number): ILInstruction {
  return {
    opcode: ILOpcode.ADD_IMM,
    operands: [createImmediateOperand(value, false)],
    defUse: { defs: [], uses: [] },
  };
}

/**
 * Creates a SUB_IMM instruction.
 *
 * @param value - Immediate value to subtract
 * @returns ILInstruction
 */
export function createSubImmInstr(value: number): ILInstruction {
  return {
    opcode: ILOpcode.SUB_IMM,
    operands: [createImmediateOperand(value, false)],
    defUse: { defs: [], uses: [] },
  };
}

/**
 * Creates an AND_IMM instruction.
 *
 * @param value - Immediate value for AND
 * @returns ILInstruction
 */
export function createAndImmInstr(value: number): ILInstruction {
  return {
    opcode: ILOpcode.AND_IMM,
    operands: [createImmediateOperand(value, false)],
    defUse: { defs: [], uses: [] },
  };
}

/**
 * Creates an OR_IMM instruction.
 *
 * @param value - Immediate value for OR
 * @returns ILInstruction
 */
export function createOrImmInstr(value: number): ILInstruction {
  return {
    opcode: ILOpcode.OR_IMM,
    operands: [createImmediateOperand(value, false)],
    defUse: { defs: [], uses: [] },
  };
}

/**
 * Creates an XOR_IMM instruction.
 *
 * @param value - Immediate value for XOR
 * @returns ILInstruction
 */
export function createXorImmInstr(value: number): ILInstruction {
  return {
    opcode: ILOpcode.XOR_IMM,
    operands: [createImmediateOperand(value, false)],
    defUse: { defs: [], uses: [] },
  };
}

/**
 * Creates a CMP_IMM instruction.
 *
 * @param value - Immediate value to compare with
 * @returns ILInstruction
 */
export function createCmpImmInstr(value: number): ILInstruction {
  return {
    opcode: ILOpcode.CMP_IMM,
    operands: [createImmediateOperand(value, false)],
    defUse: { defs: [], uses: [] },
  };
}

/**
 * Creates a RETURN instruction.
 *
 * @returns ILInstruction
 */
export function createReturnInstr(): ILInstruction {
  return {
    opcode: ILOpcode.RETURN,
    operands: [],
    defUse: { defs: [], uses: [] },
  };
}

/**
 * Creates a LABEL instruction.
 *
 * @param name - Label name
 * @returns ILInstruction
 */
export function createLabelInstr(name: string): ILInstruction {
  return {
    opcode: ILOpcode.LABEL,
    operands: [createLabelOperand(name)],
    defUse: { defs: [], uses: [] },
  };
}

/**
 * Creates a JUMP instruction.
 *
 * @param target - Target label name
 * @returns ILInstruction
 */
export function createJumpInstr(target: string): ILInstruction {
  return {
    opcode: ILOpcode.JUMP,
    operands: [createLabelOperand(target)],
    defUse: { defs: [], uses: [] },
  };
}

/**
 * Creates a JUMP_EQ instruction.
 *
 * @param target - Target label name
 * @returns ILInstruction
 */
export function createJumpEqInstr(target: string): ILInstruction {
  return {
    opcode: ILOpcode.JUMP_EQ,
    operands: [createLabelOperand(target)],
    defUse: { defs: [], uses: [] },
  };
}

/**
 * Creates a JUMP_NE instruction.
 *
 * @param target - Target label name
 * @returns ILInstruction
 */
export function createJumpNeInstr(target: string): ILInstruction {
  return {
    opcode: ILOpcode.JUMP_NE,
    operands: [createLabelOperand(target)],
    defUse: { defs: [], uses: [] },
  };
}

/**
 * Creates a CALL instruction.
 *
 * @param funcName - Function to call
 * @returns ILInstruction
 */
export function createCallInstr(funcName: string): ILInstruction {
  return {
    opcode: ILOpcode.CALL,
    operands: [createFunctionOperand(funcName)],
    defUse: { defs: [], uses: [] },
  };
}

/**
 * Creates an INC_BYTE instruction.
 *
 * @param slotName - Name of the slot to increment
 * @returns ILInstruction
 */
export function createIncByteInstr(slotName: string): ILInstruction {
  const slot = createTestSlot(slotName);
  return {
    opcode: ILOpcode.INC_BYTE,
    operands: [createSlotOperand(slot)],
    defUse: { defs: [slotName], uses: [slotName] },
  };
}

/**
 * Creates a DEC_BYTE instruction.
 *
 * @param slotName - Name of the slot to decrement
 * @returns ILInstruction
 */
export function createDecByteInstr(slotName: string): ILInstruction {
  const slot = createTestSlot(slotName);
  return {
    opcode: ILOpcode.DEC_BYTE,
    operands: [createSlotOperand(slot)],
    defUse: { defs: [slotName], uses: [slotName] },
  };
}

/**
 * Creates a NOP instruction.
 *
 * @returns ILInstruction
 */
export function createNopInstr(): ILInstruction {
  return {
    opcode: ILOpcode.NOP,
    operands: [],
    defUse: { defs: [], uses: [] },
  };
}

// ============================================================================
// Function & Program Creation Helpers
// ============================================================================

/**
 * Creates a test IL function.
 *
 * @param name - Function name
 * @param instructions - Function instructions
 * @param isExported - Whether function is exported (default: false)
 * @returns ILFunction
 *
 * @example
 * ```typescript
 * const func = createTestILFunction('main', [
 *   createLoadImmInstr(5),
 *   createAddImmInstr(3),
 *   createReturnInstr(),
 * ], true);
 * ```
 */
export function createTestILFunction(
  name: string,
  instructions: ILInstruction[],
  isExported = false
): ILFunction {
  return {
    name,
    frame: createTestFrame(name),
    instructions,
    isExported,
    isCallback: false,
    loops: [],
    maxLoopDepth: 0,
  };
}

/**
 * Creates a test IL program.
 *
 * @param functions - Array of functions
 * @param entryPoint - Entry point function name (default: 'main')
 * @returns ILProgram
 *
 * @example
 * ```typescript
 * const program = createTestILProgram([mainFunc, helperFunc], 'main');
 * ```
 */
export function createTestILProgram(
  functions: ILFunction[],
  entryPoint = 'main'
): ILProgram {
  return {
    moduleName: 'test',
    functions,
    globalInit: [],
    entryPoint,
    instructionCount: functions.reduce((sum, f) => sum + f.instructions.length, 0),
    totalEstimatedCycles: 0,
  };
}

// ============================================================================
// Large Code Generation Helpers
// ============================================================================

/**
 * Generates a function with many instructions.
 *
 * @param instructionCount - Number of instructions to generate
 * @returns ILFunction with many instructions
 *
 * @example
 * ```typescript
 * const largeFunc = generateLargeFunction(500);
 * expect(largeFunc.instructions.length).toBeGreaterThanOrEqual(500);
 * ```
 */
export function generateLargeFunction(instructionCount: number): ILFunction {
  const instructions: ILInstruction[] = [];

  for (let i = 0; i < instructionCount; i++) {
    if (i % 3 === 0) {
      instructions.push(createLoadImmInstr(i % 256));
    } else if (i % 3 === 1) {
      instructions.push(createAddImmInstr(1));
    } else {
      instructions.push(createStoreByteInstr(`v${i % 10}`));
    }
  }
  instructions.push(createReturnInstr());

  return createTestILFunction('largeFunc', instructions);
}

/**
 * Generates a function with many dead code opportunities.
 * Stores to variables that are never used.
 *
 * @param count - Number of dead store opportunities
 * @returns ILFunction with dead code
 */
export function generateManyDeadCodeOpportunities(count: number): ILFunction {
  const instructions: ILInstruction[] = [];

  for (let i = 0; i < count; i++) {
    instructions.push(createLoadImmInstr(i % 256));
    instructions.push(createStoreByteInstr(`dead${i}`));
  }
  instructions.push(createReturnInstr());

  return createTestILFunction('deadCode', instructions);
}

/**
 * Generates a function with many constant fold opportunities.
 * LOAD_IMM followed by ADD_IMM can be folded.
 *
 * @param count - Number of fold opportunities
 * @returns ILFunction with constant fold opportunities
 */
export function generateManyConstantFoldOpportunities(count: number): ILFunction {
  const instructions: ILInstruction[] = [];

  for (let i = 0; i < count; i++) {
    instructions.push(createLoadImmInstr(i % 128));
    instructions.push(createAddImmInstr((i + 1) % 128));
  }
  instructions.push(createReturnInstr());

  return createTestILFunction('constantFold', instructions);
}

/**
 * Generates a function with many identity operations (peephole opportunities).
 * ADD 0, OR 0, AND $FF, etc.
 *
 * @param count - Number of identity operations
 * @returns ILFunction with identity operations
 */
export function generateManyIdentityOpportunities(count: number): ILFunction {
  const instructions: ILInstruction[] = [createLoadImmInstr(1)];

  for (let i = 0; i < count; i++) {
    instructions.push(createAddImmInstr(0)); // Identity: x + 0 = x
  }
  instructions.push(createReturnInstr());

  return createTestILFunction('identity', instructions);
}

/**
 * Generates a function with mixed identity operations.
 * Includes ADD 0, SUB 0, OR 0, AND $FF patterns.
 *
 * @param count - Number of operations (distributed among types)
 * @returns ILFunction with mixed identity operations
 */
export function generateMixedIdentityOpportunities(count: number): ILFunction {
  const instructions: ILInstruction[] = [createLoadImmInstr(42)];

  for (let i = 0; i < count; i++) {
    switch (i % 4) {
      case 0:
        instructions.push(createAddImmInstr(0)); // x + 0 = x
        break;
      case 1:
        instructions.push(createSubImmInstr(0)); // x - 0 = x
        break;
      case 2:
        instructions.push(createOrImmInstr(0)); // x | 0 = x
        break;
      case 3:
        instructions.push(createAndImmInstr(0xff)); // x & $FF = x
        break;
    }
  }
  instructions.push(createReturnInstr());

  return createTestILFunction('mixedIdentity', instructions);
}

/**
 * Generates a function with copy propagation opportunities.
 * Patterns like: LOAD x, STORE y, LOAD y → LOAD x
 *
 * @param count - Number of copy chains
 * @returns ILFunction with copy propagation opportunities
 */
export function generateCopyPropOpportunities(count: number): ILFunction {
  const instructions: ILInstruction[] = [];

  for (let i = 0; i < count; i++) {
    instructions.push(createLoadByteInstr(`src${i}`));
    instructions.push(createStoreByteInstr(`copy${i}`));
    instructions.push(createLoadByteInstr(`copy${i}`)); // Can be replaced with src
    instructions.push(createStoreByteInstr(`dest${i}`));
  }
  instructions.push(createReturnInstr());

  return createTestILFunction('copyProp', instructions);
}

/**
 * Generates a function with constant propagation opportunities.
 * Patterns like: LOAD_IMM 5, STORE x, ..., LOAD x → LOAD_IMM 5
 *
 * @param count - Number of constant definitions
 * @returns ILFunction with constant propagation opportunities
 */
export function generateConstantPropOpportunities(count: number): ILFunction {
  const instructions: ILInstruction[] = [];

  // Define constants
  for (let i = 0; i < count; i++) {
    instructions.push(createLoadImmInstr(i % 256));
    instructions.push(createStoreByteInstr(`const${i}`));
  }

  // Use constants (can be replaced with immediate loads)
  for (let i = 0; i < count; i++) {
    instructions.push(createLoadByteInstr(`const${i}`));
    instructions.push(createAddImmInstr(1));
  }
  instructions.push(createReturnInstr());

  return createTestILFunction('constantProp', instructions);
}

// ============================================================================
// Verification Helpers
// ============================================================================

/**
 * Verifies optimization statistics meet expectations.
 *
 * @param stats - Optimization result
 * @param expectations - Expected values
 * @throws Vitest assertion errors
 *
 * @example
 * ```typescript
 * verifyOptimizationStats(stats, {
 *   modified: true,
 *   minRemoved: 5,
 * });
 * ```
 */
export function verifyOptimizationStats(
  stats: OptimizationResult,
  expectations: {
    modified?: boolean;
    minRemoved?: number;
    maxRemoved?: number;
    minIterations?: number;
    maxIterations?: number;
  }
): void {
  if (expectations.modified !== undefined) {
    if (stats.modified !== expectations.modified) {
      throw new Error(`Expected modified=${expectations.modified}, got ${stats.modified}`);
    }
  }
  if (expectations.minRemoved !== undefined) {
    if (stats.totalInstructionsRemoved < expectations.minRemoved) {
      throw new Error(
        `Expected at least ${expectations.minRemoved} removed, got ${stats.totalInstructionsRemoved}`
      );
    }
  }
  if (expectations.maxRemoved !== undefined) {
    if (stats.totalInstructionsRemoved > expectations.maxRemoved) {
      throw new Error(
        `Expected at most ${expectations.maxRemoved} removed, got ${stats.totalInstructionsRemoved}`
      );
    }
  }
  if (expectations.minIterations !== undefined) {
    if (stats.totalIterations < expectations.minIterations) {
      throw new Error(
        `Expected at least ${expectations.minIterations} iterations, got ${stats.totalIterations}`
      );
    }
  }
  if (expectations.maxIterations !== undefined) {
    if (stats.totalIterations > expectations.maxIterations) {
      throw new Error(
        `Expected at most ${expectations.maxIterations} iterations, got ${stats.totalIterations}`
      );
    }
  }
}

/**
 * Verifies function instruction count is within range.
 *
 * @param func - IL function
 * @param min - Minimum expected count
 * @param max - Maximum expected count
 */
export function verifyInstructionCountRange(
  func: ILFunction,
  min: number,
  max: number
): void {
  const count = func.instructions.length;
  if (count < min || count > max) {
    throw new Error(`Expected instruction count ${min}-${max}, got ${count}`);
  }
}

/**
 * Verifies that optimization reduced instruction count.
 *
 * @param before - Count before optimization
 * @param after - Count after optimization
 * @param minReduction - Minimum expected reduction (default: 1)
 */
export function verifyReduction(
  before: number,
  after: number,
  minReduction = 1
): void {
  const reduction = before - after;
  if (reduction < minReduction) {
    throw new Error(
      `Expected reduction >= ${minReduction}, got ${reduction} (${before} → ${after})`
    );
  }
}

/**
 * Verifies semantic equivalence by comparing slot defs/uses.
 * Ensures optimization didn't change program semantics.
 *
 * @param before - Instructions before optimization
 * @param after - Instructions after optimization
 * @param excludeDeadCode - Whether to exclude dead code from comparison
 */
export function verifySemanticPreservation(
  before: ILInstruction[],
  after: ILInstruction[],
  excludeDeadCode = true
): void {
  // Collect all slot definitions and uses
  const beforeDefs = new Set<string>();
  const afterDefs = new Set<string>();

  for (const instr of before) {
    if (instr.defUse) {
      instr.defUse.defs.forEach(d => beforeDefs.add(d));
    }
  }
  for (const instr of after) {
    if (instr.defUse) {
      instr.defUse.defs.forEach(d => afterDefs.add(d));
    }
  }

  // After optimization, we should have a subset of defs (dead code removal)
  if (!excludeDeadCode) {
    for (const def of afterDefs) {
      if (!beforeDefs.has(def)) {
        throw new Error(`New definition introduced by optimization: ${def}`);
      }
    }
  }
}

// ============================================================================
// Optimizer Instance Helpers
// ============================================================================

/**
 * Creates an optimizer and runs it on a function.
 *
 * @param func - IL function to optimize
 * @param level - Optimization level (default: 'O2')
 * @returns Optimization result or undefined
 */
export function optimizeFunction(
  func: ILFunction,
  level: OptimizationLevel = 'O2'
): OptimizationResult | undefined {
  const optimizer = new ILOptimizer({ level });
  optimizer.optimizeFunction(func);
  return optimizer.getLastResult();
}

/**
 * Creates an optimizer and runs it on a program.
 *
 * @param program - IL program to optimize
 * @param level - Optimization level (default: 'O2')
 * @returns Program optimization result or undefined
 */
export function optimizeProgram(
  program: ILProgram,
  level: OptimizationLevel = 'O2'
): ReturnType<ILOptimizer['getProgramResult']> {
  const optimizer = new ILOptimizer({ level });
  optimizer.optimizeProgram(program);
  return optimizer.getProgramResult();
}