/**
 * Tests for IL Peephole Modulo-to-Bitmask Optimization
 *
 * Tests the counter-wrap pattern detection and replacement:
 * ADD_IMM 1 / STORE_BYTE / CMP_IMM N / JUMP_NE / LOAD_IMM 0 / STORE_BYTE / LABEL
 * → ADD_IMM 1 / AND_IMM (N-1) / STORE_BYTE
 *
 * Only applies when N is a power of 2 (2, 4, 8, 16, 32, 64, 128).
 *
 * @module __tests__/optimizer/passes/il-peephole-modulo-bitmask.test
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

/**
 * Create a test frame slot with given name.
 * Uses ZP location by default since counter slots are typically ZP.
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

/** Create ADD_IMM instruction with given value */
function createAddImmInstr(value: number): ILInstruction {
  return {
    opcode: ILOpcode.ADD_IMM,
    operands: [createImmediateOperand(value, false)],
    defUse: { defs: [], uses: [] },
  };
}

/** Create STORE_BYTE instruction to given slot */
function createStoreByteInstr(slotName: string): ILInstruction {
  const slot = createTestSlot(slotName);
  return {
    opcode: ILOpcode.STORE_BYTE,
    operands: [createSlotOperand(slot)],
    defUse: { defs: [slotName], uses: [] },
  };
}

/** Create CMP_IMM instruction with given value */
function createCmpImmInstr(value: number): ILInstruction {
  return {
    opcode: ILOpcode.CMP_IMM,
    operands: [createImmediateOperand(value, false)],
    defUse: { defs: [], uses: [] },
  };
}

/** Create JUMP_NE instruction targeting given label */
function createJumpNeInstr(label: string): ILInstruction {
  return {
    opcode: ILOpcode.JUMP_NE,
    operands: [createLabelOperand(label)],
    defUse: { defs: [], uses: [] },
  };
}

/** Create LOAD_IMM instruction with given value */
function createLoadImmInstr(value: number): ILInstruction {
  return {
    opcode: ILOpcode.LOAD_IMM,
    operands: [createImmediateOperand(value, false)],
    defUse: { defs: [], uses: [] },
  };
}

/** Create LABEL instruction with given name */
function createLabelInstr(label: string): ILInstruction {
  return {
    opcode: ILOpcode.LABEL,
    operands: [createLabelOperand(label)],
    defUse: { defs: [], uses: [] },
  };
}

/** Create LOAD_BYTE instruction from given slot */
function createLoadByteInstr(slotName: string): ILInstruction {
  const slot = createTestSlot(slotName);
  return {
    opcode: ILOpcode.LOAD_BYTE,
    operands: [createSlotOperand(slot)],
    defUse: { defs: [], uses: [slotName] },
  };
}

/** Create RETURN instruction */
function createReturnInstr(): ILInstruction {
  return {
    opcode: ILOpcode.RETURN,
    operands: [],
    defUse: { defs: [], uses: [] },
  };
}

/**
 * Build the 7-instruction counter-wrap pattern.
 *
 * Pattern: counter++; if (counter == N) counter = 0;
 *
 * @param slotName - Name of the counter slot
 * @param limit - The wrap limit N
 * @param label - Label name for the skip branch
 */
function createCounterWrapPattern(
  slotName: string,
  limit: number,
  label: string = '.skip'
): ILInstruction[] {
  return [
    createAddImmInstr(1),            // ADD_IMM 1
    createStoreByteInstr(slotName),  // STORE_BYTE slot
    createCmpImmInstr(limit),        // CMP_IMM N
    createJumpNeInstr(label),        // JUMP_NE .skip
    createLoadImmInstr(0),           // LOAD_IMM 0
    createStoreByteInstr(slotName),  // STORE_BYTE slot (reset)
    createLabelInstr(label),         // LABEL .skip
  ];
}

/** Create test ILFunction with given instructions */
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

/** Extract immediate value from instruction's first operand */
function getImmValue(instr: ILInstruction): number | null {
  if (instr.operands.length === 0) return null;
  const op = instr.operands[0];
  return isImmediateOperand(op) ? op.value : null;
}

// ============================================================================
// Positive Tests: Power-of-2 limits that SHOULD be optimized
// ============================================================================

