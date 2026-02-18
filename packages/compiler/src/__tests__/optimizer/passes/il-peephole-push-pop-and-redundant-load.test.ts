/**
 * IL Peephole Pass: PHA/PLA Pair Elimination & Redundant Immediate Load Tests
 *
 * Tests for two new peephole optimization patterns (Items G from
 * armenian-charset-compiler-fixes):
 *
 * Pattern 5 — PHA/PLA Pair Elimination (pushPopElimination):
 * Removes consecutive PUSH_A/POP_A pairs when the accumulator is not
 * modified between them. Saves 2 bytes + 7 cycles per pair on 6502.
 *
 * Pattern 6 — Redundant Immediate Load Elimination (redundantImmLoadElimination):
 * Removes redundant LOAD_IMM instructions when the accumulator already
 * holds the same value. Saves 2 bytes + 2 cycles per eliminated LDA #imm.
 *
 * @module __tests__/optimizer/passes/il-peephole-push-pop-and-redundant-load
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

// ============================================================================
// Test Helpers
// ============================================================================

/**
 * Creates a test frame slot for instruction operands
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

/** Creates a PUSH_A instruction */
function createPushAInstr(): ILInstruction {
  return {
    opcode: ILOpcode.PUSH_A,
    operands: [],
    defUse: { defs: [], uses: [] },
  };
}

/** Creates a POP_A instruction */
function createPopAInstr(): ILInstruction {
  return {
    opcode: ILOpcode.POP_A,
    operands: [],
    defUse: { defs: [], uses: [] },
  };
}

/** Creates a LOAD_IMM instruction */
function createLoadImmInstr(value: number): ILInstruction {
  return {
    opcode: ILOpcode.LOAD_IMM,
    operands: [createImmediateOperand(value, false)],
    defUse: { defs: [], uses: [] },
  };
}

/** Creates a STORE_BYTE instruction */
function createStoreByteInstr(slotName: string): ILInstruction {
  const slot = createTestSlot(slotName);
  return {
    opcode: ILOpcode.STORE_BYTE,
    operands: [createSlotOperand(slot)],
    defUse: { defs: [slotName], uses: [] },
  };
}

/** Creates a LOAD_BYTE instruction */
function createLoadByteInstr(slotName: string): ILInstruction {
  const slot = createTestSlot(slotName);
  return {
    opcode: ILOpcode.LOAD_BYTE,
    operands: [createSlotOperand(slot)],
    defUse: { defs: [], uses: [slotName] },
  };
}

/** Creates a CMP_IMM instruction (does not modify A) */
function createCmpImmInstr(value: number): ILInstruction {
  return {
    opcode: ILOpcode.CMP_IMM,
    operands: [createImmediateOperand(value, false)],
    defUse: { defs: [], uses: [] },
  };
}

/** Creates a LABEL instruction */
function createLabelInstr(label: string): ILInstruction {
  return {
    opcode: ILOpcode.LABEL,
    operands: [createLabelOperand(label)],
    defUse: { defs: [], uses: [] },
  };
}

/** Creates a CALL instruction */
function createCallInstr(): ILInstruction {
  return {
    opcode: ILOpcode.CALL,
    operands: [],
    defUse: { defs: [], uses: [] },
  };
}

/** Creates a RETURN instruction */
function createReturnInstr(): ILInstruction {
  return {
    opcode: ILOpcode.RETURN,
    operands: [],
    defUse: { defs: [], uses: [] },
  };
}

/** Creates an ADD_IMM instruction (modifies A) */
function createAddImmInstr(value: number): ILInstruction {
  return {
    opcode: ILOpcode.ADD_IMM,
    operands: [createImmediateOperand(value, false)],
    defUse: { defs: [], uses: [] },
  };
}

/** Creates a JUMP instruction */
function createJumpInstr(label: string): ILInstruction {
  return {
    opcode: ILOpcode.JUMP,
    operands: [createLabelOperand(label)],
    defUse: { defs: [], uses: [] },
  };
}

/** Creates a JUMP_EQ instruction */
function createJumpEqInstr(label: string): ILInstruction {
  return {
    opcode: ILOpcode.JUMP_EQ,
    operands: [createLabelOperand(label)],
    defUse: { defs: [], uses: [] },
  };
}

