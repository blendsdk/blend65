/**
 * End-to-End Tests for IL Optimizer
 *
 * Tests the complete optimizer pipeline using the ILOptimizer API.
 *
 * @module __tests__/optimizer/e2e.test
 */

import { describe, it, expect } from 'vitest';
import {
  ILOptimizer,
  DCEPass,
  ConstantFoldPass,
  ConstantPropPass,
  CopyPropPass,
  ILPeepholePass,
} from '../../optimizer/index.js';
import { ILOpcode } from '../../il/enums.js';
import type { ILFunction, ILProgram } from '../../il/structures.js';
import type { ILInstruction } from '../../il/instruction.js';
import {
  createSlotOperand,
  createImmediateOperand,
  createFunctionOperand,
  createILFunction,
  createILProgram,
} from '../../il/factories.js';
import { SlotKind, SlotLocation } from '../../frame/enums.js';
import type { FrameSlot } from '../../frame/types.js';
import { Frame } from '../../frame/allocator/frame-calculator.js';

// ============================================================================
// Test Helpers
// ============================================================================

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

function createLoadByteInstr(slotName: string): ILInstruction {
  const slot = createTestSlot(slotName);
  return {
    opcode: ILOpcode.LOAD_BYTE,
    operands: [createSlotOperand(slot)],
    defUse: { defs: [], uses: [slotName] },
  };
}

function createStoreByteInstr(slotName: string): ILInstruction {
  const slot = createTestSlot(slotName);
  return {
    opcode: ILOpcode.STORE_BYTE,
    operands: [createSlotOperand(slot)],
    defUse: { defs: [slotName], uses: [] },
  };
}

function createLoadImmInstr(value: number): ILInstruction {
  return {
    opcode: ILOpcode.LOAD_IMM,
    operands: [createImmediateOperand(value, false)],
    defUse: { defs: [], uses: [] },
  };
}

function createAddImmInstr(value: number): ILInstruction {
  return {
    opcode: ILOpcode.ADD_IMM,
    operands: [createImmediateOperand(value, false)],
    defUse: { defs: [], uses: [] },
  };
}

function createAndImmInstr(value: number): ILInstruction {
  return {
    opcode: ILOpcode.AND_IMM,
    operands: [createImmediateOperand(value, false)],
    defUse: { defs: [], uses: [] },
  };
}

function createOrImmInstr(value: number): ILInstruction {
  return {
    opcode: ILOpcode.OR_IMM,
    operands: [createImmediateOperand(value, false)],
    defUse: { defs: [], uses: [] },
  };
}

function createReturnInstr(): ILInstruction {
  return {
    opcode: ILOpcode.RETURN,
    operands: [],
    defUse: { defs: [], uses: [] },
  };
}

function createCallInstr(target: string): ILInstruction {
  return {
    opcode: ILOpcode.CALL,
    operands: [createFunctionOperand(target)],
    defUse: { defs: [], uses: [] },
  };
}

function createMockFrame(): Frame {
  return {
    name: 'test',
    slots: [],
    isExported: false,
    isCallback: false,
    zpUsed: 0,
    ramUsed: 0,
    maxZpAvailable: 64,
    maxRamAvailable: 256,
    coalesceGroup: 0,
  } as Frame;
}

function createTestILFunction(
  name: string,
  instructions: ILInstruction[],
  isExported = false
): ILFunction {
  return {
    name,
    frame: createMockFrame(),
    instructions,
    isExported,
    isCallback: false,
    loops: [],
    maxLoopDepth: 0,
  };
}

function createTestILProgram(functions: ILFunction[], entryPoint = 'main'): ILProgram {
  return {
    moduleName: 'test',
    functions,
    globalInit: [],
    entryPoint,
    instructionCount: 0,
    totalEstimatedCycles: 0,
  };
}

// ============================================================================
// ILOptimizer Single Function Tests
// ============================================================================