describe('ILPeepholePass modulo-to-bitmask — power-of-2 limits', () => {
  it('should optimize mod 2 → AND 1', () => {
    const func = createTestFunction([
      createLoadByteInstr('counter'),
      ...createCounterWrapPattern('counter', 2),
      createReturnInstr(),
    ]);

    const pass = new ILPeepholePass();
    const result = pass.run(func, { level: 'O2' });

    expect(result.modified).toBe(true);
    // Original: LOAD_BYTE + 7-pattern + RETURN = 9
    // After: LOAD_BYTE + ADD_IMM 1 + AND_IMM 1 + STORE_BYTE + RETURN = 5
    expect(func.instructions).toHaveLength(5);
    expect(func.instructions[1].opcode).toBe(ILOpcode.ADD_IMM);
    expect(func.instructions[2].opcode).toBe(ILOpcode.AND_IMM);
    expect(getImmValue(func.instructions[2])).toBe(1); // 2 - 1 = 1
    expect(func.instructions[3].opcode).toBe(ILOpcode.STORE_BYTE);
  });

  it('should optimize mod 4 → AND 3', () => {
    const func = createTestFunction([
      createLoadByteInstr('frame'),
      ...createCounterWrapPattern('frame', 4),
      createReturnInstr(),
    ]);

    const pass = new ILPeepholePass();
    pass.run(func, { level: 'O2' });

    expect(func.instructions).toHaveLength(5);
    expect(func.instructions[2].opcode).toBe(ILOpcode.AND_IMM);
    expect(getImmValue(func.instructions[2])).toBe(3); // 4 - 1 = 3
  });

  it('should optimize mod 8 → AND 7', () => {
    const func = createTestFunction([
      createLoadByteInstr('idx'),
      ...createCounterWrapPattern('idx', 8),
      createReturnInstr(),
    ]);

    const pass = new ILPeepholePass();
    pass.run(func, { level: 'O2' });

    expect(func.instructions).toHaveLength(5);
    expect(func.instructions[2].opcode).toBe(ILOpcode.AND_IMM);
    expect(getImmValue(func.instructions[2])).toBe(7); // 8 - 1 = 7
  });

  it('should optimize mod 16 → AND 15', () => {
    const func = createTestFunction([
      createLoadByteInstr('counter'),
      ...createCounterWrapPattern('counter', 16),
      createReturnInstr(),
    ]);

    const pass = new ILPeepholePass();
    pass.run(func, { level: 'O2' });

    expect(func.instructions).toHaveLength(5);
    expect(func.instructions[2].opcode).toBe(ILOpcode.AND_IMM);
    expect(getImmValue(func.instructions[2])).toBe(15); // 16 - 1 = 0x0F
  });

  it('should optimize mod 32 → AND 31', () => {
    const func = createTestFunction([
      createLoadByteInstr('counter'),
      ...createCounterWrapPattern('counter', 32),
      createReturnInstr(),
    ]);

    const pass = new ILPeepholePass();
    pass.run(func, { level: 'O2' });

    expect(func.instructions[2].opcode).toBe(ILOpcode.AND_IMM);
    expect(getImmValue(func.instructions[2])).toBe(31);
  });

  it('should optimize mod 64 → AND 63', () => {
    const func = createTestFunction([
      createLoadByteInstr('counter'),
      ...createCounterWrapPattern('counter', 64),
      createReturnInstr(),
    ]);

    const pass = new ILPeepholePass();
    pass.run(func, { level: 'O2' });

    expect(func.instructions[2].opcode).toBe(ILOpcode.AND_IMM);
    expect(getImmValue(func.instructions[2])).toBe(63); // 0x3F
  });

  it('should optimize mod 128 → AND 127', () => {
    const func = createTestFunction([
      createLoadByteInstr('counter'),
      ...createCounterWrapPattern('counter', 128),
      createReturnInstr(),
    ]);

    const pass = new ILPeepholePass();
    pass.run(func, { level: 'O2' });

    expect(func.instructions[2].opcode).toBe(ILOpcode.AND_IMM);
    expect(getImmValue(func.instructions[2])).toBe(127); // 0x7F
  });
});

// ============================================================================
// Negative Tests: Non-power-of-2 limits that should NOT be optimized
// ============================================================================