/** Creates a test ILFunction with given instructions */
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
// PHA/PLA Pair Elimination (Pattern 5: pushPopElimination)
// ============================================================================

describe('ILPeepholePass: PHA/PLA Pair Elimination', () => {

  it('should eliminate adjacent PUSH_A/POP_A pair', () => {
    // PUSH_A immediately followed by POP_A — completely redundant
    const func = createTestFunction([
      createLoadImmInstr(42),
      createPushAInstr(),
      createPopAInstr(),
      createReturnInstr(),
    ]);

    const pass = new ILPeepholePass();
    const result = pass.run(func, { level: 'O2' });

    expect(result.modified).toBe(true);
    // PUSH_A and POP_A should be removed, leaving LOAD_IMM + RETURN
    expect(func.instructions).toHaveLength(2);
    expect(func.instructions[0].opcode).toBe(ILOpcode.LOAD_IMM);
    expect(func.instructions[1].opcode).toBe(ILOpcode.RETURN);
  });

  it('should eliminate PUSH_A/POP_A with non-A-modifying instructions between', () => {
    // PUSH_A ... STORE_BYTE ... POP_A — STORE_BYTE doesn't modify A
    const func = createTestFunction([
      createLoadImmInstr(10),
      createPushAInstr(),
      createStoreByteInstr('x'),     // stores A but doesn't modify it
      createPopAInstr(),
      createReturnInstr(),
    ]);

    const pass = new ILPeepholePass();
    const result = pass.run(func, { level: 'O2' });

    expect(result.modified).toBe(true);
    // PUSH_A and POP_A removed, STORE_BYTE remains
    expect(func.instructions).toHaveLength(3);
    expect(func.instructions[0].opcode).toBe(ILOpcode.LOAD_IMM);
    expect(func.instructions[1].opcode).toBe(ILOpcode.STORE_BYTE);
    expect(func.instructions[2].opcode).toBe(ILOpcode.RETURN);
  });

  it('should NOT eliminate PUSH_A/POP_A when A is modified between them', () => {
    // PUSH_A ... ADD_IMM ... POP_A — ADD_IMM modifies A, so POP_A is needed
    const func = createTestFunction([
      createLoadImmInstr(10),
      createPushAInstr(),
      createAddImmInstr(5),           // modifies A!
      createPopAInstr(),
      createReturnInstr(),
    ]);

    const pass = new ILPeepholePass();
    pass.run(func, { level: 'O2' });

    // Should NOT remove the pair — POP_A is needed to restore original A
    expect(func.instructions).toHaveLength(5);
    expect(func.instructions[1].opcode).toBe(ILOpcode.PUSH_A);
    expect(func.instructions[3].opcode).toBe(ILOpcode.POP_A);
  });

  it('should NOT eliminate PUSH_A/POP_A when LOAD_BYTE occurs between them', () => {
    // LOAD_BYTE modifies A, so the POP_A is needed
    const func = createTestFunction([
      createLoadImmInstr(10),
      createPushAInstr(),
      createLoadByteInstr('x'),       // modifies A!
      createPopAInstr(),
      createReturnInstr(),
    ]);

    const pass = new ILPeepholePass();
    pass.run(func, { level: 'O2' });

    // POP_A is needed to restore original value
    expect(func.instructions).toHaveLength(5);
  });

  it('should NOT eliminate PUSH_A/POP_A with CALL between them', () => {
    // CALL invalidates the analysis — function may use stack
    const func = createTestFunction([
      createLoadImmInstr(10),
      createPushAInstr(),
      createCallInstr(),
      createPopAInstr(),
      createReturnInstr(),
    ]);

    const pass = new ILPeepholePass();
    pass.run(func, { level: 'O2' });

    // Should NOT remove — CALL makes analysis unsound
    expect(func.instructions).toHaveLength(5);
  });

  it('should NOT eliminate PUSH_A/POP_A with LABEL between them', () => {
    // LABEL represents a control flow boundary — analysis unsound
    const func = createTestFunction([
      createPushAInstr(),
      createLabelInstr('.loop'),
      createPopAInstr(),
      createReturnInstr(),
    ]);

    const pass = new ILPeepholePass();
    pass.run(func, { level: 'O2' });

    // Should NOT remove — control flow boundary
    expect(func.instructions).toHaveLength(4);
  });

  it('should eliminate multiple independent PUSH_A/POP_A pairs', () => {
    // Two separate safe pairs should both be eliminated
    const func = createTestFunction([
      createLoadImmInstr(1),
      createPushAInstr(),
      createStoreByteInstr('x'),
      createPopAInstr(),
      createLoadImmInstr(2),
      createPushAInstr(),
      createStoreByteInstr('y'),
      createPopAInstr(),
      createReturnInstr(),
    ]);

    const pass = new ILPeepholePass();
    const result = pass.run(func, { level: 'O2' });

    expect(result.modified).toBe(true);
    // Both pairs removed: 9 - 4 = 5 instructions
    expect(func.instructions).toHaveLength(5);
    // Verify no PUSH_A or POP_A remain
    const opcodes = func.instructions.map(i => i.opcode);
    expect(opcodes).not.toContain(ILOpcode.PUSH_A);
    expect(opcodes).not.toContain(ILOpcode.POP_A);
  });

  it('should handle PUSH_A/POP_A with CMP_IMM between them (CMP does not modify A)', () => {
    // CMP only sets flags, doesn't change A — safe to eliminate pair
    const func = createTestFunction([
      createLoadImmInstr(10),
      createPushAInstr(),
      createCmpImmInstr(5),
      createPopAInstr(),
      createReturnInstr(),
    ]);

    const pass = new ILPeepholePass();
    const result = pass.run(func, { level: 'O2' });

    expect(result.modified).toBe(true);
    expect(func.instructions).toHaveLength(3);
  });
});

