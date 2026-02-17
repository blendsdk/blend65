/**
 * Tests for Copy Propagation Pass
 *
 * @module __tests__/optimizer/passes/copy-prop.test
 */

import { describe, it, expect } from 'vitest';
import { CopyPropPass } from '../../../optimizer/passes/copy-prop.js';
import { ILOpcode } from '../../../il/enums.js';
import type { ILFunction } from '../../../il/structures.js';
import type { ILInstruction } from '../../../il/instruction.js';
import { createSlotOperand, createImmediateOperand, createLabelOperand } from '../../../il/factories.js';
import { SlotKind, SlotLocation } from '../../../frame/enums.js';
import type { FrameSlot } from '../../../frame/types.js';
import { isSlotOperand } from '../../../il/guards.js';

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

function createLabelInstr(name: string): ILInstruction {
  return {
    opcode: ILOpcode.LABEL,
    operands: [createLabelOperand(name)],
    defUse: { defs: [], uses: [] },
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

function getSlotName(instr: ILInstruction): string | null {
  if (instr.operands.length === 0) return null;
  const op = instr.operands[0];
  return isSlotOperand(op) ? op.slot.name : null;
}

// ============================================================================
// CopyPropPass Interface Tests
// ============================================================================

describe('CopyPropPass interface', () => {
  it('should have correct name', () => {
    const pass = new CopyPropPass();
    expect(pass.name).toBe('copy-prop');
  });

  it('should have no dependencies', () => {
    const pass = new CopyPropPass();
    expect(pass.dependencies).toEqual([]);
  });
});

// ============================================================================
// Simple Copy Tests
// ============================================================================

describe('CopyPropPass simple copy', () => {
  it('should propagate y=x; use y → use x', () => {
    // y = x; use y;
    const func = createTestFunction([
      createLoadByteInstr('x'),
      createStoreByteInstr('y'),
      createLoadByteInstr('y'),
      createReturnInstr(),
    ]);

    const pass = new CopyPropPass();
    const result = pass.run(func, { level: 'O2' });

    expect(result.modified).toBe(true);
    expect(result.instructionsAdded).toBe(1);
    expect(func.instructions[2].opcode).toBe(ILOpcode.LOAD_BYTE);
    expect(getSlotName(func.instructions[2])).toBe('x');
  });

  it('should propagate multiple uses of copy', () => {
    // y = x; use y; use y;
    const func = createTestFunction([
      createLoadByteInstr('x'),
      createStoreByteInstr('y'),
      createLoadByteInstr('y'),
      createLoadByteInstr('y'),
      createReturnInstr(),
    ]);

    const pass = new CopyPropPass();
    const result = pass.run(func, { level: 'O2' });

    expect(result.modified).toBe(true);
    expect(result.instructionsAdded).toBe(2);
    expect(getSlotName(func.instructions[2])).toBe('x');
    expect(getSlotName(func.instructions[3])).toBe('x');
  });
});

// ============================================================================
// Invalidation Tests
// ============================================================================

describe('CopyPropPass invalidation', () => {
  it('should NOT propagate after source modified', () => {
    // y = x; x = 5; use y;
    const func = createTestFunction([
      createLoadByteInstr('x'),
      createStoreByteInstr('y'),
      createLoadImmInstr(5),
      createStoreByteInstr('x'),
      createLoadByteInstr('y'),
      createReturnInstr(),
    ]);

    const pass = new CopyPropPass();
    const result = pass.run(func, { level: 'O2' });

    // y is no longer valid after x is modified
    expect(getSlotName(func.instructions[4])).toBe('y');
  });

  it('should NOT propagate after target modified', () => {
    // y = x; y = 5; use y;
    const func = createTestFunction([
      createLoadByteInstr('x'),
      createStoreByteInstr('y'),
      createLoadImmInstr(5),
      createStoreByteInstr('y'),
      createLoadByteInstr('y'),
      createReturnInstr(),
    ]);

    const pass = new CopyPropPass();
    const result = pass.run(func, { level: 'O2' });

    // y is overwritten with constant, no longer copy of x
    expect(getSlotName(func.instructions[4])).toBe('y');
  });

  it('should NOT propagate after label', () => {
    // y = x; .label: use y;
    const func = createTestFunction([
      createLoadByteInstr('x'),
      createStoreByteInstr('y'),
      createLabelInstr('loop'),
      createLoadByteInstr('y'),
      createReturnInstr(),
    ]);

    const pass = new CopyPropPass();
    const result = pass.run(func, { level: 'O2' });

    expect(result.modified).toBe(false);
    expect(getSlotName(func.instructions[3])).toBe('y');
  });

  it('should NOT propagate after jump', () => {
    // y = x; jump; use y;
    const func = createTestFunction([
      createLoadByteInstr('x'),
      createStoreByteInstr('y'),
      createJumpInstr('end'),
      createLoadByteInstr('y'),
      createReturnInstr(),
    ]);

    const pass = new CopyPropPass();
    const result = pass.run(func, { level: 'O2' });

    expect(result.modified).toBe(false);
    expect(getSlotName(func.instructions[3])).toBe('y');
  });
});

// ============================================================================
// No Propagation Tests
// ============================================================================

describe('CopyPropPass no propagation', () => {
  it('should NOT propagate unknown variable', () => {
    const func = createTestFunction([
      createLoadByteInstr('x'),
      createReturnInstr(),
    ]);

    const pass = new CopyPropPass();
    const result = pass.run(func, { level: 'O2' });

    expect(result.modified).toBe(false);
  });

  it('should handle empty function', () => {
    const func = createTestFunction([]);

    const pass = new CopyPropPass();
    const result = pass.run(func, { level: 'O2' });

    expect(result.modified).toBe(false);
    expect(func.instructions).toHaveLength(0);
  });
});

// ============================================================================
// Debug Output Tests
// ============================================================================

describe('CopyPropPass debug output', () => {
  it('should include debug info when debug=true', () => {
    const func = createTestFunction([
      createLoadByteInstr('x'),
      createStoreByteInstr('y'),
      createLoadByteInstr('y'),
      createReturnInstr(),
    ]);

    const pass = new CopyPropPass();
    const result = pass.run(func, { level: 'O2', debug: true });

    expect(result.debugInfo).toBeDefined();
    expect(result.debugInfo!.length).toBeGreaterThan(0);
  });

  it('should not include debug info when debug=false', () => {
    const func = createTestFunction([
      createLoadByteInstr('x'),
      createStoreByteInstr('y'),
      createLoadByteInstr('y'),
      createReturnInstr(),
    ]);

    const pass = new CopyPropPass();
    const result = pass.run(func, { level: 'O2', debug: false });

    expect(result.debugInfo).toBeUndefined();
  });
});

// ============================================================================
// Inline Continuation Label Transparency Tests
// ============================================================================

describe('CopyPropPass inline continuation label transparency', () => {
  it('should propagate copy THROUGH inline continuation label', () => {
    // y = x;
    // LABEL _inline_getSpriteFrame_0_cont  ← inline continuation label
    // use y;  ← should be replaced with use x
    const func = createTestFunction([
      createLoadByteInstr('x'),
      createStoreByteInstr('y'),
      createLabelInstr('_inline_getSpriteFrame_0_cont'),
      createLoadByteInstr('y'),
      createReturnInstr(),
    ]);

    const pass = new CopyPropPass();
    const result = pass.run(func, { level: 'O2' });

    // Copy SHOULD propagate through inline continuation label
    expect(result.modified).toBe(true);
    expect(func.instructions[3].opcode).toBe(ILOpcode.LOAD_BYTE);
    expect(getSlotName(func.instructions[3])).toBe('x');
  });

  it('should propagate multiple copies through inline continuation label', () => {
    // y = x; z = w;
    // LABEL _inline_fn_0_cont
    // use y; use z;
    const func = createTestFunction([
      createLoadByteInstr('x'),
      createStoreByteInstr('y'),
      createLoadByteInstr('w'),
      createStoreByteInstr('z'),
      createLabelInstr('_inline_fn_0_cont'),
      createLoadByteInstr('y'),
      createLoadByteInstr('z'),
      createReturnInstr(),
    ]);

    const pass = new CopyPropPass();
    const result = pass.run(func, { level: 'O2' });

    expect(result.modified).toBe(true);
    expect(result.instructionsAdded).toBe(2);
    expect(getSlotName(func.instructions[5])).toBe('x');
    expect(getSlotName(func.instructions[6])).toBe('w');
  });

  it('should propagate through multiple inline continuation labels', () => {
    // y = x;
    // LABEL _inline_fn_0_cont
    // LABEL _inline_fn_1_cont
    // use y;
    const func = createTestFunction([
      createLoadByteInstr('x'),
      createStoreByteInstr('y'),
      createLabelInstr('_inline_fn_0_cont'),
      createLabelInstr('_inline_fn_1_cont'),
      createLoadByteInstr('y'),
      createReturnInstr(),
    ]);

    const pass = new CopyPropPass();
    pass.run(func, { level: 'O2' });

    expect(func.instructions[4].opcode).toBe(ILOpcode.LOAD_BYTE);
    expect(getSlotName(func.instructions[4])).toBe('x');
  });

  it('should still KILL copies at regular labels (safety)', () => {
    // y = x;
    // LABEL loop_start  ← regular label, NOT inline continuation
    // use y;  ← should NOT be replaced
    const func = createTestFunction([
      createLoadByteInstr('x'),
      createStoreByteInstr('y'),
      createLabelInstr('loop_start'),
      createLoadByteInstr('y'),
      createReturnInstr(),
    ]);

    const pass = new CopyPropPass();
    const result = pass.run(func, { level: 'O2' });

    // Regular label MUST kill copy state
    expect(result.modified).toBe(false);
    expect(getSlotName(func.instructions[3])).toBe('y');
  });

  it('should NOT propagate through inline ENTRY labels (only _cont)', () => {
    // y = x;
    // LABEL _inline_fn_0_entry  ← inline entry label, NOT continuation
    // use y;
    const func = createTestFunction([
      createLoadByteInstr('x'),
      createStoreByteInstr('y'),
      createLabelInstr('_inline_fn_0_entry'),
      createLoadByteInstr('y'),
      createReturnInstr(),
    ]);

    const pass = new CopyPropPass();
    const result = pass.run(func, { level: 'O2' });

    // Entry labels are NOT continuation labels — must kill state
    expect(result.modified).toBe(false);
    expect(getSlotName(func.instructions[3])).toBe('y');
  });

  it('should handle mixed inline and regular labels correctly', () => {
    // y = x;
    // LABEL _inline_fn_0_cont   ← transparent
    // use y;                     ← should use x
    // LABEL regular_label        ← kills state
    // use y;                     ← should stay y
    const func = createTestFunction([
      createLoadByteInstr('x'),
      createStoreByteInstr('y'),
      createLabelInstr('_inline_fn_0_cont'),
      createLoadByteInstr('y'), // index 3 - should propagate
      createLabelInstr('regular_label'),
      createLoadByteInstr('y'), // index 5 - should NOT propagate
      createReturnInstr(),
    ]);

    const pass = new CopyPropPass();
    const result = pass.run(func, { level: 'O2' });

    expect(result.modified).toBe(true);
    expect(result.instructionsAdded).toBe(1);
    // After inline cont label: propagation works
    expect(getSlotName(func.instructions[3])).toBe('x');
    // After regular label: propagation killed
    expect(getSlotName(func.instructions[5])).toBe('y');
  });

  it('should track new copies AFTER inline continuation label', () => {
    // y = x;
    // LABEL _inline_fn_0_cont
    // z = w;
    // use z;  ← should use w (tracked after the label)
    const func = createTestFunction([
      createLoadByteInstr('x'),
      createStoreByteInstr('y'),
      createLabelInstr('_inline_fn_0_cont'),
      createLoadByteInstr('w'),
      createStoreByteInstr('z'),
      createLoadByteInstr('z'),
      createReturnInstr(),
    ]);

    const pass = new CopyPropPass();
    pass.run(func, { level: 'O2' });

    expect(getSlotName(func.instructions[5])).toBe('w');
  });

  it('should propagate param slot through inline continuation (real-world pattern)', () => {
    // Simulates: LOAD_BYTE frame → STORE_BYTE $02 → LABEL _inline_fn_0_cont → LOAD_BYTE $02
    // After copy-prop: LOAD_BYTE $02 → LOAD_BYTE frame
    const func = createTestFunction([
      createLoadByteInstr('frame'),
      createStoreByteInstr('$02'),
      createLabelInstr('_inline_getSpriteFrame_0_cont'),
      createLoadByteInstr('$02'),
      createReturnInstr(),
    ]);

    const pass = new CopyPropPass();
    const result = pass.run(func, { level: 'O2' });

    expect(result.modified).toBe(true);
    // $02 should be replaced with frame (the original)
    expect(getSlotName(func.instructions[3])).toBe('frame');
  });
});

// ============================================================================
// Integration Tests
// ============================================================================

describe('CopyPropPass integration', () => {
  it('should work with PassManager', async () => {
    const { PassManager } = await import('../../../optimizer/pass-manager.js');

    const manager = new PassManager({
      level: 'O2',
      enabledPasses: ['copy-prop'],
    });
    manager.registerPass(new CopyPropPass());

    const func = createTestFunction([
      createLoadByteInstr('x'),
      createStoreByteInstr('y'),
      createLoadByteInstr('y'),
      createReturnInstr(),
    ]);

    const result = manager.optimize(func);

    expect(result.modified).toBe(true);
    expect(result.stats).toHaveLength(1);
    expect(result.stats[0].pass).toBe('copy-prop');
  });
});