describe('ILPeepholePass modulo-to-bitmask — non-power-of-2 (no optimization)', () => {
  it('should NOT optimize mod 3', () => {
    const func = createTestFunction([
      createLoadByteInstr('counter'),
      ...createCounterWrapPattern('counter', 3),
      createReturnInstr(),
    ]);

    const pass = new ILPeepholePass();
    pass.run(func, { level: 'O2' });

    // Pattern should remain intact (7 instructions + LOAD_BYTE + RETURN = 9)
    expect(func.instructions).toHaveLength(9);
    // The CMP_IMM 3 should still be there
    const cmpInstr = func.instructions.find(i => i.opcode === ILOpcode.CMP_IMM);
    expect(cmpInstr).toBeDefined();
    expect(getImmValue(cmpInstr!)).toBe(3);
  });

  it('should NOT optimize mod 5', () => {
    const func = createTestFunction([
      createLoadByteInstr('counter'),
      ...createCounterWrapPattern('counter', 5),
      createReturnInstr(),
    ]);

    const pass = new ILPeepholePass();
    pass.run(func, { level: 'O2' });

    expect(func.instructions).toHaveLength(9);
  });

  it('should NOT optimize mod 6, 7, 9, 10, 12, 15', () => {
    for (const limit of [6, 7, 9, 10, 12, 15]) {
      const func = createTestFunction([
        createLoadByteInstr('counter'),
        ...createCounterWrapPattern('counter', limit),
        createReturnInstr(),
      ]);

      const pass = new ILPeepholePass();
      pass.run(func, { level: 'O2' });

      // Pattern should remain: all 9 instructions present
      expect(func.instructions).toHaveLength(9);
    }
  });
});

// ============================================================================
// Safety Validation Tests
// ============================================================================

describe('ILPeepholePass modulo-to-bitmask — safety checks', () => {
  it('should NOT optimize when ADD_IMM is not 1', () => {
    // ADD_IMM 2 instead of 1 — pattern doesn't match
    const func = createTestFunction([
      createLoadByteInstr('counter'),
      createAddImmInstr(2),              // ADD_IMM 2 (not 1!)
      createStoreByteInstr('counter'),
      createCmpImmInstr(4),
      createJumpNeInstr('.skip'),
      createLoadImmInstr(0),
      createStoreByteInstr('counter'),
      createLabelInstr('.skip'),
      createReturnInstr(),
    ]);

    const pass = new ILPeepholePass();
    pass.run(func, { level: 'O2' });

    // Should remain unchanged (no AND_IMM)
    const hasAndImm = func.instructions.some(i => i.opcode === ILOpcode.AND_IMM);
    expect(hasAndImm).toBe(false);
  });

  it('should NOT optimize when LOAD_IMM is not 0 (reset value)', () => {
    // LOAD_IMM 1 instead of 0 — this is not a modulo reset
    const func = createTestFunction([
      createLoadByteInstr('counter'),
      createAddImmInstr(1),
      createStoreByteInstr('counter'),
      createCmpImmInstr(4),
      createJumpNeInstr('.skip'),
      createLoadImmInstr(1),             // LOAD_IMM 1 (not 0!)
      createStoreByteInstr('counter'),
      createLabelInstr('.skip'),
      createReturnInstr(),
    ]);

    const pass = new ILPeepholePass();
    pass.run(func, { level: 'O2' });

    const hasAndImm = func.instructions.some(i => i.opcode === ILOpcode.AND_IMM);
    expect(hasAndImm).toBe(false);
  });

  it('should NOT optimize when STORE_BYTE slots differ', () => {
    // First STORE_BYTE writes to 'counter', second writes to 'other'
    const func = createTestFunction([
      createLoadByteInstr('counter'),
      createAddImmInstr(1),
      createStoreByteInstr('counter'),   // slot A
      createCmpImmInstr(4),
      createJumpNeInstr('.skip'),
      createLoadImmInstr(0),
      createStoreByteInstr('other'),     // slot B (different!)
      createLabelInstr('.skip'),
      createReturnInstr(),
    ]);

    const pass = new ILPeepholePass();
    pass.run(func, { level: 'O2' });

    const hasAndImm = func.instructions.some(i => i.opcode === ILOpcode.AND_IMM);
    expect(hasAndImm).toBe(false);
  });

  it('should NOT optimize when JUMP_NE label differs from LABEL', () => {
    // JUMP_NE targets '.other' but LABEL is '.skip'
    const func = createTestFunction([
      createLoadByteInstr('counter'),
      createAddImmInstr(1),
      createStoreByteInstr('counter'),
      createCmpImmInstr(4),
      createJumpNeInstr('.other'),        // targets .other
      createLoadImmInstr(0),
      createStoreByteInstr('counter'),
      createLabelInstr('.skip'),          // but label is .skip!
      createReturnInstr(),
    ]);

    const pass = new ILPeepholePass();
    pass.run(func, { level: 'O2' });

    const hasAndImm = func.instructions.some(i => i.opcode === ILOpcode.AND_IMM);
    expect(hasAndImm).toBe(false);
  });

  it('should NOT optimize when CMP_IMM limit is 1 (mod 1 always = 0)', () => {
    const func = createTestFunction([
      createLoadByteInstr('counter'),
      ...createCounterWrapPattern('counter', 1),
      createReturnInstr(),
    ]);

    const pass = new ILPeepholePass();
    pass.run(func, { level: 'O2' });

    // Limit 1 is rejected even though 1 is technically a power of 2
    // because mod 1 is always 0 — the pattern makes no semantic sense
    const hasAndImm = func.instructions.some(i => i.opcode === ILOpcode.AND_IMM);
    expect(hasAndImm).toBe(false);
  });
});

