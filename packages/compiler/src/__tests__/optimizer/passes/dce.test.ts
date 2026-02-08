/**
 * Tests for Dead Code Elimination (DCE) Pass
 *
 * @module __tests__/optimizer/passes/dce.test
 */

import { describe, it, expect } from 'vitest';
import { DCEPass } from '../../../optimizer/passes/dce.js';
import { ILOpcode } from '../../../il/enums.js';
import type { ILFunction } from '../../../il/structures.js';
import type { ILInstruction } from '../../../il/instruction.js';
import { createSlotOperand, createLabelOperand } from '../../../il/factories.js';
import { SlotKind, SlotLocation } from '../../../frame/enums.js';
import type { FrameSlot } from '../../../frame/types.js';

// ============================================================================
// Test Helpers
// ============================================================================

/**
 * Create a minimal test slot.
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
 * Create a STORE_BYTE instruction.
 */
function createStoreInstr(slotName: string): ILInstruction {
  const slot = createTestSlot(slotName);
  return {
    opcode: ILOpcode.STORE_BYTE,
    operands: [createSlotOperand(slot)],
    defUse: { defs: [slotName], uses: [] },
  };
}

/**
 * Create a LOAD_BYTE instruction.
 */
function createLoadInstr(slotName: string): ILInstruction {
  const slot = createTestSlot(slotName);
  return {
    opcode: ILOpcode.LOAD_BYTE,
    operands: [createSlotOperand(slot)],
    defUse: { defs: [], uses: [slotName] },
  };
}

/**
 * Create a LOAD_IMM instruction.
 */
function createLoadImmInstr(value: number): ILInstruction {
  return {
    opcode: ILOpcode.LOAD_IMM,
    operands: [{ kind: 'immediate', value }],
    defUse: { defs: [], uses: [] },
  };
}

/**
 * Create a JUMP instruction.
 */
function createJumpInstr(label: string): ILInstruction {
  return {
    opcode: ILOpcode.JUMP,
    operands: [createLabelOperand(label)],
    defUse: { defs: [], uses: [] },
  };
}

/**
 * Create a LABEL instruction.
 */
function createLabelInstr(name: string): ILInstruction {
  return {
    opcode: ILOpcode.LABEL,
    operands: [createLabelOperand(name)],
    defUse: { defs: [], uses: [] },
  };
}

/**
 * Create a RETURN instruction.
 */
