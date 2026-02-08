/**
 * Tests for Constant Folding Pass
 *
 * @module __tests__/optimizer/passes/constant-fold.test
 */

import { describe, it, expect } from 'vitest';
import { ConstantFoldPass } from '../../../optimizer/passes/constant-fold.js';
import { ILOpcode } from '../../../il/enums.js';
import type { ILFunction } from '../../../il/structures.js';
import type { ILInstruction } from '../../../il/instruction.js';
import { createSlotOperand, createImmediateOperand } from '../../../il/factories.js';
import { SlotKind, SlotLocation } from '../../../frame/enums.js';
import type { FrameSlot } from '../../../frame/types.js';
import { isImmediateOperand } from '../../../il/guards.js';

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
 * Create a LOAD_IMM instruction.
 */
function createLoadImmInstr(value: number): ILInstruction {
  return {
    opcode: ILOpcode.LOAD_IMM,
    operands: [createImmediateOperand(value, false)],
    defUse: { defs: [], uses: [] },
  };
}

/**
 * Create an ADD_IMM instruction.
 */
function createAddImmInstr(value: number): ILInstruction {
  return {
    opcode: ILOpcode.ADD_IMM,
    operands: [createImmediateOperand(value, false)],
    defUse: { defs: [], uses: [] },
  };
}

/**
 * Create a SUB_IMM instruction.
 */
function createSubImmInstr(value: number): ILInstruction {
  return {
    opcode: ILOpcode.SUB_IMM,
    operands: [createImmediateOperand(value, false)],
    defUse: { defs: [], uses: [] },
  };
}

/**
 * Create an AND_IMM instruction.
 */
function createAndImmInstr(value: number): ILInstruction {
  return {
    opcode: ILOpcode.AND_IMM,
    operands: [createImmediateOperand(value, false)],
    defUse: { defs: [], uses: [] },
  };
}

/**
 * Create an OR_IMM instruction.
 */
function createOrImmInstr(value: number): ILInstruction {
  return {
    opcode: ILOpcode.OR_IMM,
    operands: [createImmediateOperand(value, false)],
    defUse: { defs: [], uses: [] },
  };
}

/**
 * Create a XOR_IMM instruction.
 */
function createXorImmInstr(value: number): ILInstruction {
  return {
    opcode: ILOpcode.XOR_IMM,
    operands: [createImmediateOperand(value, false)],
    defUse: { defs: [], uses: [] },
  };
}

/**
 * Create a SHL_BYTE instruction.
 */
function createShlInstr(count: number): ILInstruction {
  return {
    opcode: ILOpcode.SHL_BYTE,
    operands: [createImmediateOperand(count, false)],
    defUse: { defs: [], uses: [] },
  };
}

/**
 * Create a SHR_BYTE instruction.
 */
function createShrInstr(count: number): ILInstruction {
  return {
    opcode: ILOpcode.SHR_BYTE,
    operands: [createImmediateOperand(count, false)],
    defUse: { defs: [], uses: [] },
  };
}

/**
 * Create a LOAD_BYTE instruction.
 */
function createLoadByteInstr(slotName: string): ILInstruction {
  const slot = createTestSlot(slotName);
  return {
    opcode: ILOpcode.LOAD_BYTE,
    operands: [createSlotOperand(slot)],
    defUse: { defs: [], uses: [slotName] },
  };
}

/**
 * Create a STORE_BYTE instruction.
 */