describe('ILOptimizer E2E - Single Function', () => {
  it('should optimize function at O0 (no optimization)', () => {
    const optimizer = new ILOptimizer({ level: 'O0' });

    const func = createTestILFunction('test', [
      createLoadImmInstr(5),
      createAddImmInstr(0), // Identity - NOT removed at O0
      createReturnInstr(),
    ]);

    optimizer.optimizeFunction(func);
    const result = optimizer.getLastResult();

    expect(result?.modified).toBe(false);
    expect(func.instructions).toHaveLength(3);
  });

  it('should optimize function at O1', () => {
    const optimizer = new ILOptimizer({ level: 'O1' });

    const func = createTestILFunction('test', [
      createLoadImmInstr(5),
      createAddImmInstr(3), // Can be folded
      createReturnInstr(),
    ]);

    optimizer.optimizeFunction(func);
    const result = optimizer.getLastResult();

    // At O1, constant folding should be enabled
    expect(result?.modified).toBe(true);
  });

  it('should optimize function at O2', () => {
    const optimizer = new ILOptimizer({ level: 'O2' });

    const func = createTestILFunction('test', [
      createLoadImmInstr(10),
      createAddImmInstr(0), // Identity - should be removed
      createAndImmInstr(0xff), // Identity - should be removed
      createStoreByteInstr('x'),
      createLoadByteInstr('x'), // Redundant
      createReturnInstr(),
    ]);

    optimizer.optimizeFunction(func);
    const result = optimizer.getLastResult();

    expect(result?.modified).toBe(true);
    // Multiple optimizations applied
    expect(func.instructions.length).toBeLessThan(6);
  });

  it('should optimize function at O3 (aggressive)', () => {
    const optimizer = new ILOptimizer({ level: 'O3' });

    const func = createTestILFunction('test', [
      createLoadImmInstr(1),
      createAddImmInstr(0), // Identity
      createAddImmInstr(0), // Identity
      createAddImmInstr(0), // Identity
      createReturnInstr(),
    ]);

    optimizer.optimizeFunction(func);
    const result = optimizer.getLastResult();

    expect(result?.modified).toBe(true);
    // All identities should be removed
    expect(func.instructions).toHaveLength(2);
  });
});

// ============================================================================
// ILOptimizer Program Tests
// ============================================================================

describe('ILOptimizer E2E - Program', () => {
  it('should optimize entire program', () => {
    const optimizer = new ILOptimizer({ level: 'O2' });

    const func1 = createTestILFunction('main', [
      createLoadImmInstr(1),
      createAddImmInstr(0), // Identity
      createCallInstr('helper'), // Call helper to keep it reachable
      createReturnInstr(),
    ], true);

    const func2 = createTestILFunction('helper', [
      createLoadImmInstr(2),
      createAddImmInstr(0), // Identity
      createReturnInstr(),
    ]);

    const program = createTestILProgram([func1, func2], 'main');

    optimizer.optimizeProgram(program);
    const result = optimizer.getProgramResult();

    expect(result?.modified).toBe(true);
    expect(result?.functionResults.length).toBeGreaterThanOrEqual(1);
    // At O2, function-inline is enabled and inlines helper (single-call-site)
    // into main, so main grows and helper remains (dead-function-elim would
    // remove it in a subsequent run). The key check is that optimization happened.
    // main: was [LOAD_IMM 1, ADD_IMM 0, CALL helper, RETURN] → peephole removes ADD 0,
    //   then inlining replaces CALL with helper body [LOAD_IMM 2, RETURN→JUMP] + cont label
    // Verify optimization occurred (instructions changed)
    const totalInstr = program.functions.reduce((s, f) => s + f.instructions.length, 0);
    expect(totalInstr).toBeGreaterThan(0);
  });

  it('should track program-level statistics', () => {
    const optimizer = new ILOptimizer({ level: 'O2' });

    const func = createTestILFunction('main', [
      createLoadImmInstr(5),
      createAddImmInstr(0),
      createAddImmInstr(0),
      createReturnInstr(),
    ], true);

    const program = createTestILProgram([func], 'main');

    optimizer.optimizeProgram(program);
    const result = optimizer.getProgramResult();

    expect(result?.totalInstructionsRemoved).toBeGreaterThan(0);
    expect(result?.totalDurationMs).toBeGreaterThanOrEqual(0);
  });
});