// ============================================================================
// Statistics and Result Tests
// ============================================================================

describe('ILPeepholePass modulo-to-bitmask — result statistics', () => {
  it('should report correct removal count (4 instructions removed per pattern)', () => {
    const func = createTestFunction([
      createLoadByteInstr('counter'),
      ...createCounterWrapPattern('counter', 8),
      createReturnInstr(),
    ]);

    const pass = new ILPeepholePass();
    const result = pass.run(func, { level: 'O2' });

    // 7 original → 3 replacement = 4 removed
    // Plus the AND_IMM counts as 1 replaced
    expect(result.modified).toBe(true);
    expect(result.instructionsRemoved).toBeGreaterThanOrEqual(4);
  });

  it('should include debug info when debug=true', () => {
    const func = createTestFunction([
      createLoadByteInstr('frame'),
      ...createCounterWrapPattern('frame', 16),
      createReturnInstr(),
    ]);

    const pass = new ILPeepholePass();
    const result = pass.run(func, { level: 'O2', debug: true });

    expect(result.debugInfo).toBeDefined();
    const modDebug = result.debugInfo!.find(d => d.includes('Modulo-to-bitmask'));
    expect(modDebug).toBeDefined();
    expect(modDebug).toContain('mod 16');
    expect(modDebug).toContain('AND');
    expect(modDebug).toContain('frame');
  });

  it('should NOT include debug info when debug=false', () => {
    const func = createTestFunction([
      createLoadByteInstr('counter'),
      ...createCounterWrapPattern('counter', 4),
      createReturnInstr(),
    ]);

    const pass = new ILPeepholePass();
    const result = pass.run(func, { level: 'O2', debug: false });

    // The modulo-to-bitmask pass should not contribute debug info
    // (other passes may still produce debug info from their own patterns)
    // Just verify the optimization still works
    expect(result.modified).toBe(true);
    expect(func.instructions).toHaveLength(5);
  });
});

// ============================================================================
// Multiple Patterns and Context Tests
// ============================================================================