function createReturnInstr(): ILInstruction {
  return {
    opcode: ILOpcode.RETURN,
    operands: [],
    defUse: { defs: [], uses: [] },
  };
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
// DCEPass Interface Tests
// ============================================================================

describe('DCEPass interface', () => {
  it('should have correct name', () => {
    const dce = new DCEPass();
    expect(dce.name).toBe('dce');
  });

  it('should have no dependencies', () => {
    const dce = new DCEPass();
    expect(dce.dependencies).toEqual([]);
  });
});

// ============================================================================
// Dead Store Removal Tests
// ============================================================================

describe('DCEPass dead store removal', () => {
  it('should remove store to unused variable', () => {
    // x = 5; // x never read
    // return;
    const func = createTestFunction([
      createLoadImmInstr(5),
      createStoreInstr('x'),
      createReturnInstr(),
    ]);

    const dce = new DCEPass();
    const result = dce.run(func, { level: 'O2' });

    // Store to x should be removed
    expect(result.modified).toBe(true);
    expect(result.instructionsRemoved).toBe(1);
    expect(func.instructions).toHaveLength(2);
    // LOAD_IMM and RETURN remain
    expect(func.instructions[0].opcode).toBe(ILOpcode.LOAD_IMM);
    expect(func.instructions[1].opcode).toBe(ILOpcode.RETURN);
  });

  it('should NOT remove store to used variable', () => {
    // x = 5;
    // return x;
    const func = createTestFunction([
      createLoadImmInstr(5),
      createStoreInstr('x'),
      createLoadInstr('x'),
      createReturnInstr(),
    ]);

    const dce = new DCEPass();
    const result = dce.run(func, { level: 'O2' });

    // Store to x should NOT be removed (x is used)
    expect(result.modified).toBe(false);
    expect(result.instructionsRemoved).toBe(0);
    expect(func.instructions).toHaveLength(4);
  });

  it('should remove multiple dead stores', () => {
    // x = 5; // unused
    // y = 10; // unused
    // return;
    const func = createTestFunction([
      createLoadImmInstr(5),
      createStoreInstr('x'),
      createLoadImmInstr(10),
      createStoreInstr('y'),
      createReturnInstr(),
    ]);

    const dce = new DCEPass();
    const result = dce.run(func, { level: 'O2' });

    expect(result.modified).toBe(true);
    expect(result.instructionsRemoved).toBe(2);
    // Should have: LOAD_IMM 5, LOAD_IMM 10, RETURN
    expect(func.instructions).toHaveLength(3);
  });

  it('should remove only first store when variable is overwritten', () => {
    // x = 5; // overwritten before read
    // x = 10;
    // return x;
    const func = createTestFunction([
      createLoadImmInstr(5),
      createStoreInstr('x'),
      createLoadImmInstr(10),
      createStoreInstr('x'),
      createLoadInstr('x'),
      createReturnInstr(),
    ]);

    const dce = new DCEPass();
    const result = dce.run(func, { level: 'O2' });

    // First store should be dead
    expect(result.modified).toBe(true);
    expect(result.instructionsRemoved).toBe(1);
    expect(func.instructions).toHaveLength(5);
  });
});

// ============================================================================
// Unreachable Code Removal Tests
// ============================================================================

describe('DCEPass unreachable code removal', () => {
  it('should remove code after unconditional jump', () => {
    // JUMP .exit
    // LOAD_IMM 5  <- unreachable
    // STORE_BYTE x <- unreachable
    // .exit:
    // RETURN
    const func = createTestFunction([
      createJumpInstr('exit'),
      createLoadImmInstr(5),
      createStoreInstr('x'),
      createLabelInstr('exit'),
      createReturnInstr(),
    ]);

    const dce = new DCEPass();
    const result = dce.run(func, { level: 'O2' });

    expect(result.modified).toBe(true);
    expect(result.instructionsRemoved).toBe(2);
    // Should have: JUMP, LABEL, RETURN
    expect(func.instructions).toHaveLength(3);
    expect(func.instructions[0].opcode).toBe(ILOpcode.JUMP);
    expect(func.instructions[1].opcode).toBe(ILOpcode.LABEL);
    expect(func.instructions[2].opcode).toBe(ILOpcode.RETURN);
  });

  it('should remove code after return', () => {
    // RETURN
    // LOAD_IMM 5 <- unreachable
    // .label:
    // RETURN
    const func = createTestFunction([
      createReturnInstr(),
      createLoadImmInstr(5),
      createLabelInstr('label'),
      createReturnInstr(),
    ]);

    const dce = new DCEPass();
    const result = dce.run(func, { level: 'O2' });

    expect(result.modified).toBe(true);
    expect(result.instructionsRemoved).toBe(1);
    // LOAD_IMM should be removed but LABEL makes code reachable again
    expect(func.instructions).toHaveLength(3);
  });

  it('should NOT remove code after label (code is reachable)', () => {
    // JUMP .skip
    // LOAD_IMM 5 <- unreachable
    // .skip:
    // LOAD_IMM 10 <- reachable (after label)
    // RETURN
    const func = createTestFunction([
      createJumpInstr('skip'),
      createLoadImmInstr(5),
      createLabelInstr('skip'),
      createLoadImmInstr(10),
      createReturnInstr(),
    ]);

    const dce = new DCEPass();
    const result = dce.run(func, { level: 'O2' });

    // LOAD_IMM 5 should be removed, but LOAD_IMM 10 should remain
    expect(func.instructions).toHaveLength(4);
    expect(func.instructions[2].opcode).toBe(ILOpcode.LOAD_IMM);
  });
});

// ============================================================================
// No False Positives Tests
// ============================================================================

describe('DCEPass no false positives', () => {
  it('should not remove any instructions when all are live', () => {
    // x = 5;
    // return x;
    const func = createTestFunction([
      createLoadImmInstr(5),
      createStoreInstr('x'),
      createLoadInstr('x'),
      createReturnInstr(),
    ]);

    const dce = new DCEPass();
    const result = dce.run(func, { level: 'O2' });

    expect(result.modified).toBe(false);
    expect(func.instructions).toHaveLength(4);
  });

  it('should handle empty function', () => {
    const func = createTestFunction([]);

    const dce = new DCEPass();
    const result = dce.run(func, { level: 'O2' });

    expect(result.modified).toBe(false);
    expect(func.instructions).toHaveLength(0);
  });

  it('should handle function with only return', () => {
    const func = createTestFunction([createReturnInstr()]);

    const dce = new DCEPass();
    const result = dce.run(func, { level: 'O2' });

    expect(result.modified).toBe(false);
    expect(func.instructions).toHaveLength(1);
  });
});

// ============================================================================
// Debug Output Tests
// ============================================================================

describe('DCEPass debug output', () => {
  it('should include debug info when debug=true', () => {
    const func = createTestFunction([
      createLoadImmInstr(5),
      createStoreInstr('x'),
      createReturnInstr(),
    ]);

    const dce = new DCEPass();
    const result = dce.run(func, { level: 'O2', debug: true });

    expect(result.debugInfo).toBeDefined();
    expect(result.debugInfo!.length).toBeGreaterThan(0);
    expect(result.debugInfo![0]).toContain('Dead store');
  });

  it('should not include debug info when debug=false', () => {
    const func = createTestFunction([
      createLoadImmInstr(5),
      createStoreInstr('x'),
      createReturnInstr(),
    ]);

    const dce = new DCEPass();
    const result = dce.run(func, { level: 'O2', debug: false });

    expect(result.debugInfo).toBeUndefined();
  });
});

// ============================================================================
// Integration with PassManager Tests
// ============================================================================

describe('DCEPass integration', () => {
  it('should work with PassManager', async () => {
    const { PassManager } = await import('../../../optimizer/pass-manager.js');

    const manager = new PassManager({
      level: 'O2',
      enabledPasses: ['dce'],
    });
    manager.registerPass(new DCEPass());

    const func = createTestFunction([
      createLoadImmInstr(5),
      createStoreInstr('x'),
      createReturnInstr(),
    ]);

    const result = manager.optimize(func);

    expect(result.modified).toBe(true);
    expect(result.stats).toHaveLength(1);
    expect(result.stats[0].pass).toBe('dce');
  });
});