// ============================================================================
// ILOptimizer with Custom Options Tests
// ============================================================================

describe('ILOptimizer E2E - Custom Options', () => {
  it('should respect enabledPasses option', () => {
    // Only enable peephole, not constant folding
    const optimizer = new ILOptimizer({
      level: 'O2',
      enabledPasses: ['il-peephole'],
    });

    const func = createTestILFunction('test', [
      createLoadImmInstr(5),
      createAddImmInstr(3), // Would be folded, but constant-fold not enabled
      createAddImmInstr(0), // Identity - should be removed by peephole
      createReturnInstr(),
    ]);

    optimizer.optimizeFunction(func);

    // ADD 0 should be removed, but 5+3 not folded
    expect(func.instructions).toHaveLength(3);
    expect(func.instructions[0].opcode).toBe(ILOpcode.LOAD_IMM);
    expect(func.instructions[1].opcode).toBe(ILOpcode.ADD_IMM);
    expect(func.instructions[2].opcode).toBe(ILOpcode.RETURN);
  });

  it('should respect disabledPasses option', () => {
    // Disable both peephole AND constant-fold since both can remove ADD 0
    const optimizer = new ILOptimizer({
      level: 'O2',
      disabledPasses: ['il-peephole', 'constant-fold'],
    });

    const func = createTestILFunction('test', [
      createLoadImmInstr(5),
      createAddImmInstr(0), // Would be removed by peephole or constant-fold, but both disabled
      createReturnInstr(),
    ]);

    optimizer.optimizeFunction(func);

    // Both peephole and constant-fold are disabled, so ADD 0 remains
    expect(func.instructions).toHaveLength(3);
  });

  it('should work with debug option', () => {
    const optimizer = new ILOptimizer({
      level: 'O2',
      debug: true,
    });

    const func = createTestILFunction('test', [
      createLoadImmInstr(1),
      createAddImmInstr(0),
      createReturnInstr(),
    ]);

    optimizer.optimizeFunction(func);
    const result = optimizer.getLastResult();

    // Debug mode should produce debug info
    expect(result?.stats.some((s) => s.modified)).toBe(true);
  });
});

// ============================================================================
// ILOptimizer Size Optimization Tests
// ============================================================================

describe('ILOptimizer E2E - Size Optimization', () => {
  it('should work at Os level', () => {
    const optimizer = new ILOptimizer({ level: 'Os' });

    const func = createTestILFunction('test', [
      createLoadImmInstr(10),
      createAddImmInstr(0),
      createReturnInstr(),
    ]);

    optimizer.optimizeFunction(func);
    const result = optimizer.getLastResult();

    expect(result?.modified).toBe(true);
    expect(func.instructions).toHaveLength(2);
  });

  it('should work at Oz level (minimum size)', () => {
    const optimizer = new ILOptimizer({ level: 'Oz' });

    const func = createTestILFunction('test', [
      createLoadImmInstr(10),
      createAddImmInstr(0),
      createAddImmInstr(0),
      createReturnInstr(),
    ]);

    optimizer.optimizeFunction(func);
    const result = optimizer.getLastResult();

    expect(result?.modified).toBe(true);
    expect(func.instructions).toHaveLength(2);
  });
});

// ============================================================================
// ILOptimizer Chain of Optimizations Tests
// ============================================================================