function createStoreByteInstr(slotName: string): ILInstruction {
  const slot = createTestSlot(slotName);
  return {
    opcode: ILOpcode.STORE_BYTE,
    operands: [createSlotOperand(slot)],
    defUse: { defs: [slotName], uses: [] },
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

/**
 * Get immediate value from instruction.
 */
function getImmValue(instr: ILInstruction): number | null {
  if (instr.operands.length === 0) return null;
  const op = instr.operands[0];
  return isImmediateOperand(op) ? op.value : null;
}

// ============================================================================
// ConstantFoldPass Interface Tests
// ============================================================================

describe('ConstantFoldPass interface', () => {
  it('should have correct name', () => {
    const fold = new ConstantFoldPass();
    expect(fold.name).toBe('constant-fold');
  });

  it('should have no dependencies', () => {
    const fold = new ConstantFoldPass();
    expect(fold.dependencies).toEqual([]);
  });
});

// ============================================================================
// ADD Folding Tests
// ============================================================================

describe('ConstantFoldPass ADD folding', () => {
  it('should fold 5 + 3 to 8', () => {
    const func = createTestFunction([
      createLoadImmInstr(5),
      createAddImmInstr(3),
      createReturnInstr(),
    ]);

    const fold = new ConstantFoldPass();
    const result = fold.run(func, { level: 'O1' });

    expect(result.modified).toBe(true);
    expect(result.instructionsRemoved).toBe(1);
    expect(func.instructions).toHaveLength(2);
    expect(func.instructions[0].opcode).toBe(ILOpcode.LOAD_IMM);
    expect(getImmValue(func.instructions[0])).toBe(8);
  });

  it('should fold 0 + 0 to 0', () => {
    const func = createTestFunction([
      createLoadImmInstr(0),
      createAddImmInstr(0),
      createReturnInstr(),
    ]);

    const fold = new ConstantFoldPass();
    fold.run(func, { level: 'O1' });

    expect(getImmValue(func.instructions[0])).toBe(0);
  });

  it('should fold 255 + 1 to 0 (overflow wrap)', () => {
    const func = createTestFunction([
      createLoadImmInstr(255),
      createAddImmInstr(1),
      createReturnInstr(),
    ]);

    const fold = new ConstantFoldPass();
    fold.run(func, { level: 'O1' });

    expect(getImmValue(func.instructions[0])).toBe(0);
  });

  it('should fold 250 + 10 to 4 (overflow wrap)', () => {
    const func = createTestFunction([
      createLoadImmInstr(250),
      createAddImmInstr(10),
      createReturnInstr(),
    ]);

    const fold = new ConstantFoldPass();
    fold.run(func, { level: 'O1' });

    expect(getImmValue(func.instructions[0])).toBe(4);
  });
});

// ============================================================================
// SUB Folding Tests
// ============================================================================

describe('ConstantFoldPass SUB folding', () => {
  it('should fold 10 - 3 to 7', () => {
    const func = createTestFunction([
      createLoadImmInstr(10),
      createSubImmInstr(3),
      createReturnInstr(),
    ]);

    const fold = new ConstantFoldPass();
    const result = fold.run(func, { level: 'O1' });

    expect(result.modified).toBe(true);
    expect(func.instructions).toHaveLength(2);
    expect(getImmValue(func.instructions[0])).toBe(7);
  });

  it('should fold 5 - 5 to 0', () => {
    const func = createTestFunction([
      createLoadImmInstr(5),
      createSubImmInstr(5),
      createReturnInstr(),
    ]);

    const fold = new ConstantFoldPass();
    fold.run(func, { level: 'O1' });

    expect(getImmValue(func.instructions[0])).toBe(0);
  });

  it('should fold 0 - 1 to 255 (underflow wrap)', () => {
    const func = createTestFunction([
      createLoadImmInstr(0),
      createSubImmInstr(1),
      createReturnInstr(),
    ]);

    const fold = new ConstantFoldPass();
    fold.run(func, { level: 'O1' });

    expect(getImmValue(func.instructions[0])).toBe(255);
  });

  it('should fold 5 - 10 to 251 (underflow wrap)', () => {
    const func = createTestFunction([
      createLoadImmInstr(5),
      createSubImmInstr(10),
      createReturnInstr(),
    ]);

    const fold = new ConstantFoldPass();
    fold.run(func, { level: 'O1' });

    expect(getImmValue(func.instructions[0])).toBe(251);
  });
});

// ============================================================================
// AND Folding Tests
// ============================================================================

describe('ConstantFoldPass AND folding', () => {
  it('should fold 255 & 15 to 15', () => {
    const func = createTestFunction([
      createLoadImmInstr(255),
      createAndImmInstr(15),
      createReturnInstr(),
    ]);

    const fold = new ConstantFoldPass();
    fold.run(func, { level: 'O1' });

    expect(getImmValue(func.instructions[0])).toBe(15);
  });

  it('should fold 0b11110000 & 0b00001111 to 0', () => {
    const func = createTestFunction([
      createLoadImmInstr(0b11110000),
      createAndImmInstr(0b00001111),
      createReturnInstr(),
    ]);

    const fold = new ConstantFoldPass();
    fold.run(func, { level: 'O1' });

    expect(getImmValue(func.instructions[0])).toBe(0);
  });

  it('should fold 255 & 0 to 0', () => {
    const func = createTestFunction([
      createLoadImmInstr(255),
      createAndImmInstr(0),
      createReturnInstr(),
    ]);

    const fold = new ConstantFoldPass();
    fold.run(func, { level: 'O1' });

    expect(getImmValue(func.instructions[0])).toBe(0);
  });

  it('should fold 42 & 255 to 42', () => {
    const func = createTestFunction([
      createLoadImmInstr(42),
      createAndImmInstr(255),
      createReturnInstr(),
    ]);

    const fold = new ConstantFoldPass();
    fold.run(func, { level: 'O1' });

    expect(getImmValue(func.instructions[0])).toBe(42);
  });
});

// ============================================================================
// OR Folding Tests
// ============================================================================

describe('ConstantFoldPass OR folding', () => {
  it('should fold 240 | 15 to 255', () => {
    const func = createTestFunction([
      createLoadImmInstr(240),
      createOrImmInstr(15),
      createReturnInstr(),
    ]);

    const fold = new ConstantFoldPass();
    fold.run(func, { level: 'O1' });

    expect(getImmValue(func.instructions[0])).toBe(255);
  });

  it('should fold 0 | 0 to 0', () => {
    const func = createTestFunction([
      createLoadImmInstr(0),
      createOrImmInstr(0),
      createReturnInstr(),
    ]);

    const fold = new ConstantFoldPass();
    fold.run(func, { level: 'O1' });

    expect(getImmValue(func.instructions[0])).toBe(0);
  });

  it('should fold 0 | 255 to 255', () => {
    const func = createTestFunction([
      createLoadImmInstr(0),
      createOrImmInstr(255),
      createReturnInstr(),
    ]);

    const fold = new ConstantFoldPass();
    fold.run(func, { level: 'O1' });

    expect(getImmValue(func.instructions[0])).toBe(255);
  });

  it('should fold 0b10101010 | 0b01010101 to 255', () => {
    const func = createTestFunction([
      createLoadImmInstr(0b10101010),
      createOrImmInstr(0b01010101),
      createReturnInstr(),
    ]);

    const fold = new ConstantFoldPass();
    fold.run(func, { level: 'O1' });

    expect(getImmValue(func.instructions[0])).toBe(255);
  });
});

// ============================================================================
// XOR Folding Tests
// ============================================================================

describe('ConstantFoldPass XOR folding', () => {
  it('should fold 255 ^ 255 to 0', () => {
    const func = createTestFunction([
      createLoadImmInstr(255),
      createXorImmInstr(255),
      createReturnInstr(),
    ]);

    const fold = new ConstantFoldPass();
    fold.run(func, { level: 'O1' });

    expect(getImmValue(func.instructions[0])).toBe(0);
  });

  it('should fold 0 ^ 255 to 255', () => {
    const func = createTestFunction([
      createLoadImmInstr(0),
      createXorImmInstr(255),
      createReturnInstr(),
    ]);

    const fold = new ConstantFoldPass();
    fold.run(func, { level: 'O1' });

    expect(getImmValue(func.instructions[0])).toBe(255);
  });

  it('should fold 0b10101010 ^ 0b01010101 to 255', () => {
    const func = createTestFunction([
      createLoadImmInstr(0b10101010),
      createXorImmInstr(0b01010101),
      createReturnInstr(),
    ]);

    const fold = new ConstantFoldPass();
    fold.run(func, { level: 'O1' });

    expect(getImmValue(func.instructions[0])).toBe(255);
  });

  it('should fold 42 ^ 0 to 42', () => {
    const func = createTestFunction([
      createLoadImmInstr(42),
      createXorImmInstr(0),
      createReturnInstr(),
    ]);

    const fold = new ConstantFoldPass();
    fold.run(func, { level: 'O1' });

    expect(getImmValue(func.instructions[0])).toBe(42);
  });
});

// ============================================================================
// SHL Folding Tests
// ============================================================================

describe('ConstantFoldPass SHL folding', () => {
  it('should fold 1 << 4 to 16', () => {
    const func = createTestFunction([
      createLoadImmInstr(1),
      createShlInstr(4),
      createReturnInstr(),
    ]);

    const fold = new ConstantFoldPass();
    fold.run(func, { level: 'O1' });

    expect(getImmValue(func.instructions[0])).toBe(16);
  });

  it('should fold 1 << 0 to 1', () => {
    const func = createTestFunction([
      createLoadImmInstr(1),
      createShlInstr(0),
      createReturnInstr(),
    ]);

    const fold = new ConstantFoldPass();
    fold.run(func, { level: 'O1' });

    expect(getImmValue(func.instructions[0])).toBe(1);
  });

  it('should fold 1 << 7 to 128', () => {
    const func = createTestFunction([
      createLoadImmInstr(1),
      createShlInstr(7),
      createReturnInstr(),
    ]);

    const fold = new ConstantFoldPass();
    fold.run(func, { level: 'O1' });

    expect(getImmValue(func.instructions[0])).toBe(128);
  });

  it('should fold 1 << 8 to 0 (overflow)', () => {
    const func = createTestFunction([
      createLoadImmInstr(1),
      createShlInstr(8),
      createReturnInstr(),
    ]);

    const fold = new ConstantFoldPass();
    fold.run(func, { level: 'O1' });

    expect(getImmValue(func.instructions[0])).toBe(0);
  });

  it('should fold 3 << 2 to 12', () => {
    const func = createTestFunction([
      createLoadImmInstr(3),
      createShlInstr(2),
      createReturnInstr(),
    ]);

    const fold = new ConstantFoldPass();
    fold.run(func, { level: 'O1' });

    expect(getImmValue(func.instructions[0])).toBe(12);
  });
});

// ============================================================================
// SHR Folding Tests
// ============================================================================

describe('ConstantFoldPass SHR folding', () => {
  it('should fold 128 >> 2 to 32', () => {
    const func = createTestFunction([
      createLoadImmInstr(128),
      createShrInstr(2),
      createReturnInstr(),
    ]);

    const fold = new ConstantFoldPass();
    fold.run(func, { level: 'O1' });

    expect(getImmValue(func.instructions[0])).toBe(32);
  });

  it('should fold 255 >> 4 to 15', () => {
    const func = createTestFunction([
      createLoadImmInstr(255),
      createShrInstr(4),
      createReturnInstr(),
    ]);

    const fold = new ConstantFoldPass();
    fold.run(func, { level: 'O1' });

    expect(getImmValue(func.instructions[0])).toBe(15);
  });

  it('should fold 1 >> 1 to 0', () => {
    const func = createTestFunction([
      createLoadImmInstr(1),
      createShrInstr(1),
      createReturnInstr(),
    ]);

    const fold = new ConstantFoldPass();
    fold.run(func, { level: 'O1' });

    expect(getImmValue(func.instructions[0])).toBe(0);
  });

  it('should fold 42 >> 0 to 42', () => {
    const func = createTestFunction([
      createLoadImmInstr(42),
      createShrInstr(0),
      createReturnInstr(),
    ]);

    const fold = new ConstantFoldPass();
    fold.run(func, { level: 'O1' });

    expect(getImmValue(func.instructions[0])).toBe(42);
  });
});

// ============================================================================
// No Fold Tests (Non-Foldable Cases)
// ============================================================================

describe('ConstantFoldPass no fold cases', () => {
  it('should NOT fold LOAD_BYTE + ADD_IMM', () => {
    // x is loaded from memory, not immediate
    const func = createTestFunction([
      createLoadByteInstr('x'),
      createAddImmInstr(5),
      createReturnInstr(),
    ]);

    const fold = new ConstantFoldPass();
    const result = fold.run(func, { level: 'O1' });

    expect(result.modified).toBe(false);
    expect(func.instructions).toHaveLength(3);
    expect(func.instructions[0].opcode).toBe(ILOpcode.LOAD_BYTE);
    expect(func.instructions[1].opcode).toBe(ILOpcode.ADD_IMM);
  });

  it('should NOT fold LOAD_IMM followed by STORE_BYTE', () => {
    const func = createTestFunction([
      createLoadImmInstr(5),
      createStoreByteInstr('x'),
      createReturnInstr(),
    ]);

    const fold = new ConstantFoldPass();
    const result = fold.run(func, { level: 'O1' });

    expect(result.modified).toBe(false);
    expect(func.instructions).toHaveLength(3);
  });

  it('should NOT fold LOAD_IMM followed by non-foldable opcode', () => {
    // CMP_IMM doesn't produce a foldable value
    const func = createTestFunction([
      createLoadImmInstr(5),
      {
        opcode: ILOpcode.CMP_IMM,
        operands: [createImmediateOperand(3, false)],
        defUse: { defs: [], uses: [] },
      },
      createReturnInstr(),
    ]);

    const fold = new ConstantFoldPass();
    const result = fold.run(func, { level: 'O1' });

    expect(result.modified).toBe(false);
    expect(func.instructions).toHaveLength(3);
  });
});

// ============================================================================
// Multiple Folds Tests
// ============================================================================

describe('ConstantFoldPass multiple folds', () => {
  it('should fold multiple independent sequences', () => {
    // let a = 5 + 3;  // foldable
    // let b = 10 - 2; // foldable
    const func = createTestFunction([
      createLoadImmInstr(5),
      createAddImmInstr(3),
      createStoreByteInstr('a'),
      createLoadImmInstr(10),
      createSubImmInstr(2),
      createStoreByteInstr('b'),
      createReturnInstr(),
    ]);

    const fold = new ConstantFoldPass();
    const result = fold.run(func, { level: 'O1' });

    expect(result.modified).toBe(true);
    expect(result.instructionsRemoved).toBe(2);
    // Original: 7 instructions, after: 5 instructions
    expect(func.instructions).toHaveLength(5);
    // First fold: 5+3=8
    expect(func.instructions[0].opcode).toBe(ILOpcode.LOAD_IMM);
    expect(getImmValue(func.instructions[0])).toBe(8);
    // Second fold: 10-2=8
    expect(func.instructions[2].opcode).toBe(ILOpcode.LOAD_IMM);
    expect(getImmValue(func.instructions[2])).toBe(8);
  });

  it('should handle interleaved foldable and non-foldable', () => {
    // let a = 5 + 3;      // foldable
    // let b = x + 1;      // NOT foldable (x from memory)
    // let c = 7 & 3;      // foldable
    const func = createTestFunction([
      createLoadImmInstr(5),
      createAddImmInstr(3),
      createStoreByteInstr('a'),
      createLoadByteInstr('x'),
      createAddImmInstr(1),
      createStoreByteInstr('b'),
      createLoadImmInstr(7),
      createAndImmInstr(3),
      createStoreByteInstr('c'),
      createReturnInstr(),
    ]);

    const fold = new ConstantFoldPass();
    const result = fold.run(func, { level: 'O1' });

    expect(result.modified).toBe(true);
    expect(result.instructionsRemoved).toBe(2);
    expect(func.instructions).toHaveLength(8);
  });
});

// ============================================================================
// Empty/Edge Case Tests
// ============================================================================

describe('ConstantFoldPass edge cases', () => {
  it('should handle empty function', () => {
    const func = createTestFunction([]);

    const fold = new ConstantFoldPass();
    const result = fold.run(func, { level: 'O1' });

    expect(result.modified).toBe(false);
    expect(func.instructions).toHaveLength(0);
  });

  it('should handle function with only return', () => {
    const func = createTestFunction([createReturnInstr()]);

    const fold = new ConstantFoldPass();
    const result = fold.run(func, { level: 'O1' });

    expect(result.modified).toBe(false);
    expect(func.instructions).toHaveLength(1);
  });

  it('should handle LOAD_IMM at end (nothing to fold)', () => {
    const func = createTestFunction([
      createStoreByteInstr('x'),
      createLoadImmInstr(5),
    ]);

    const fold = new ConstantFoldPass();
    const result = fold.run(func, { level: 'O1' });

    expect(result.modified).toBe(false);
    expect(func.instructions).toHaveLength(2);
  });
});

// ============================================================================
// Debug Output Tests
// ============================================================================

describe('ConstantFoldPass debug output', () => {
  it('should include debug info when debug=true', () => {
    const func = createTestFunction([
      createLoadImmInstr(5),
      createAddImmInstr(3),
      createReturnInstr(),
    ]);

    const fold = new ConstantFoldPass();
    const result = fold.run(func, { level: 'O1', debug: true });

    expect(result.debugInfo).toBeDefined();
    expect(result.debugInfo!.length).toBeGreaterThan(0);
    expect(result.debugInfo![0]).toContain('Folded');
    expect(result.debugInfo![0]).toContain('5');
    expect(result.debugInfo![0]).toContain('+');
    expect(result.debugInfo![0]).toContain('3');
    expect(result.debugInfo![0]).toContain('8');
  });

  it('should not include debug info when debug=false', () => {
    const func = createTestFunction([
      createLoadImmInstr(5),
      createAddImmInstr(3),
      createReturnInstr(),
    ]);

    const fold = new ConstantFoldPass();
    const result = fold.run(func, { level: 'O1', debug: false });

    expect(result.debugInfo).toBeUndefined();
  });
});

// ============================================================================
// Integration with PassManager Tests
// ============================================================================

describe('ConstantFoldPass integration', () => {
  it('should work with PassManager', async () => {
    const { PassManager } = await import('../../../optimizer/pass-manager.js');

    const manager = new PassManager({
      level: 'O1',
      enabledPasses: ['constant-fold'],
    });
    manager.registerPass(new ConstantFoldPass());

    const func = createTestFunction([
      createLoadImmInstr(5),
      createAddImmInstr(3),
      createReturnInstr(),
    ]);

    const result = manager.optimize(func);

    expect(result.modified).toBe(true);
    expect(result.stats).toHaveLength(1);
    expect(result.stats[0].pass).toBe('constant-fold');
    expect(func.instructions).toHaveLength(2);
  });

  it('should work with DCE pass in pipeline', async () => {
    const { PassManager } = await import('../../../optimizer/pass-manager.js');
    const { DCEPass } = await import('../../../optimizer/passes/dce.js');

    const manager = new PassManager({
      level: 'O2',
      enabledPasses: ['dce', 'constant-fold'],
    });
    manager.registerPass(new DCEPass());
    manager.registerPass(new ConstantFoldPass());

    // let x = 5 + 3; // x never used
    const func = createTestFunction([
      createLoadImmInstr(5),
      createAddImmInstr(3),
      createStoreByteInstr('x'),
      createReturnInstr(),
    ]);

    const result = manager.optimize(func);

    expect(result.modified).toBe(true);
    // Both passes should have run
    expect(result.stats.length).toBeGreaterThanOrEqual(1);
  });
});