// ============================================================================
// Redundant Immediate Load Elimination (Pattern 6: redundantImmLoadElimination)
// ============================================================================

describe('ILPeepholePass: Redundant Immediate Load Elimination', () => {

  it('should eliminate duplicate LOAD_IMM with same value (adjacent)', () => {
    // LOAD_IMM 0 / LOAD_IMM 0 — second is redundant
    const func = createTestFunction([
      createLoadImmInstr(0),
      createLoadImmInstr(0),
      createReturnInstr(),
    ]);

    const pass = new ILPeepholePass();
    const result = pass.run(func, { level: 'O2' });

    expect(result.modified).toBe(true);
    expect(func.instructions).toHaveLength(2);
    expect(func.instructions[0].opcode).toBe(ILOpcode.LOAD_IMM);
    expect(func.instructions[1].opcode).toBe(ILOpcode.RETURN);
  });

  it('should eliminate duplicate LOAD_IMM with STORE_BYTE between them', () => {
    // LOAD_IMM 0 / STORE_BYTE x / LOAD_IMM 0 — second LOAD_IMM redundant
    // because STORE_BYTE doesn't modify A
    const func = createTestFunction([
      createLoadImmInstr(0),
      createStoreByteInstr('x'),
      createLoadImmInstr(0),
      createStoreByteInstr('y'),
      createReturnInstr(),
    ]);

    const pass = new ILPeepholePass();
    const result = pass.run(func, { level: 'O2' });

    expect(result.modified).toBe(true);
    // Second LOAD_IMM removed: 5 - 1 = 4
    expect(func.instructions).toHaveLength(4);
    // Verify the pattern: LOAD_IMM, STORE x, STORE y, RETURN
    expect(func.instructions[0].opcode).toBe(ILOpcode.LOAD_IMM);
    expect(func.instructions[1].opcode).toBe(ILOpcode.STORE_BYTE);
    expect(func.instructions[2].opcode).toBe(ILOpcode.STORE_BYTE);
    expect(func.instructions[3].opcode).toBe(ILOpcode.RETURN);
  });

  it('should NOT eliminate LOAD_IMM with different values', () => {
    // LOAD_IMM 0 / STORE_BYTE / LOAD_IMM 1 — different values, keep both
    const func = createTestFunction([
      createLoadImmInstr(0),
      createStoreByteInstr('x'),
      createLoadImmInstr(1),
      createStoreByteInstr('y'),
      createReturnInstr(),
    ]);

    const pass = new ILPeepholePass();
    pass.run(func, { level: 'O2' });

    // Both LOAD_IMMs should remain
    expect(func.instructions).toHaveLength(5);
  });

  it('should NOT eliminate LOAD_IMM when A is modified between them', () => {
    // LOAD_IMM 5 / ADD_IMM 3 / LOAD_IMM 5 — ADD modifies A, second load needed
    const func = createTestFunction([
      createLoadImmInstr(5),
      createAddImmInstr(3),
      createLoadImmInstr(5),
      createReturnInstr(),
    ]);

    const pass = new ILPeepholePass();
    pass.run(func, { level: 'O2' });

    // A was modified by ADD_IMM, so second LOAD_IMM is needed
    expect(func.instructions).toHaveLength(4);
  });

  it('should NOT eliminate LOAD_IMM with LABEL between them', () => {
    // LOAD_IMM 0 / LABEL / LOAD_IMM 0 — control flow boundary
    const func = createTestFunction([
      createLoadImmInstr(0),
      createLabelInstr('.entry'),
      createLoadImmInstr(0),
      createReturnInstr(),
    ]);

    const pass = new ILPeepholePass();
    pass.run(func, { level: 'O2' });

    // Can't eliminate across control flow boundary
    expect(func.instructions).toHaveLength(4);
  });

  it('should NOT eliminate LOAD_IMM with JUMP between them', () => {
    // LOAD_IMM 0 / JUMP / LOAD_IMM 0 — jump is control flow
    const func = createTestFunction([
      createLoadImmInstr(0),
      createJumpInstr('.target'),
      createLoadImmInstr(0),
      createReturnInstr(),
    ]);

    const pass = new ILPeepholePass();
    pass.run(func, { level: 'O2' });

    // Can't eliminate across jump
    expect(func.instructions).toHaveLength(4);
  });

  it('should NOT eliminate LOAD_IMM with conditional branch between them', () => {
    // LOAD_IMM 0 / JUMP_EQ / LOAD_IMM 0 — conditional jump is control flow
    const func = createTestFunction([
      createLoadImmInstr(0),
      createJumpEqInstr('.target'),
      createLoadImmInstr(0),
      createReturnInstr(),
    ]);

    const pass = new ILPeepholePass();
    pass.run(func, { level: 'O2' });

    // Can't eliminate across conditional branch
    expect(func.instructions).toHaveLength(4);
  });

  it('should eliminate multiple redundant LOAD_IMMs in sequence', () => {
    // LOAD_IMM 0 / STORE x / LOAD_IMM 0 / STORE y / LOAD_IMM 0 / STORE z
    // Second and third LOAD_IMMs are redundant
    const func = createTestFunction([
      createLoadImmInstr(0),
      createStoreByteInstr('x'),
      createLoadImmInstr(0),         // redundant
      createStoreByteInstr('y'),
      createLoadImmInstr(0),         // redundant
      createStoreByteInstr('z'),
      createReturnInstr(),
    ]);

    const pass = new ILPeepholePass();
    const result = pass.run(func, { level: 'O2' });

    expect(result.modified).toBe(true);
    // Two redundant LOAD_IMMs removed: 7 - 2 = 5
    expect(func.instructions).toHaveLength(5);
  });

  it('should handle CMP_IMM between LOAD_IMMs (CMP does not modify A)', () => {
    // LOAD_IMM 5 / CMP_IMM 3 / LOAD_IMM 5 — CMP doesn't modify A
    const func = createTestFunction([
      createLoadImmInstr(5),
      createCmpImmInstr(3),
      createLoadImmInstr(5),         // redundant
      createReturnInstr(),
    ]);

    const pass = new ILPeepholePass();
    const result = pass.run(func, { level: 'O2' });

    expect(result.modified).toBe(true);
    expect(func.instructions).toHaveLength(3);
  });

  it('should NOT eliminate LOAD_IMM when LOAD_BYTE modifies A between them', () => {
    // LOAD_IMM 5 / LOAD_BYTE x / LOAD_IMM 5 — LOAD_BYTE modifies A
    const func = createTestFunction([
      createLoadImmInstr(5),
      createLoadByteInstr('x'),
      createLoadImmInstr(5),
      createReturnInstr(),
    ]);

    const pass = new ILPeepholePass();
    pass.run(func, { level: 'O2' });

    // LOAD_BYTE modifies A, so second LOAD_IMM is needed
    expect(func.instructions).toHaveLength(4);
  });
});
