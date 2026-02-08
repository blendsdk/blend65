/**
 * Tests for IL Peephole Optimization Pass
 *
 * @module __tests__/optimizer/passes/il-peephole.test
 */

import { describe, it, expect } from 'vitest';
import { ILPeepholePass } from '../../../optimizer/passes/il-peephole.js';
import { ILOpcode } from '../../../il/enums.js';
import type { ILFunction } from '../../../il/structures.js';
import type { ILInstruction } from '../../../il/instruction.js';
import {
  createSlotOperand,
  createImmediateOperand,
  createLabelOperand,
} from '../../../il/factories.js';
import { SlotKind, SlotLocation } from '../../../frame/enums.js';
import type { FrameSlot } from '../../../frame/types.js';
import { isImmediateOperand } from '../../../il/guards.js';

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

function createSubImmInstr(value: number): ILInstruction {
  return {
    opcode: ILOpcode.SUB_IMM,
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

function createXorImmInstr(value: number): ILInstruction {
  return {
    opcode: ILOpcode.XOR_IMM,
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

function createShlByteInstr(count: number): ILInstruction {
  return {
    opcode: ILOpcode.SHL_BYTE,
    operands: [createImmediateOperand(count, false)],
    defUse: { defs: [], uses: [] },
  };
}

function createShrByteInstr(count: number): ILInstruction {
  return {
    opcode: ILOpcode.SHR_BYTE,
    operands: [createImmediateOperand(count, false)],
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

function getImmValue(instr: ILInstruction): number | null {
  if (instr.operands.length === 0) return null;
  const op = instr.operands[0];
  return isImmediateOperand(op) ? op.value : null;
}

// ============================================================================
// ILPeepholePass Interface Tests
// ============================================================================

describe('ILPeepholePass interface', () => {
  it('should have correct name', () => {
    const pass = new ILPeepholePass();
    expect(pass.name).toBe('il-peephole');
  });

  it('should have no dependencies', () => {
    const pass = new ILPeepholePass();
    expect(pass.dependencies).toEqual([]);
  });
});

// ============================================================================
// Identity Elimination Tests
// ============================================================================

describe('ILPeepholePass identity elimination', () => {
  it('should remove ADD_IMM 0', () => {
    const func = createTestFunction([
      createLoadImmInstr(5),
      createAddImmInstr(0),
      createReturnInstr(),
    ]);

    const pass = new ILPeepholePass();
    const result = pass.run(func, { level: 'O2' });

    expect(result.modified).toBe(true);
    expect(func.instructions).toHaveLength(2);
    expect(func.instructions[0].opcode).toBe(ILOpcode.LOAD_IMM);
    expect(func.instructions[1].opcode).toBe(ILOpcode.RETURN);
  });

  it('should NOT remove ADD_IMM non-zero', () => {
    const func = createTestFunction([
      createLoadImmInstr(5),
      createAddImmInstr(3),
      createReturnInstr(),
    ]);

    const pass = new ILPeepholePass();
    pass.run(func, { level: 'O2' });

    expect(func.instructions).toHaveLength(3);
    expect(func.instructions[1].opcode).toBe(ILOpcode.ADD_IMM);
  });

  it('should remove SUB_IMM 0', () => {
    const func = createTestFunction([
      createLoadImmInstr(10),
      createSubImmInstr(0),
      createReturnInstr(),
    ]);

    const pass = new ILPeepholePass();
    const result = pass.run(func, { level: 'O2' });

    expect(result.modified).toBe(true);
    expect(func.instructions).toHaveLength(2);
  });

  it('should remove OR_IMM 0', () => {
    const func = createTestFunction([
      createLoadImmInstr(0xaa),
      createOrImmInstr(0),
      createReturnInstr(),
    ]);

    const pass = new ILPeepholePass();
    const result = pass.run(func, { level: 'O2' });

    expect(result.modified).toBe(true);
    expect(func.instructions).toHaveLength(2);
  });

  it('should remove XOR_IMM 0', () => {
    const func = createTestFunction([
      createLoadImmInstr(0x55),
      createXorImmInstr(0),
      createReturnInstr(),
    ]);

    const pass = new ILPeepholePass();
    const result = pass.run(func, { level: 'O2' });

    expect(result.modified).toBe(true);
    expect(func.instructions).toHaveLength(2);
  });

  it('should remove AND_IMM 0xFF', () => {
    const func = createTestFunction([
      createLoadImmInstr(0x42),
      createAndImmInstr(0xff),
      createReturnInstr(),
    ]);

    const pass = new ILPeepholePass();
    const result = pass.run(func, { level: 'O2' });

    expect(result.modified).toBe(true);
    expect(func.instructions).toHaveLength(2);
  });

  it('should NOT remove AND_IMM with other values', () => {
    const func = createTestFunction([
      createLoadImmInstr(0xff),
      createAndImmInstr(0x0f),
      createReturnInstr(),
    ]);

    const pass = new ILPeepholePass();
    pass.run(func, { level: 'O2' });

    expect(func.instructions).toHaveLength(3);
    expect(func.instructions[1].opcode).toBe(ILOpcode.AND_IMM);
  });

  it('should remove SHL_BYTE 0', () => {
    const func = createTestFunction([
      createLoadImmInstr(8),
      createShlByteInstr(0),
      createReturnInstr(),
    ]);

    const pass = new ILPeepholePass();
    const result = pass.run(func, { level: 'O2' });

    expect(result.modified).toBe(true);
    expect(func.instructions).toHaveLength(2);
  });

  it('should remove SHR_BYTE 0', () => {
    const func = createTestFunction([
      createLoadImmInstr(16),
      createShrByteInstr(0),
      createReturnInstr(),
    ]);

    const pass = new ILPeepholePass();
    const result = pass.run(func, { level: 'O2' });

    expect(result.modified).toBe(true);
    expect(func.instructions).toHaveLength(2);
  });

  it('should remove multiple identity operations', () => {
    const func = createTestFunction([
      createLoadImmInstr(1),
      createAddImmInstr(0),
      createSubImmInstr(0),
      createOrImmInstr(0),
      createReturnInstr(),
    ]);

    const pass = new ILPeepholePass();
    const result = pass.run(func, { level: 'O2' });

    expect(result.modified).toBe(true);
    expect(result.instructionsRemoved).toBe(3);
    expect(func.instructions).toHaveLength(2);
  });
});

// ============================================================================
// Strength Reduction Tests
// ============================================================================

describe('ILPeepholePass strength reduction', () => {
  it('should reduce AND_IMM 0 to LOAD_IMM 0', () => {
    const func = createTestFunction([
      createLoadImmInstr(0xff),
      createAndImmInstr(0),
      createReturnInstr(),
    ]);

    const pass = new ILPeepholePass();
    const result = pass.run(func, { level: 'O2' });

    expect(result.modified).toBe(true);
    expect(func.instructions[1].opcode).toBe(ILOpcode.LOAD_IMM);
    expect(getImmValue(func.instructions[1])).toBe(0);
  });

  it('should reduce OR_IMM 0xFF to LOAD_IMM 0xFF', () => {
    const func = createTestFunction([
      createLoadImmInstr(0),
      createOrImmInstr(0xff),
      createReturnInstr(),
    ]);

    const pass = new ILPeepholePass();
    const result = pass.run(func, { level: 'O2' });

    expect(result.modified).toBe(true);
    expect(func.instructions[1].opcode).toBe(ILOpcode.LOAD_IMM);
    expect(getImmValue(func.instructions[1])).toBe(0xff);
  });
});

// ============================================================================
// Load-Store Elimination Tests
// ============================================================================

describe('ILPeepholePass load-store elimination', () => {
  it('should remove LOAD x; STORE x pair', () => {
    const func = createTestFunction([
      createLoadByteInstr('x'),
      createStoreByteInstr('x'),
      createReturnInstr(),
    ]);

    const pass = new ILPeepholePass();
    const result = pass.run(func, { level: 'O2' });

    expect(result.modified).toBe(true);
    expect(func.instructions).toHaveLength(1);
    expect(func.instructions[0].opcode).toBe(ILOpcode.RETURN);
  });

  it('should NOT remove LOAD x; STORE y', () => {
    const func = createTestFunction([
      createLoadByteInstr('x'),
      createStoreByteInstr('y'),
      createReturnInstr(),
    ]);

    const pass = new ILPeepholePass();
    pass.run(func, { level: 'O2' });

    expect(func.instructions).toHaveLength(3);
    expect(func.instructions[0].opcode).toBe(ILOpcode.LOAD_BYTE);
    expect(func.instructions[1].opcode).toBe(ILOpcode.STORE_BYTE);
  });

  it('should remove redundant LOAD after STORE', () => {
    // STORE x; LOAD x → just STORE x (value already in A)
    const func = createTestFunction([
      createLoadImmInstr(42),
      createStoreByteInstr('x'),
      createLoadByteInstr('x'),
      createReturnInstr(),
    ]);

    const pass = new ILPeepholePass();
    const result = pass.run(func, { level: 'O2' });

    expect(result.modified).toBe(true);
    expect(func.instructions).toHaveLength(3);
    expect(func.instructions[0].opcode).toBe(ILOpcode.LOAD_IMM);
    expect(func.instructions[1].opcode).toBe(ILOpcode.STORE_BYTE);
    expect(func.instructions[2].opcode).toBe(ILOpcode.RETURN);
  });

  it('should NOT remove LOAD after STORE to different slot', () => {
    const func = createTestFunction([
      createLoadImmInstr(42),
      createStoreByteInstr('x'),
      createLoadByteInstr('y'),
      createReturnInstr(),
    ]);

    const pass = new ILPeepholePass();
    pass.run(func, { level: 'O2' });

    expect(func.instructions).toHaveLength(4);
  });

  it('should handle multiple load-store patterns', () => {
    const func = createTestFunction([
      createLoadByteInstr('a'),
      createStoreByteInstr('a'),
      createLoadByteInstr('b'),
      createStoreByteInstr('b'),
      createReturnInstr(),
    ]);

    const pass = new ILPeepholePass();
    const result = pass.run(func, { level: 'O2' });

    expect(result.modified).toBe(true);
    expect(func.instructions).toHaveLength(1);
    expect(func.instructions[0].opcode).toBe(ILOpcode.RETURN);
  });
});

// ============================================================================
// Combined Pattern Tests
// ============================================================================

describe('ILPeepholePass combined patterns', () => {
  it('should apply multiple optimization patterns', () => {
    const func = createTestFunction([
      createLoadImmInstr(5),
      createAddImmInstr(0), // Identity - remove
      createAndImmInstr(0xff), // Identity - remove
      createStoreByteInstr('x'),
      createLoadByteInstr('x'), // Redundant load - remove
      createReturnInstr(),
    ]);

    const pass = new ILPeepholePass();
    const result = pass.run(func, { level: 'O2' });

    expect(result.modified).toBe(true);
    expect(func.instructions).toHaveLength(3);
    expect(func.instructions[0].opcode).toBe(ILOpcode.LOAD_IMM);
    expect(func.instructions[1].opcode).toBe(ILOpcode.STORE_BYTE);
    expect(func.instructions[2].opcode).toBe(ILOpcode.RETURN);
  });

  it('should handle empty function', () => {
    const func = createTestFunction([]);

    const pass = new ILPeepholePass();
    const result = pass.run(func, { level: 'O2' });

    expect(result.modified).toBe(false);
    expect(func.instructions).toHaveLength(0);
  });

  it('should handle single instruction', () => {
    const func = createTestFunction([createReturnInstr()]);

    const pass = new ILPeepholePass();
    const result = pass.run(func, { level: 'O2' });

    expect(result.modified).toBe(false);
    expect(func.instructions).toHaveLength(1);
  });
});

// ============================================================================
// Debug Output Tests
// ============================================================================

describe('ILPeepholePass debug output', () => {
  it('should include debug info when debug=true', () => {
    const func = createTestFunction([
      createLoadImmInstr(1),
      createAddImmInstr(0),
      createReturnInstr(),
    ]);

    const pass = new ILPeepholePass();
    const result = pass.run(func, { level: 'O2', debug: true });

    expect(result.debugInfo).toBeDefined();
    expect(result.debugInfo!.length).toBeGreaterThan(0);
    expect(result.debugInfo![0]).toContain('Identity elimination');
  });

  it('should not include debug info when debug=false', () => {
    const func = createTestFunction([
      createLoadImmInstr(1),
      createAddImmInstr(0),
      createReturnInstr(),
    ]);

    const pass = new ILPeepholePass();
    const result = pass.run(func, { level: 'O2', debug: false });

    expect(result.debugInfo).toBeUndefined();
  });
});

// ============================================================================
// Integration Tests
// ============================================================================

describe('ILPeepholePass integration', () => {
  it('should work with PassManager', async () => {
    const { PassManager } = await import('../../../optimizer/pass-manager.js');

    const manager = new PassManager({
      level: 'O2',
      enabledPasses: ['il-peephole'],
    });
    manager.registerPass(new ILPeepholePass());

    const func = createTestFunction([
      createLoadImmInstr(10),
      createAddImmInstr(0),
      createReturnInstr(),
    ]);

    const result = manager.optimize(func);

    expect(result.modified).toBe(true);
    expect(result.stats).toHaveLength(1);
    expect(result.stats[0].pass).toBe('il-peephole');
  });
});