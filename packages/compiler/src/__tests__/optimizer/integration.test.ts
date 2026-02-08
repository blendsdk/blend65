/**
 * Integration Tests for IL Optimizer
 *
 * Tests that all optimizer passes work together correctly.
 *
 * @module __tests__/optimizer/integration.test
 */

import { describe, it, expect } from 'vitest';
import {
  PassManager,
  DCEPass,
  ConstantFoldPass,
  ConstantPropPass,
  CopyPropPass,
  ILPeepholePass,
} from '../../optimizer/index.js';
import { ILOpcode } from '../../il/enums.js';
import type { ILFunction } from '../../il/structures.js';
import type { ILInstruction } from '../../il/instruction.js';
import {
  createSlotOperand,
  createImmediateOperand,
  createLabelOperand,
} from '../../il/factories.js';
import { SlotKind, SlotLocation } from '../../frame/enums.js';
import type { FrameSlot } from '../../frame/types.js';
import { isSlotOperand, isImmediateOperand } from '../../il/guards.js';

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

function createReturnInstr(): ILInstruction {
  return {
    opcode: ILOpcode.RETURN,
    operands: [],
    defUse: { defs: [], uses: [] },
  };
}

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

function getSlotName(instr: ILInstruction): string | null {
  if (instr.operands.length === 0) return null;
  const op = instr.operands[0];
  return isSlotOperand(op) ? op.slot.name : null;
}

function getImmValue(instr: ILInstruction): number | null {
  if (instr.operands.length === 0) return null;
  const op = instr.operands[0];
  return isImmediateOperand(op) ? op.value : null;
}

// ============================================================================
// All Passes Integration Tests
// ============================================================================

describe('IL Optimizer Integration - All Passes', () => {
  it('should run all passes in correct order', () => {
    const manager = new PassManager({
      level: 'O2',
      enabledPasses: ['dce', 'constant-fold', 'constant-prop', 'copy-prop', 'il-peephole'],
    });

    // Register all passes
    manager.registerPass(new DCEPass());
    manager.registerPass(new ConstantFoldPass());
    manager.registerPass(new ConstantPropPass());
    manager.registerPass(new CopyPropPass());
    manager.registerPass(new ILPeepholePass());

    const func = createTestFunction([
      createLoadImmInstr(5),
      createAddImmInstr(3), // Can be folded to LOAD_IMM 8
      createStoreByteInstr('x'),
      createReturnInstr(),
    ]);

    const result = manager.optimize(func);

    expect(result.modified).toBe(true);
    // Constant folding should have combined 5 + 3 into 8
    expect(func.instructions.length).toBeLessThanOrEqual(3);
  });

  it('should handle complex optimization chains', () => {
    const manager = new PassManager({
      level: 'O2',
      enabledPasses: ['dce', 'constant-fold', 'constant-prop', 'copy-prop', 'il-peephole'],
    });

    manager.registerPass(new DCEPass());
    manager.registerPass(new ConstantFoldPass());
    manager.registerPass(new ConstantPropPass());
    manager.registerPass(new CopyPropPass());
    manager.registerPass(new ILPeepholePass());

    // Complex sequence:
    // LOAD_IMM 10, ADD_IMM 0 (identity), AND_IMM 255 (identity),
    // STORE x, LOAD x (redundant), RETURN
    const func = createTestFunction([
      createLoadImmInstr(10),
      createAddImmInstr(0), // Identity - should be removed
      createAndImmInstr(0xff), // Identity - should be removed
      createStoreByteInstr('x'),
      createLoadByteInstr('x'), // Redundant after store
      createReturnInstr(),
    ]);

    const result = manager.optimize(func);

    expect(result.modified).toBe(true);
    // After peephole: ADD 0 removed, AND 0xFF removed, LOAD after STORE removed
    expect(func.instructions.length).toBeLessThanOrEqual(4);
  });
});

// ============================================================================
// Pass Order Tests
// ============================================================================

describe('IL Optimizer Integration - Pass Order', () => {
  it('should respect pass dependencies', () => {
    const manager = new PassManager({ level: 'O2' });

    // Register in wrong order - manager should still order correctly
    manager.registerPass(new ILPeepholePass());
    manager.registerPass(new DCEPass());
    manager.registerPass(new CopyPropPass());
    manager.registerPass(new ConstantPropPass());
    manager.registerPass(new ConstantFoldPass());

    const func = createTestFunction([
      createLoadImmInstr(1),
      createReturnInstr(),
    ]);

    // Should not throw even if registered in "wrong" order
    expect(() => manager.optimize(func)).not.toThrow();
  });
});

// ============================================================================
// Optimization Level Tests
// ============================================================================