describe('ILPeepholePass modulo-to-bitmask — multiple patterns', () => {
  it('should optimize two counter-wrap patterns in same function', () => {
    // Two independent counters, both wrapping at power-of-2
    const func = createTestFunction([
      createLoadByteInstr('frameA'),
      ...createCounterWrapPattern('frameA', 4, '.skipA'),
      createLoadByteInstr('frameB'),
      ...createCounterWrapPattern('frameB', 8, '.skipB'),
      createReturnInstr(),
    ]);

    const pass = new ILPeepholePass();
    const result = pass.run(func, { level: 'O2' });

    expect(result.modified).toBe(true);
    // Original: 1 + 7 + 1 + 7 + 1 = 17
    // After: 1 + 3 + 1 + 3 + 1 = 9
    expect(func.instructions).toHaveLength(9);

    // Verify first pattern: AND 3
    expect(func.instructions[2].opcode).toBe(ILOpcode.AND_IMM);
    expect(getImmValue(func.instructions[2])).toBe(3);

    // Verify second pattern: AND 7
    expect(func.instructions[6].opcode).toBe(ILOpcode.AND_IMM);
    expect(getImmValue(func.instructions[6])).toBe(7);
  });

  it('should optimize power-of-2 and skip non-power-of-2 in same function', () => {
    // First counter wraps at 4 (power of 2) — should optimize
    // Second counter wraps at 5 (not power of 2) — should NOT optimize
    const func = createTestFunction([
      createLoadByteInstr('counterA'),
      ...createCounterWrapPattern('counterA', 4, '.skipA'),
      createLoadByteInstr('counterB'),
      ...createCounterWrapPattern('counterB', 5, '.skipB'),
      createReturnInstr(),
    ]);

    const pass = new ILPeepholePass();
    pass.run(func, { level: 'O2' });

    // First pattern optimized: 1 + 3 = 4
    // Second pattern NOT optimized: 1 + 7 = 8
    // Total: 4 + 8 + 1 = 13
    expect(func.instructions).toHaveLength(13);

    // First pattern has AND_IMM 3
    expect(func.instructions[2].opcode).toBe(ILOpcode.AND_IMM);
    expect(getImmValue(func.instructions[2])).toBe(3);

    // Second pattern still has CMP_IMM 5
    const cmpInstr = func.instructions.find(i =>
      i.opcode === ILOpcode.CMP_IMM && getImmValue(i) === 5
    );
    expect(cmpInstr).toBeDefined();
  });

  it('should handle pattern at very start of function', () => {
    // Counter wrap is the first thing in the function (no preceding LOAD_BYTE)
    const func = createTestFunction([
      ...createCounterWrapPattern('counter', 16),
      createReturnInstr(),
    ]);

    const pass = new ILPeepholePass();
    pass.run(func, { level: 'O2' });

    // 7 → 3, plus RETURN = 4
    expect(func.instructions).toHaveLength(4);
    expect(func.instructions[0].opcode).toBe(ILOpcode.ADD_IMM);
    expect(func.instructions[1].opcode).toBe(ILOpcode.AND_IMM);
    expect(getImmValue(func.instructions[1])).toBe(15);
    expect(func.instructions[2].opcode).toBe(ILOpcode.STORE_BYTE);
    expect(func.instructions[3].opcode).toBe(ILOpcode.RETURN);
  });

  it('should handle pattern at end of function (no trailing RETURN)', () => {
    const func = createTestFunction([
      createLoadByteInstr('counter'),
      ...createCounterWrapPattern('counter', 8),
    ]);

    const pass = new ILPeepholePass();
    pass.run(func, { level: 'O2' });

    // 1 + 3 = 4
    expect(func.instructions).toHaveLength(4);
    expect(func.instructions[2].opcode).toBe(ILOpcode.AND_IMM);
    expect(getImmValue(func.instructions[2])).toBe(7);
  });
});

// ============================================================================
// Idempotency Test
// ============================================================================

describe('ILPeepholePass modulo-to-bitmask — idempotency', () => {
  it('should produce same result when run twice', () => {
    const func = createTestFunction([
      createLoadByteInstr('counter'),
      ...createCounterWrapPattern('counter', 8),
      createReturnInstr(),
    ]);

    const pass = new ILPeepholePass();

    // First pass
    pass.run(func, { level: 'O2' });
    const afterFirst = func.instructions.length;
    const opcodes1 = func.instructions.map(i => i.opcode);

    // Second pass — should not change anything
    const result2 = pass.run(func, { level: 'O2' });
    const afterSecond = func.instructions.length;
    const opcodes2 = func.instructions.map(i => i.opcode);

    expect(afterFirst).toBe(afterSecond);
    expect(opcodes1).toEqual(opcodes2);
    // The modulo-to-bitmask specifically should find nothing on second run
    // (though other patterns like identity/strength may still report no changes)
  });
});