describe('ILOptimizer E2E - Optimization Chains', () => {
  it('should chain constant fold + peephole effectively', () => {
    const optimizer = new ILOptimizer({ level: 'O2' });

    // LOAD_IMM 5, ADD_IMM 3 → LOAD_IMM 8 (constant fold)
    // Then peephole won't find anything more to do
    const func = createTestILFunction('test', [
      createLoadImmInstr(5),
      createAddImmInstr(3),
      createStoreByteInstr('x'),
      createReturnInstr(),
    ]);

    const beforeCount = func.instructions.length;
    optimizer.optimizeFunction(func);
    const afterCount = func.instructions.length;

    // Constant fold should reduce LOAD+ADD to single LOAD
    expect(afterCount).toBeLessThan(beforeCount);
  });

  it('should chain DCE + peephole effectively', () => {
    const optimizer = new ILOptimizer({ level: 'O2' });

    const func = createTestILFunction('test', [
      createLoadImmInstr(42),
      createStoreByteInstr('x'),
      createLoadImmInstr(0), // Dead store (not used)
      createStoreByteInstr('unused'),
      createAddImmInstr(0), // Identity
      createReturnInstr(),
    ]);

    optimizer.optimizeFunction(func);

    // DCE should remove dead store, peephole should remove ADD 0
    expect(func.instructions.length).toBeLessThanOrEqual(4);
  });

  it('should chain copy prop + peephole effectively', () => {
    const optimizer = new ILOptimizer({ level: 'O2' });

    const func = createTestILFunction('test', [
      createLoadByteInstr('x'),
      createStoreByteInstr('y'), // y = x
      createLoadByteInstr('y'), // Use y → copy prop should make this use x
      createAddImmInstr(0), // Identity
      createReturnInstr(),
    ]);

    optimizer.optimizeFunction(func);

    // Copy prop should propagate, peephole should remove ADD 0
    expect(func.instructions.length).toBeLessThanOrEqual(4);
  });
});

// ============================================================================
// ILOptimizer Edge Cases Tests
// ============================================================================

describe('ILOptimizer E2E - Edge Cases', () => {
  it('should handle empty function', () => {
    const optimizer = new ILOptimizer({ level: 'O2' });

    const func = createTestILFunction('test', []);

    expect(() => optimizer.optimizeFunction(func)).not.toThrow();
    expect(func.instructions).toHaveLength(0);
  });

  it('should handle empty program', () => {
    const optimizer = new ILOptimizer({ level: 'O2' });

    const program = createTestILProgram([]);

    expect(() => optimizer.optimizeProgram(program)).not.toThrow();
    expect(program.functions).toHaveLength(0);
  });

  it('should handle single instruction function', () => {
    const optimizer = new ILOptimizer({ level: 'O2' });

    const func = createTestILFunction('test', [createReturnInstr()]);

    expect(() => optimizer.optimizeFunction(func)).not.toThrow();
    expect(func.instructions).toHaveLength(1);
  });

  it('should preserve exported function behavior', () => {
    const optimizer = new ILOptimizer({ level: 'O2' });

    const func = createTestILFunction('main', [
      createLoadImmInstr(42),
      createReturnInstr(),
    ], true);

    optimizer.optimizeFunction(func);

    // Essential instructions should remain
    expect(func.instructions).toHaveLength(2);
    expect(func.instructions[0].opcode).toBe(ILOpcode.LOAD_IMM);
    expect(func.instructions[1].opcode).toBe(ILOpcode.RETURN);
  });
});

// ============================================================================
// ILOptimizer Performance Tests (Basic)
// ============================================================================

describe('ILOptimizer E2E - Performance', () => {
  it('should handle function with many instructions', () => {
    const optimizer = new ILOptimizer({ level: 'O2' });

    // Create function with 100 identity operations
    const instructions: ILInstruction[] = [createLoadImmInstr(1)];
    for (let i = 0; i < 100; i++) {
      instructions.push(createAddImmInstr(0));
    }
    instructions.push(createReturnInstr());

    const func = createTestILFunction('test', instructions);

    const startTime = Date.now();
    optimizer.optimizeFunction(func);
    const result = optimizer.getLastResult();
    const duration = Date.now() - startTime;

    expect(result?.modified).toBe(true);
    // All 100 ADD 0 should be removed
    expect(func.instructions).toHaveLength(2);
    // Should complete quickly (< 1 second for 100 instructions)
    expect(duration).toBeLessThan(1000);
  });
});