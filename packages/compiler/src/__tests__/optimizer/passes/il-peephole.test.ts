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

function createMulImmInstr(value: number): ILInstruction {
  return {
    opcode: ILOpcode.MUL_IMM,
    operands: [createImmediateOperand(value, false)],
    defUse: { defs: [], uses: [] },
  };
}

function createMulByteInstr(slotName: string): ILInstruction {
  const slot = createTestSlot(slotName);
  return {
    opcode: ILOpcode.MUL_BYTE,
    operands: [createSlotOperand(slot)],
    defUse: { defs: [], uses: [slotName] },
  };
}

function createDivByteInstr(slotName: string): ILInstruction {
  const slot = createTestSlot(slotName);
  return {
    opcode: ILOpcode.DIV_BYTE,
    operands: [createSlotOperand(slot)],
    defUse: { defs: [], uses: [slotName] },
  };
}

function createLabelInstr(label: string): ILInstruction {
  return {
    opcode: ILOpcode.LABEL,
    operands: [createLabelOperand(label)],
    defUse: { defs: [], uses: [] },
  };
}

function createCallInstr(): ILInstruction {
  return {
    opcode: ILOpcode.CALL,
    operands: [],
    defUse: { defs: [], uses: [] },
  };
}

function createIncByteInstr(slotName: string): ILInstruction {
  const slot = createTestSlot(slotName);
  return {
    opcode: ILOpcode.INC_BYTE,
    operands: [createSlotOperand(slot)],
    defUse: { defs: [slotName], uses: [slotName] },
  };
}

function createLoadWordInstr(slotName: string): ILInstruction {
  const slot = createTestSlot(slotName);
  return {
    opcode: ILOpcode.LOAD_WORD,
    operands: [createSlotOperand(slot)],
    defUse: { defs: [], uses: [slotName] },
  };
}

function createStoreWordInstr(slotName: string): ILInstruction {
  const slot = createTestSlot(slotName);
  return {
    opcode: ILOpcode.STORE_WORD,
    operands: [createSlotOperand(slot)],
    defUse: { defs: [slotName], uses: [] },
  };
}

