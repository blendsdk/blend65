/**
 * Tests for Common Subexpression Elimination (CSE) Pass
 *
 * Tests the CSE pass which eliminates redundant computations within
 * basic blocks by reusing previously stored results.
 *
 * @module __tests__/optimizer/passes/cse.test
 */

import { describe, it, expect } from 'vitest';
import { CSEPass } from '../../../optimizer/passes/cse/index.js';
import { ILOpcode } from '../../../il/enums.js';
import { SlotKind, SlotLocation } from '../../../frame/enums.js';
import type { FrameSlot } from '../../../frame/types.js';
import type { ILInstruction } from '../../../il/instruction.js';
import type { ILFunction } from '../../../il/structures.js';
import type { OptimizationOptions } from '../../../optimizer/options.js';
import {
  createInstruction,
  createSlotOperand,
  createImmediateOperand,
} from '../../../il/factories.js';

// ============================================================================
// Test Helpers
// ============================================================================

/** Default optimization options for tests */
const OPTIONS: OptimizationOptions = { level: 'O2' };

/** Debug-enabled options */
const DEBUG_OPTIONS: OptimizationOptions = { level: 'O2', debug: true };

/**
 * Create a test FrameSlot.
 *
 * @param name - Slot name
 * @returns Minimal FrameSlot for testing
 */
function createTestSlot(name: string): FrameSlot {
  return {
    name,
    kind: SlotKind.Variable,
    location: SlotLocation.ZeroPage,
    address: 0x10,
    size: 1,
    accessCount: 0,
    maxLoopDepth: 0,
    isSingleDef: false,
    canPromoteToZP: false,
  };
}

/**
 * Create a LOAD_BYTE instruction.
 */
function loadByte(slotName: string): ILInstruction {
  return createInstruction(ILOpcode.LOAD_BYTE, [createSlotOperand(createTestSlot(slotName))]);
}

/**
 * Create a LOAD_IMM instruction.
 */
function loadImm(value: number): ILInstruction {
  return createInstruction(ILOpcode.LOAD_IMM, [createImmediateOperand(value, false)]);
}

/**
 * Create a STORE_BYTE instruction.
 */
function storeByte(slotName: string): ILInstruction {
  return createInstruction(ILOpcode.STORE_BYTE, [createSlotOperand(createTestSlot(slotName))]);
}

/**
 * Create an ADD_BYTE instruction.
 */
function addByte(slotName: string): ILInstruction {
  return createInstruction(ILOpcode.ADD_BYTE, [createSlotOperand(createTestSlot(slotName))]);
}

/**
 * Create a SUB_BYTE instruction.
 */
function subByte(slotName: string): ILInstruction {
  return createInstruction(ILOpcode.SUB_BYTE, [createSlotOperand(createTestSlot(slotName))]);
}

/**
 * Create an AND_BYTE instruction.
 */
function andByte(slotName: string): ILInstruction {
  return createInstruction(ILOpcode.AND_BYTE, [createSlotOperand(createTestSlot(slotName))]);
}

/**
 * Create an ADD_IMM instruction.
 */
function addImm(value: number): ILInstruction {
  return createInstruction(ILOpcode.ADD_IMM, [createImmediateOperand(value, false)]);
}

/**
 * Create a LABEL instruction.
 */
function label(name: string): ILInstruction {
  return createInstruction(ILOpcode.LABEL, [createImmediateOperand(0, false)], { comment: name });
}

/**
 * Create a CALL instruction.
 */
function call(): ILInstruction {
  return createInstruction(ILOpcode.CALL, [createImmediateOperand(0, false)]);
}

/**
 * Create a JUMP instruction.
 */
function jump(): ILInstruction {
  return createInstruction(ILOpcode.JUMP, [createImmediateOperand(0, false)]);
}

/**
 * Create INC_BYTE instruction.
 */
function incByte(slotName: string): ILInstruction {
  return createInstruction(ILOpcode.INC_BYTE, [createSlotOperand(createTestSlot(slotName))]);
}

/**
 * Create a minimal ILFunction for testing.
 */