describe('IL Optimizer Integration - Optimization Levels', () => {
  it('should not optimize at O0', () => {
    const manager = new PassManager({ level: 'O0' });

    manager.registerPass(new DCEPass());
    manager.registerPass(new ILPeepholePass());

    const func = createTestFunction([
      createLoadImmInstr(5),
      createAddImmInstr(0), // Identity - would be removed at higher levels
      createReturnInstr(),
    ]);

    const result = manager.optimize(func);

    // O0 should skip all optimization passes
    expect(result.modified).toBe(false);
    expect(func.instructions).toHaveLength(3);
  });

  it('should apply basic optimizations at O1', () => {
    const manager = new PassManager({
      level: 'O1',
      enabledPasses: ['dce', 'constant-fold'],
    });

    manager.registerPass(new DCEPass());
    manager.registerPass(new ConstantFoldPass());

    const func = createTestFunction([
      createLoadImmInstr(2),
      createAddImmInstr(3), // Should be folded
      createReturnInstr(),
    ]);

    const result = manager.optimize(func);

    expect(result.modified).toBe(true);
  });

  it('should apply all optimizations at O2', () => {
    const manager = new PassManager({
      level: 'O2',
      enabledPasses: ['dce', 'constant-fold', 'constant-prop', 'copy-prop', 'il-peephole'],
    });

    manager.registerPass(new DCEPass());
    manager.registerPass(new ConstantFoldPass());
    manager.registerPass(new ConstantPropPass());
    manager.registerPass(new CopyPropPass());
    manager.registerPass(new ILPeepholePass());

    const func = createTestFunction([
      createLoadImmInstr(10),
      createAddImmInstr(0), // Identity
      createReturnInstr(),
    ]);

    const result = manager.optimize(func);

    expect(result.modified).toBe(true);
    expect(func.instructions).toHaveLength(2);
  });
});

// ============================================================================
// Statistics Tests
// ============================================================================

describe('IL Optimizer Integration - Statistics', () => {
  it('should aggregate statistics from all passes', () => {
    const manager = new PassManager({
      level: 'O2',
      enabledPasses: ['dce', 'il-peephole'],
    });

    manager.registerPass(new DCEPass());
    manager.registerPass(new ILPeepholePass());

    const func = createTestFunction([
      createLoadImmInstr(5),
      createAddImmInstr(0), // Will be removed by peephole
      createStoreByteInstr('unused'), // Dead store - may be removed by DCE
      createReturnInstr(),
    ]);

    const result = manager.optimize(func);

    expect(result.stats).toBeDefined();
    expect(result.stats.length).toBeGreaterThan(0);
    expect(result.totalInstructionsRemoved).toBeGreaterThanOrEqual(1);
  });

  it('should track timing information', () => {
    const manager = new PassManager({
      level: 'O2',
      enabledPasses: ['il-peephole'],
    });

    manager.registerPass(new ILPeepholePass());

    const func = createTestFunction([
      createLoadImmInstr(1),
      createAddImmInstr(0),
      createReturnInstr(),
    ]);

    const result = manager.optimize(func);

    expect(result.totalDurationMs).toBeDefined();
    expect(result.totalDurationMs).toBeGreaterThanOrEqual(0);
  });
});

// ============================================================================
// Edge Cases Tests
// ============================================================================

describe('IL Optimizer Integration - Edge Cases', () => {
  it('should handle empty function', () => {
    const manager = new PassManager({ level: 'O2' });

    manager.registerPass(new DCEPass());
    manager.registerPass(new ConstantFoldPass());
    manager.registerPass(new ILPeepholePass());

    const func = createTestFunction([]);

    expect(() => manager.optimize(func)).not.toThrow();
    expect(func.instructions).toHaveLength(0);
  });

  it('should handle function with only return', () => {
    const manager = new PassManager({ level: 'O2' });

    manager.registerPass(new DCEPass());
    manager.registerPass(new ILPeepholePass());

    const func = createTestFunction([createReturnInstr()]);

    const result = manager.optimize(func);

    expect(func.instructions).toHaveLength(1);
    expect(func.instructions[0].opcode).toBe(ILOpcode.RETURN);
  });

  it('should preserve necessary instructions', () => {
    const manager = new PassManager({
      level: 'O2',
      enabledPasses: ['dce', 'il-peephole'],
    });

    manager.registerPass(new DCEPass());
    manager.registerPass(new ILPeepholePass());

    // STORE to 'x' is dead code (never read) - DCE correctly removes it
    // Only RETURN is truly necessary
    const func = createTestFunction([
      createLoadImmInstr(42),
      createAddImmInstr(8), // Not identity - but no side effects without store
      createStoreByteInstr('x'), // Dead store - 'x' never read
      createReturnInstr(),
    ]);

    manager.optimize(func);

    // DCE removes dead stores, so only RETURN remains necessary
    // The LOAD + ADD are also dead since they don't affect anything used
    expect(func.instructions.length).toBeGreaterThanOrEqual(1);
    expect(func.instructions.some((i) => i.opcode === ILOpcode.RETURN)).toBe(true);
  });
});