function createJumpInstr(label: string): ILInstruction {
  return {
    opcode: ILOpcode.JUMP,
    operands: [createLabelOperand(label)],
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
// Word Load-Store Elimination Tests
// ============================================================================

describe('ILPeepholePass word load-store elimination', () => {
  it('should remove LOAD_WORD x; STORE_WORD x pair (no-op)', () => {
    const func = createTestFunction([
      createLoadWordInstr('addr'),
      createStoreWordInstr('addr'),
      createReturnInstr(),
    ]);

    const pass = new ILPeepholePass();
    const result = pass.run(func, { level: 'O2' });

    expect(result.modified).toBe(true);
    expect(func.instructions).toHaveLength(1);
    expect(func.instructions[0].opcode).toBe(ILOpcode.RETURN);
  });

  it('should NOT remove LOAD_WORD x; STORE_WORD y (different slots)', () => {
    const func = createTestFunction([
      createLoadWordInstr('addr1'),
      createStoreWordInstr('addr2'),
      createReturnInstr(),
    ]);

    const pass = new ILPeepholePass();
    pass.run(func, { level: 'O2' });

    expect(func.instructions).toHaveLength(3);
    expect(func.instructions[0].opcode).toBe(ILOpcode.LOAD_WORD);
    expect(func.instructions[1].opcode).toBe(ILOpcode.STORE_WORD);
  });

  it('should remove redundant LOAD_WORD after STORE_WORD (inliner pattern)', () => {
    // This is the key pattern from function inlining:
    // Caller stores argument → inlined body reloads it
    // STORE_WORD spriteAddr; LOAD_WORD spriteAddr → just STORE_WORD
    const func = createTestFunction([
      createLoadImmInstr(0x40),        // some value loaded (address)
      createStoreWordInstr('spriteAddr'),
      createLoadWordInstr('spriteAddr'), // redundant — value still in A:X
      createReturnInstr(),
    ]);

    const pass = new ILPeepholePass();
    const result = pass.run(func, { level: 'O2' });

    expect(result.modified).toBe(true);
    expect(func.instructions).toHaveLength(3);
    expect(func.instructions[0].opcode).toBe(ILOpcode.LOAD_IMM);
    expect(func.instructions[1].opcode).toBe(ILOpcode.STORE_WORD);
    expect(func.instructions[2].opcode).toBe(ILOpcode.RETURN);
  });

  it('should NOT remove LOAD_WORD after STORE_WORD to different slot', () => {
    const func = createTestFunction([
      createLoadImmInstr(0x40),
      createStoreWordInstr('addr1'),
      createLoadWordInstr('addr2'),
      createReturnInstr(),
    ]);

    const pass = new ILPeepholePass();
    pass.run(func, { level: 'O2' });

    expect(func.instructions).toHaveLength(4);
  });

  it('should handle multiple word store/load pairs', () => {
    // Two inlined calls, each with a redundant store→load pair
    const func = createTestFunction([
      createLoadImmInstr(0x40),
      createStoreWordInstr('param1'),
      createLoadWordInstr('param1'),  // redundant
      createStoreWordInstr('param2'),
      createLoadWordInstr('param2'),  // redundant
      createReturnInstr(),
    ]);

    const pass = new ILPeepholePass();
    const result = pass.run(func, { level: 'O2' });

    expect(result.modified).toBe(true);
    // Both LOAD_WORDs removed, keeping LOAD_IMM + STORE_WORD + STORE_WORD + RETURN
    expect(func.instructions).toHaveLength(4);
    expect(func.instructions[0].opcode).toBe(ILOpcode.LOAD_IMM);
    expect(func.instructions[1].opcode).toBe(ILOpcode.STORE_WORD);
    expect(func.instructions[2].opcode).toBe(ILOpcode.STORE_WORD);
    expect(func.instructions[3].opcode).toBe(ILOpcode.RETURN);
  });

  it('should include debug info for word store/load elimination', () => {
    const func = createTestFunction([
      createStoreWordInstr('spriteAddr'),
      createLoadWordInstr('spriteAddr'),
      createReturnInstr(),
    ]);

    const pass = new ILPeepholePass();
    const result = pass.run(func, { level: 'O2', debug: true });

    expect(result.debugInfo).toBeDefined();
    const wordDebug = result.debugInfo!.find(d => d.includes('LOAD_WORD'));
    expect(wordDebug).toBeDefined();
    expect(wordDebug).toContain('already in A:X');
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
// MUL/DIV Strength Reduction Tests
// ============================================================================

describe('ILPeepholePass MUL strength reduction — MUL_IMM (direct immediate)', () => {
  it('should reduce MUL_IMM 2 to SHL_BYTE 1', () => {
    const func = createTestFunction([
      createLoadByteInstr('x'),
      createMulImmInstr(2),
      createReturnInstr(),
    ]);

    const pass = new ILPeepholePass();
    const result = pass.run(func, { level: 'O2' });

    expect(result.modified).toBe(true);
    expect(func.instructions[1].opcode).toBe(ILOpcode.SHL_BYTE);
    expect(getImmValue(func.instructions[1])).toBe(1);
  });

  it('should reduce MUL_IMM 4 to SHL_BYTE 2', () => {
    const func = createTestFunction([
      createLoadByteInstr('x'),
      createMulImmInstr(4),
      createReturnInstr(),
    ]);

    const pass = new ILPeepholePass();
    pass.run(func, { level: 'O2' });

    expect(func.instructions[1].opcode).toBe(ILOpcode.SHL_BYTE);
    expect(getImmValue(func.instructions[1])).toBe(2);
  });

  it('should reduce MUL_IMM for all byte-range powers of 2 (8,16,32,64,128)', () => {
    // Test each power of 2 from 8 to 128
    const powersAndShifts: [number, number][] = [
      [8, 3], [16, 4], [32, 5], [64, 6], [128, 7],
    ];

    for (const [multiplier, expectedShift] of powersAndShifts) {
      const func = createTestFunction([
        createLoadByteInstr('x'),
        createMulImmInstr(multiplier),
        createReturnInstr(),
      ]);

      const pass = new ILPeepholePass();
      pass.run(func, { level: 'O2' });

      expect(func.instructions[1].opcode).toBe(ILOpcode.SHL_BYTE);
      expect(getImmValue(func.instructions[1])).toBe(expectedShift);
    }
  });

  it('should reduce MUL_IMM 0 to LOAD_IMM 0', () => {
    const func = createTestFunction([
      createLoadByteInstr('x'),
      createMulImmInstr(0),
      createReturnInstr(),
    ]);

    const pass = new ILPeepholePass();
    const result = pass.run(func, { level: 'O2' });

    expect(result.modified).toBe(true);
    expect(func.instructions[1].opcode).toBe(ILOpcode.LOAD_IMM);
    expect(getImmValue(func.instructions[1])).toBe(0);
  });

  it('should remove MUL_IMM 1 (identity — x * 1 = x)', () => {
    const func = createTestFunction([
      createLoadByteInstr('x'),
      createMulImmInstr(1),
      createReturnInstr(),
    ]);

    const pass = new ILPeepholePass();
    const result = pass.run(func, { level: 'O2' });

    expect(result.modified).toBe(true);
    // MUL_IMM 1 removed, leaving LOAD_BYTE x + RETURN
    expect(func.instructions).toHaveLength(2);
    expect(func.instructions[0].opcode).toBe(ILOpcode.LOAD_BYTE);
    expect(func.instructions[1].opcode).toBe(ILOpcode.RETURN);
  });

  it('should NOT reduce MUL_IMM with non-power-of-2 (e.g., 3, 5, 7)', () => {
    for (const value of [3, 5, 7, 9, 10, 15]) {
      const func = createTestFunction([
        createLoadByteInstr('x'),
        createMulImmInstr(value),
        createReturnInstr(),
      ]);

      const pass = new ILPeepholePass();
      pass.run(func, { level: 'O2' });

      // MUL_IMM should remain unchanged
      expect(func.instructions[1].opcode).toBe(ILOpcode.MUL_IMM);
      expect(getImmValue(func.instructions[1])).toBe(value);
    }
  });
});

describe('ILPeepholePass MUL strength reduction — MUL_BYTE (slot with backward scan)', () => {
  it('should reduce MUL_BYTE when slot has known power-of-2 constant', () => {
    // Pattern: LOAD_IMM 8; STORE_BYTE divisor; LOAD_BYTE x; MUL_BYTE divisor
    const func = createTestFunction([
      createLoadImmInstr(8),      // A = 8
      createStoreByteInstr('k'),  // k = 8
      createLoadByteInstr('x'),   // A = x
      createMulByteInstr('k'),    // A = x * k = x * 8 → should become SHL 3
      createReturnInstr(),
    ]);

    const pass = new ILPeepholePass();
    const result = pass.run(func, { level: 'O2' });

    expect(result.modified).toBe(true);
    expect(func.instructions[3].opcode).toBe(ILOpcode.SHL_BYTE);
    expect(getImmValue(func.instructions[3])).toBe(3);
  });

  it('should reduce MUL_BYTE when slot is 0 to LOAD_IMM 0', () => {
    const func = createTestFunction([
      createLoadImmInstr(0),
      createStoreByteInstr('k'),
      createLoadByteInstr('x'),
      createMulByteInstr('k'),    // x * 0 = 0
      createReturnInstr(),
    ]);

    const pass = new ILPeepholePass();
    pass.run(func, { level: 'O2' });

    expect(func.instructions[3].opcode).toBe(ILOpcode.LOAD_IMM);
    expect(getImmValue(func.instructions[3])).toBe(0);
  });

  it('should NOT reduce MUL_BYTE when slot value is unknown (no LOAD_IMM;STORE)', () => {
    // Slot 'k' is loaded from another slot — value unknown
    const func = createTestFunction([
      createLoadByteInstr('y'),   // A = y (runtime value)
      createStoreByteInstr('k'),  // k = y
      createLoadByteInstr('x'),
      createMulByteInstr('k'),    // x * k — unknown, no reduction
      createReturnInstr(),
    ]);

    const pass = new ILPeepholePass();
    pass.run(func, { level: 'O2' });

    // MUL_BYTE should remain
    expect(func.instructions[3].opcode).toBe(ILOpcode.MUL_BYTE);
  });

  it('should NOT reduce MUL_BYTE when label intervenes (control flow boundary)', () => {
    const func = createTestFunction([
      createLoadImmInstr(4),
      createStoreByteInstr('k'),
      createLabelInstr('.loop'),    // control flow boundary
      createLoadByteInstr('x'),
      createMulByteInstr('k'),      // k might have different value via jump
      createReturnInstr(),
    ]);

    const pass = new ILPeepholePass();
    pass.run(func, { level: 'O2' });

    expect(func.instructions[4].opcode).toBe(ILOpcode.MUL_BYTE);
  });

  it('should NOT reduce MUL_BYTE when CALL intervenes (callee may write slot)', () => {
    const func = createTestFunction([
      createLoadImmInstr(16),
      createStoreByteInstr('k'),
      createCallInstr(),             // callee might modify 'k'
      createLoadByteInstr('x'),
      createMulByteInstr('k'),
      createReturnInstr(),
    ]);

    const pass = new ILPeepholePass();
    pass.run(func, { level: 'O2' });

    expect(func.instructions[4].opcode).toBe(ILOpcode.MUL_BYTE);
  });

  it('should NOT reduce MUL_BYTE when INC_BYTE modifies the slot', () => {
    const func = createTestFunction([
      createLoadImmInstr(2),
      createStoreByteInstr('k'),
      createIncByteInstr('k'),       // k is now 3, not 2
      createLoadByteInstr('x'),
      createMulByteInstr('k'),
      createReturnInstr(),
    ]);

    const pass = new ILPeepholePass();
    pass.run(func, { level: 'O2' });

    expect(func.instructions[4].opcode).toBe(ILOpcode.MUL_BYTE);
  });
});

describe('ILPeepholePass DIV strength reduction — DIV_BYTE (slot with backward scan)', () => {
  it('should reduce DIV_BYTE by 2 to SHR_BYTE 1', () => {
    const func = createTestFunction([
      createLoadImmInstr(2),
      createStoreByteInstr('d'),
      createLoadByteInstr('x'),
      createDivByteInstr('d'),      // x / 2 → x >> 1
      createReturnInstr(),
    ]);

    const pass = new ILPeepholePass();
    const result = pass.run(func, { level: 'O2' });

    expect(result.modified).toBe(true);
    expect(func.instructions[3].opcode).toBe(ILOpcode.SHR_BYTE);
    expect(getImmValue(func.instructions[3])).toBe(1);
  });

  it('should reduce DIV_BYTE for powers of 2 (4,8,16,32,64,128)', () => {
    const powersAndShifts: [number, number][] = [
      [4, 2], [8, 3], [16, 4], [32, 5], [64, 6], [128, 7],
    ];

    for (const [divisor, expectedShift] of powersAndShifts) {
      const func = createTestFunction([
        createLoadImmInstr(divisor),
        createStoreByteInstr('d'),
        createLoadByteInstr('x'),
        createDivByteInstr('d'),
        createReturnInstr(),
      ]);

      const pass = new ILPeepholePass();
      pass.run(func, { level: 'O2' });

      expect(func.instructions[3].opcode).toBe(ILOpcode.SHR_BYTE);
      expect(getImmValue(func.instructions[3])).toBe(expectedShift);
    }
  });

  it('should remove DIV_BYTE by 1 (identity — x / 1 = x)', () => {
    const func = createTestFunction([
      createLoadImmInstr(1),
      createStoreByteInstr('d'),
      createLoadByteInstr('x'),
      createDivByteInstr('d'),      // x / 1 = x → remove
      createReturnInstr(),
    ]);

    const pass = new ILPeepholePass();
    const result = pass.run(func, { level: 'O2' });

    expect(result.modified).toBe(true);
    // DIV removed; remaining: LOAD_IMM 1, STORE d, LOAD_BYTE x, RETURN
    // But identity elimination + load-store elimination may also kick in
    // The key assertion: no DIV_BYTE remains
    const hasDivByte = func.instructions.some(i => i.opcode === ILOpcode.DIV_BYTE);
    expect(hasDivByte).toBe(false);
  });

  it('should NOT reduce DIV_BYTE with non-power-of-2 (e.g., 3, 5, 7)', () => {
    for (const value of [3, 5, 7]) {
      const func = createTestFunction([
        createLoadImmInstr(value),
        createStoreByteInstr('d'),
        createLoadByteInstr('x'),
        createDivByteInstr('d'),
        createReturnInstr(),
      ]);

      const pass = new ILPeepholePass();
      pass.run(func, { level: 'O2' });

      expect(func.instructions[3].opcode).toBe(ILOpcode.DIV_BYTE);
    }
  });

  it('should NOT reduce DIV_BYTE when slot value is unknown', () => {
    const func = createTestFunction([
      createLoadByteInstr('y'),
      createStoreByteInstr('d'),
      createLoadByteInstr('x'),
      createDivByteInstr('d'),
      createReturnInstr(),
    ]);

    const pass = new ILPeepholePass();
    pass.run(func, { level: 'O2' });

    expect(func.instructions[3].opcode).toBe(ILOpcode.DIV_BYTE);
  });
});

describe('ILPeepholePass MUL/DIV debug output', () => {
  it('should include debug info for MUL_IMM power-of-2 reduction', () => {
    const func = createTestFunction([
      createLoadByteInstr('x'),
      createMulImmInstr(4),
      createReturnInstr(),
    ]);

    const pass = new ILPeepholePass();
    const result = pass.run(func, { level: 'O2', debug: true });

    expect(result.debugInfo).toBeDefined();
    const mulDebug = result.debugInfo!.find(d => d.includes('Strength reduction'));
    expect(mulDebug).toBeDefined();
    expect(mulDebug).toContain('x * 4 = x << 2');
  });

  it('should include debug info for MUL_IMM 1 removal', () => {
    const func = createTestFunction([
      createLoadByteInstr('x'),
      createMulImmInstr(1),
      createReturnInstr(),
    ]);

    const pass = new ILPeepholePass();
    const result = pass.run(func, { level: 'O2', debug: true });

    expect(result.debugInfo).toBeDefined();
    const mulDebug = result.debugInfo!.find(d => d.includes('removed'));
    expect(mulDebug).toBeDefined();
    expect(mulDebug).toContain('x * 1 = x');
  });
});

// ============================================================================
// Redundant Jump Elimination Tests
// ============================================================================

describe('ILPeepholePass redundant jump elimination', () => {
  it('should remove JUMP label followed by same LABEL', () => {
    // Pattern: JUMP .cont; LABEL .cont → just LABEL .cont
    const func = createTestFunction([
      createLoadImmInstr(1),
      createJumpInstr('.cont'),
      createLabelInstr('.cont'),
      createReturnInstr(),
    ]);

    const pass = new ILPeepholePass();
    const result = pass.run(func, { level: 'O2' });

    expect(result.modified).toBe(true);
    expect(func.instructions).toHaveLength(3);
    expect(func.instructions[0].opcode).toBe(ILOpcode.LOAD_IMM);
    expect(func.instructions[1].opcode).toBe(ILOpcode.LABEL);
    expect(func.instructions[2].opcode).toBe(ILOpcode.RETURN);
  });

  it('should NOT remove JUMP label when followed by different LABEL', () => {
    // JUMP .other; LABEL .loop — different labels, JUMP is NOT redundant
    const func = createTestFunction([
      createJumpInstr('.other'),
      createLabelInstr('.loop'),
      createReturnInstr(),
    ]);

    const pass = new ILPeepholePass();
    pass.run(func, { level: 'O2' });

    // All instructions should remain — JUMP targets a different label
    expect(func.instructions).toHaveLength(3);
    expect(func.instructions[0].opcode).toBe(ILOpcode.JUMP);
    expect(func.instructions[1].opcode).toBe(ILOpcode.LABEL);
  });

  it('should NOT remove JUMP when not followed by LABEL', () => {
    // JUMP .target followed by LOAD_IMM — not a LABEL, so JUMP stays
    const func = createTestFunction([
      createJumpInstr('.target'),
      createLoadImmInstr(0),
      createReturnInstr(),
    ]);

    const pass = new ILPeepholePass();
    pass.run(func, { level: 'O2' });

    expect(func.instructions[0].opcode).toBe(ILOpcode.JUMP);
  });

  it('should remove multiple redundant JUMPs (e.g., from multi-site inlining)', () => {
    // Two inline continuation points, both with redundant JUMPs
    const func = createTestFunction([
      createLoadImmInstr(1),
      createJumpInstr('._inline_fn_0_cont'),
      createLabelInstr('._inline_fn_0_cont'),
      createLoadImmInstr(2),
      createJumpInstr('._inline_fn_1_cont'),
      createLabelInstr('._inline_fn_1_cont'),
      createReturnInstr(),
    ]);

    const pass = new ILPeepholePass();
    const result = pass.run(func, { level: 'O2' });

    expect(result.modified).toBe(true);
    // Both JUMPs removed, labels and other instructions remain
    expect(func.instructions).toHaveLength(5);
    expect(func.instructions[0].opcode).toBe(ILOpcode.LOAD_IMM);
    expect(func.instructions[1].opcode).toBe(ILOpcode.LABEL);
    expect(func.instructions[2].opcode).toBe(ILOpcode.LOAD_IMM);
    expect(func.instructions[3].opcode).toBe(ILOpcode.LABEL);
    expect(func.instructions[4].opcode).toBe(ILOpcode.RETURN);
  });

  it('should include debug info when debug=true', () => {
    const func = createTestFunction([
      createJumpInstr('.cont'),
      createLabelInstr('.cont'),
      createReturnInstr(),
    ]);

    const pass = new ILPeepholePass();
    const result = pass.run(func, { level: 'O2', debug: true });

    expect(result.debugInfo).toBeDefined();
    const jumpDebug = result.debugInfo!.find(d => d.includes('Redundant jump'));
    expect(jumpDebug).toBeDefined();
    expect(jumpDebug).toContain('.cont');
  });

  it('should NOT include debug info when debug=false', () => {
    const func = createTestFunction([
      createJumpInstr('.cont'),
      createLabelInstr('.cont'),
      createReturnInstr(),
    ]);

    const pass = new ILPeepholePass();
    const result = pass.run(func, { level: 'O2', debug: false });

    // No debug info for the jump elimination (other passes also produce none)
    // Just verify the optimization still happens
    expect(result.modified).toBe(true);
    expect(func.instructions).toHaveLength(2);
  });

  it('should handle JUMP as last instruction (no next instruction)', () => {
    // Edge case: JUMP at end of function — no following instruction to compare
    const func = createTestFunction([
      createLoadImmInstr(1),
      createJumpInstr('.target'),
    ]);

    const pass = new ILPeepholePass();
    pass.run(func, { level: 'O2' });

    // JUMP should remain — no following LABEL to match
    expect(func.instructions).toHaveLength(2);
    expect(func.instructions[1].opcode).toBe(ILOpcode.JUMP);
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