function createTestFunction(instructions: ILInstruction[]): ILFunction {
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
// CSEPass Interface Tests
// ============================================================================

describe('CSEPass interface', () => {
  it('should have correct name', () => {
    const pass = new CSEPass();
    expect(pass.name).toBe('cse');
  });

  it('should depend on constant-prop', () => {
    const pass = new CSEPass();
    expect(pass.dependencies).toContain('constant-prop');
  });
});

// ============================================================================
// CSE Elimination Tests
// ============================================================================

describe('CSE elimination', () => {
  it('should eliminate duplicate LOAD+ADD_BYTE computation', () => {
    // LOAD x, ADD y, STORE z, LOAD x, ADD y, STORE w
    // Second LOAD+ADD should be replaced with LOAD z
    const func = createTestFunction([
      loadByte('x'),   // 0
      addByte('y'),    // 1: expr x+y
      storeByte('z'),  // 2: z = x+y
      loadByte('x'),   // 3: should become LOAD z
      addByte('y'),    // 4: should be eliminated
      storeByte('w'),  // 5: w = z
    ]);

    const pass = new CSEPass();
    const result = pass.run(func, OPTIONS);

    // Should have eliminated 1 instruction (the ADD_BYTE at index 4)
    expect(result.instructionsRemoved).toBeGreaterThan(0);
    expect(func.instructions).toHaveLength(5); // 6 - 1

    // The replacement LOAD should load from 'z' (result slot)
    const replacedLoad = func.instructions[3];
    expect(replacedLoad.opcode).toBe(ILOpcode.LOAD_BYTE);
  });

  it('should eliminate duplicate LOAD+SUB_BYTE computation', () => {
    const func = createTestFunction([
      loadByte('a'),   // 0
      subByte('b'),    // 1: expr a-b
      storeByte('r1'), // 2: r1 = a-b
      loadByte('a'),   // 3
      subByte('b'),    // 4: same expr, should be eliminated
      storeByte('r2'), // 5
    ]);

    const pass = new CSEPass();
    const result = pass.run(func, OPTIONS);

    expect(result.instructionsRemoved).toBeGreaterThan(0);
    expect(func.instructions).toHaveLength(5);
  });

  it('should eliminate duplicate LOAD+AND_BYTE computation', () => {
    const func = createTestFunction([
      loadByte('val'),  // 0
      andByte('mask'),  // 1: expr val & mask
      storeByte('r1'),  // 2: r1 = val & mask
      loadByte('val'),  // 3
      andByte('mask'),  // 4: same expr
      storeByte('r2'),  // 5
    ]);

    const pass = new CSEPass();
    const result = pass.run(func, OPTIONS);

    expect(result.instructionsRemoved).toBeGreaterThan(0);
  });

  it('should eliminate duplicate LOAD_IMM+ADD_IMM computation', () => {
    const func = createTestFunction([
      loadImm(10),      // 0: A = 10
      addImm(5),        // 1: A = 10 + 5
      storeByte('r1'),  // 2: r1 = 15
      loadImm(10),      // 3
      addImm(5),        // 4: same expr
      storeByte('r2'),  // 5
    ]);

    const pass = new CSEPass();
    const result = pass.run(func, OPTIONS);

    expect(result.instructionsRemoved).toBeGreaterThan(0);
  });
});

// ============================================================================
// No-Op Tests (should NOT eliminate)
// ============================================================================

describe('CSE no-op cases', () => {
  it('should not eliminate when no duplicate expressions exist', () => {
    const func = createTestFunction([
      loadByte('x'),
      addByte('y'),
      storeByte('z'),
    ]);

    const pass = new CSEPass();
    const result = pass.run(func, OPTIONS);

    expect(result.instructionsRemoved).toBe(0);
    expect(func.instructions).toHaveLength(3);
  });

  it('should not eliminate across block boundaries (LABEL)', () => {
    const func = createTestFunction([
      loadByte('x'),
      addByte('y'),
      storeByte('z'),
      label('L1'),         // block boundary clears state
      loadByte('x'),
      addByte('y'),
      storeByte('w'),
    ]);

    const pass = new CSEPass();
    const result = pass.run(func, OPTIONS);

    expect(result.instructionsRemoved).toBe(0);
  });

  it('should not eliminate across block boundaries (JUMP)', () => {
    const func = createTestFunction([
      loadByte('x'),
      addByte('y'),
      storeByte('z'),
      jump(),              // block boundary
      loadByte('x'),
      addByte('y'),
      storeByte('w'),
    ]);

    const pass = new CSEPass();
    const result = pass.run(func, OPTIONS);

    expect(result.instructionsRemoved).toBe(0);
  });

  it('should not eliminate across block boundaries (CALL)', () => {
    const func = createTestFunction([
      loadByte('x'),
      addByte('y'),
      storeByte('z'),
      call(),              // block boundary
      loadByte('x'),
      addByte('y'),
      storeByte('w'),
    ]);

    const pass = new CSEPass();
    const result = pass.run(func, OPTIONS);

    expect(result.instructionsRemoved).toBe(0);
  });

  it('should not eliminate different expressions', () => {
    const func = createTestFunction([
      loadByte('x'),
      addByte('y'),
      storeByte('z'),
      loadByte('x'),
      addByte('w'),     // different operand
      storeByte('r'),
    ]);

    const pass = new CSEPass();
    const result = pass.run(func, OPTIONS);

    expect(result.instructionsRemoved).toBe(0);
  });

  it('should return no changes for empty function', () => {
    const func = createTestFunction([]);
    const pass = new CSEPass();
    const result = pass.run(func, OPTIONS);

    expect(result.instructionsRemoved).toBe(0);
  });
});

// ============================================================================
// Invalidation Tests
// ============================================================================

describe('CSE invalidation', () => {
  it('should invalidate when input slot is modified', () => {
    const func = createTestFunction([
      loadByte('x'),
      addByte('y'),
      storeByte('z'),
      incByte('x'),       // x is modified — invalidates expr using x
      loadByte('x'),
      addByte('y'),
      storeByte('w'),
    ]);

    const pass = new CSEPass();
    const result = pass.run(func, OPTIONS);

    // Should NOT eliminate because x changed
    expect(result.instructionsRemoved).toBe(0);
  });

  it('should invalidate when operand slot is modified', () => {
    const func = createTestFunction([
      loadByte('x'),
      addByte('y'),
      storeByte('z'),
      incByte('y'),       // y is modified — invalidates expr using y
      loadByte('x'),
      addByte('y'),
      storeByte('w'),
    ]);

    const pass = new CSEPass();
    const result = pass.run(func, OPTIONS);

    // Should NOT eliminate because y changed
    expect(result.instructionsRemoved).toBe(0);
  });

  it('should invalidate when result slot is overwritten', () => {
    const func = createTestFunction([
      loadByte('x'),
      addByte('y'),
      storeByte('z'),     // z = x + y
      incByte('z'),       // z is modified — result no longer valid
      loadByte('x'),
      addByte('y'),
      storeByte('w'),
    ]);

    const pass = new CSEPass();
    const result = pass.run(func, OPTIONS);

    // Should NOT eliminate because result slot z was modified
    expect(result.instructionsRemoved).toBe(0);
  });
});

// ============================================================================
// Debug Output Tests
// ============================================================================

describe('CSE debug output', () => {
  it('should collect debug info when debug is enabled', () => {
    const func = createTestFunction([
      loadByte('x'),
      addByte('y'),
      storeByte('z'),
      loadByte('x'),
      addByte('y'),
      storeByte('w'),
    ]);

    const pass = new CSEPass();
    const result = pass.run(func, DEBUG_OPTIONS);

    // Should have debug messages
    expect(result.debugInfo).toBeDefined();
    expect(result.debugInfo!.length).toBeGreaterThan(0);
  });

  it('should not collect debug info when debug is disabled', () => {
    const func = createTestFunction([
      loadByte('x'),
      addByte('y'),
      storeByte('z'),
    ]);

    const pass = new CSEPass();
    const result = pass.run(func, OPTIONS);

    // debugInfo should be undefined when no debug output
    expect(result.debugInfo).toBeUndefined();
  });
});
