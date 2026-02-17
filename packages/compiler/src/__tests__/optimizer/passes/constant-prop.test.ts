/**
 * Tests for Constant Propagation Pass
 *
 * @module __tests__/optimizer/passes/constant-prop.test
 */

import { describe, it, expect } from 'vitest';
import { ConstantPropPass } from '../../../optimizer/passes/constant-prop.js';
import { ILOpcode } from '../../../il/enums.js';
import type { ILFunction } from '../../../il/structures.js';
import type { ILInstruction } from '../../../il/instruction.js';
import {
  createSlotOperand,
  createImmediateOperand,
  createLabelOperand,
  createFunctionOperand,
} from '../../../il/factories.js';
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
 * Create an INC_BYTE instruction.
 */
function createIncByteInstr(slotName: string): ILInstruction {
  const slot = createTestSlot(slotName);
  return {
    opcode: ILOpcode.INC_BYTE,
    operands: [createSlotOperand(slot)],
    defUse: { defs: [slotName], uses: [slotName] },
  };
}

/**
 * Create an ADD_BYTE instruction.
 */
function createAddByteInstr(slotName: string): ILInstruction {
  const slot = createTestSlot(slotName);
  return {
    opcode: ILOpcode.ADD_BYTE,
    operands: [createSlotOperand(slot)],
    defUse: { defs: [], uses: [slotName] },
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
 * Create a JUMP_EQ instruction.
 */
function createJumpEqInstr(label: string): ILInstruction {
  return {
    opcode: ILOpcode.JUMP_EQ,
    operands: [createLabelOperand(label)],
    defUse: { defs: [], uses: [] },
  };
}

/**
 * Create a CALL instruction.
 */
function createCallInstr(name: string): ILInstruction {
  return {
    opcode: ILOpcode.CALL,
    operands: [createFunctionOperand(name)],
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

/**
 * Get immediate value from instruction.
 */
function getImmValue(instr: ILInstruction): number | null {
  if (instr.operands.length === 0) return null;
  const op = instr.operands[0];
  return isImmediateOperand(op) ? op.value : null;
}

// ============================================================================
// ConstantPropPass Interface Tests
// ============================================================================

describe('ConstantPropPass interface', () => {
  it('should have correct name', () => {
    const prop = new ConstantPropPass();
    expect(prop.name).toBe('constant-prop');
  });

  it('should have no dependencies', () => {
    const prop = new ConstantPropPass();
    expect(prop.dependencies).toEqual([]);
  });
});

// ============================================================================
// Simple Propagation Tests
// ============================================================================

describe('ConstantPropPass simple propagation', () => {
  it('should propagate x=5; use x', () => {
    // x = 5;
    // use x;
    const func = createTestFunction([
      createLoadImmInstr(5),
      createStoreByteInstr('x'),
      createLoadByteInstr('x'),
      createReturnInstr(),
    ]);

    const prop = new ConstantPropPass();
    const result = prop.run(func, { level: 'O2' });

    expect(result.modified).toBe(true);
    expect(result.instructionsAdded).toBe(1); // One replacement
    expect(func.instructions[2].opcode).toBe(ILOpcode.LOAD_IMM);
    expect(getImmValue(func.instructions[2])).toBe(5);
  });

  it('should propagate multiple uses of same constant', () => {
    // x = 5;
    // use x;
    // use x;
    const func = createTestFunction([
      createLoadImmInstr(5),
      createStoreByteInstr('x'),
      createLoadByteInstr('x'),
      createLoadByteInstr('x'),
      createReturnInstr(),
    ]);

    const prop = new ConstantPropPass();
    const result = prop.run(func, { level: 'O2' });

    expect(result.modified).toBe(true);
    expect(result.instructionsAdded).toBe(2);
    expect(func.instructions[2].opcode).toBe(ILOpcode.LOAD_IMM);
    expect(func.instructions[3].opcode).toBe(ILOpcode.LOAD_IMM);
    expect(getImmValue(func.instructions[2])).toBe(5);
    expect(getImmValue(func.instructions[3])).toBe(5);
  });

  it('should propagate zero constant', () => {
    const func = createTestFunction([
      createLoadImmInstr(0),
      createStoreByteInstr('x'),
      createLoadByteInstr('x'),
      createReturnInstr(),
    ]);

    const prop = new ConstantPropPass();
    prop.run(func, { level: 'O2' });

    expect(func.instructions[2].opcode).toBe(ILOpcode.LOAD_IMM);
    expect(getImmValue(func.instructions[2])).toBe(0);
  });

  it('should propagate 255 constant', () => {
    const func = createTestFunction([
      createLoadImmInstr(255),
      createStoreByteInstr('mask'),
      createLoadByteInstr('mask'),
      createReturnInstr(),
    ]);

    const prop = new ConstantPropPass();
    prop.run(func, { level: 'O2' });

    expect(getImmValue(func.instructions[2])).toBe(255);
  });
});

// ============================================================================
// Multiple Variables Tests
// ============================================================================

describe('ConstantPropPass multiple variables', () => {
  it('should track multiple constants', () => {
    // x = 5;
    // y = 10;
    // use x;
    // use y;
    const func = createTestFunction([
      createLoadImmInstr(5),
      createStoreByteInstr('x'),
      createLoadImmInstr(10),
      createStoreByteInstr('y'),
      createLoadByteInstr('x'),
      createLoadByteInstr('y'),
      createReturnInstr(),
    ]);

    const prop = new ConstantPropPass();
    const result = prop.run(func, { level: 'O2' });

    expect(result.modified).toBe(true);
    expect(result.instructionsAdded).toBe(2);
    expect(getImmValue(func.instructions[4])).toBe(5);
    expect(getImmValue(func.instructions[5])).toBe(10);
  });

  it('should NOT propagate unknown variable', () => {
    // x = 5;
    // use y; // y not known
    const func = createTestFunction([
      createLoadImmInstr(5),
      createStoreByteInstr('x'),
      createLoadByteInstr('y'),
      createReturnInstr(),
    ]);

    const prop = new ConstantPropPass();
    const result = prop.run(func, { level: 'O2' });

    expect(result.modified).toBe(false);
    expect(func.instructions[2].opcode).toBe(ILOpcode.LOAD_BYTE);
  });
});

// ============================================================================
// Overwrite Tests
// ============================================================================

describe('ConstantPropPass overwrite handling', () => {
  it('should propagate updated constant', () => {
    // x = 5;
    // x = 10;
    // use x;
    const func = createTestFunction([
      createLoadImmInstr(5),
      createStoreByteInstr('x'),
      createLoadImmInstr(10),
      createStoreByteInstr('x'),
      createLoadByteInstr('x'),
      createReturnInstr(),
    ]);

    const prop = new ConstantPropPass();
    const result = prop.run(func, { level: 'O2' });

    expect(result.modified).toBe(true);
    expect(getImmValue(func.instructions[4])).toBe(10);
  });

  it('should NOT propagate after non-constant store', () => {
    // x = 5;
    // x = y (not constant);
    // use x;
    const func = createTestFunction([
      createLoadImmInstr(5),
      createStoreByteInstr('x'),
      createLoadByteInstr('y'), // Load from y
      createStoreByteInstr('x'), // Store to x (non-constant)
      createLoadByteInstr('x'),
      createReturnInstr(),
    ]);

    const prop = new ConstantPropPass();
    const result = prop.run(func, { level: 'O2' });

    // x is no longer known after being overwritten with non-constant
    expect(func.instructions[4].opcode).toBe(ILOpcode.LOAD_BYTE);
  });

  it('should NOT propagate after INC_BYTE', () => {
    // x = 5;
    // x++;
    // use x;
    const func = createTestFunction([
      createLoadImmInstr(5),
      createStoreByteInstr('x'),
      createIncByteInstr('x'),
      createLoadByteInstr('x'),
      createReturnInstr(),
    ]);

    const prop = new ConstantPropPass();
    const result = prop.run(func, { level: 'O2' });

    // x is no longer known after increment
    expect(func.instructions[3].opcode).toBe(ILOpcode.LOAD_BYTE);
  });
});

// ============================================================================
// Control Flow Invalidation Tests
// ============================================================================

describe('ConstantPropPass control flow invalidation', () => {
  it('should NOT propagate after label', () => {
    // x = 5;
    // .label:
    // use x;
    const func = createTestFunction([
      createLoadImmInstr(5),
      createStoreByteInstr('x'),
      createLabelInstr('loop'),
      createLoadByteInstr('x'),
      createReturnInstr(),
    ]);

    const prop = new ConstantPropPass();
    const result = prop.run(func, { level: 'O2' });

    // x is not known after label (could have jumped here from elsewhere)
    expect(result.modified).toBe(false);
    expect(func.instructions[3].opcode).toBe(ILOpcode.LOAD_BYTE);
  });

  it('should NOT propagate after unconditional jump', () => {
    // x = 5;
    // JUMP .skip
    // use x;
    const func = createTestFunction([
      createLoadImmInstr(5),
      createStoreByteInstr('x'),
      createJumpInstr('skip'),
      createLoadByteInstr('x'),
      createReturnInstr(),
    ]);

    const prop = new ConstantPropPass();
    const result = prop.run(func, { level: 'O2' });

    expect(result.modified).toBe(false);
    expect(func.instructions[3].opcode).toBe(ILOpcode.LOAD_BYTE);
  });

  it('should NOT propagate after conditional jump', () => {
    // x = 5;
    // JUMP_EQ .skip
    // use x;
    const func = createTestFunction([
      createLoadImmInstr(5),
      createStoreByteInstr('x'),
      createJumpEqInstr('skip'),
      createLoadByteInstr('x'),
      createReturnInstr(),
    ]);

    const prop = new ConstantPropPass();
    const result = prop.run(func, { level: 'O2' });

    expect(result.modified).toBe(false);
    expect(func.instructions[3].opcode).toBe(ILOpcode.LOAD_BYTE);
  });

  it('should NOT propagate after call', () => {
    // x = 5;
    // CALL fn
    // use x;
    const func = createTestFunction([
      createLoadImmInstr(5),
      createStoreByteInstr('x'),
      createCallInstr('fn'),
      createLoadByteInstr('x'),
      createReturnInstr(),
    ]);

    const prop = new ConstantPropPass();
    const result = prop.run(func, { level: 'O2' });

    expect(result.modified).toBe(false);
    expect(func.instructions[3].opcode).toBe(ILOpcode.LOAD_BYTE);
  });
});

// ============================================================================
// Edge Cases Tests
// ============================================================================

describe('ConstantPropPass edge cases', () => {
  it('should handle empty function', () => {
    const func = createTestFunction([]);

    const prop = new ConstantPropPass();
    const result = prop.run(func, { level: 'O2' });

    expect(result.modified).toBe(false);
    expect(func.instructions).toHaveLength(0);
  });

  it('should handle function with only return', () => {
    const func = createTestFunction([createReturnInstr()]);

    const prop = new ConstantPropPass();
    const result = prop.run(func, { level: 'O2' });

    expect(result.modified).toBe(false);
    expect(func.instructions).toHaveLength(1);
  });

  it('should handle no propagation opportunities', () => {
    // No constant stores
    const func = createTestFunction([
      createLoadByteInstr('x'),
      createStoreByteInstr('y'),
      createReturnInstr(),
    ]);

    const prop = new ConstantPropPass();
    const result = prop.run(func, { level: 'O2' });

    expect(result.modified).toBe(false);
  });
});

// ============================================================================
// Debug Output Tests
// ============================================================================

describe('ConstantPropPass debug output', () => {
  it('should include debug info when debug=true', () => {
    const func = createTestFunction([
      createLoadImmInstr(5),
      createStoreByteInstr('x'),
      createLoadByteInstr('x'),
      createReturnInstr(),
    ]);

    const prop = new ConstantPropPass();
    const result = prop.run(func, { level: 'O2', debug: true });

    expect(result.debugInfo).toBeDefined();
    expect(result.debugInfo!.length).toBeGreaterThan(0);
    // Should mention tracking or propagating
    const hasTrackingInfo = result.debugInfo!.some(
      (info) => info.includes('Tracking') || info.includes('Propagated')
    );
    expect(hasTrackingInfo).toBe(true);
  });

  it('should not include debug info when debug=false', () => {
    const func = createTestFunction([
      createLoadImmInstr(5),
      createStoreByteInstr('x'),
      createLoadByteInstr('x'),
      createReturnInstr(),
    ]);

    const prop = new ConstantPropPass();
    const result = prop.run(func, { level: 'O2', debug: false });

    expect(result.debugInfo).toBeUndefined();
  });
});

// ============================================================================
// Inline Continuation Label Transparency Tests
// ============================================================================

describe('ConstantPropPass inline continuation label transparency', () => {
  it('should propagate constant THROUGH inline continuation label', () => {
    // x = 5;
    // LABEL _inline_getSpriteFrame_0_cont  ← inline continuation label
    // use x;  ← should still see x = 5
    const func = createTestFunction([
      createLoadImmInstr(5),
      createStoreByteInstr('x'),
      createLabelInstr('_inline_getSpriteFrame_0_cont'),
      createLoadByteInstr('x'),
      createReturnInstr(),
    ]);

    const prop = new ConstantPropPass();
    const result = prop.run(func, { level: 'O2' });

    // Constant SHOULD propagate through inline continuation label
    expect(result.modified).toBe(true);
    expect(func.instructions[3].opcode).toBe(ILOpcode.LOAD_IMM);
    expect(getImmValue(func.instructions[3])).toBe(5);
  });

  it('should propagate zero constant through inline continuation label', () => {
    // x = 0;
    // LABEL _inline_fn_1_cont
    // use x;
    const func = createTestFunction([
      createLoadImmInstr(0),
      createStoreByteInstr('x'),
      createLabelInstr('_inline_fn_1_cont'),
      createLoadByteInstr('x'),
      createReturnInstr(),
    ]);

    const prop = new ConstantPropPass();
    prop.run(func, { level: 'O2' });

    expect(func.instructions[3].opcode).toBe(ILOpcode.LOAD_IMM);
    expect(getImmValue(func.instructions[3])).toBe(0);
  });

  it('should propagate multiple constants through inline continuation label', () => {
    // x = 5; y = 10;
    // LABEL _inline_fn_0_cont
    // use x; use y;
    const func = createTestFunction([
      createLoadImmInstr(5),
      createStoreByteInstr('x'),
      createLoadImmInstr(10),
      createStoreByteInstr('y'),
      createLabelInstr('_inline_fn_0_cont'),
      createLoadByteInstr('x'),
      createLoadByteInstr('y'),
      createReturnInstr(),
    ]);

    const prop = new ConstantPropPass();
    const result = prop.run(func, { level: 'O2' });

    expect(result.modified).toBe(true);
    expect(result.instructionsAdded).toBe(2);
    expect(getImmValue(func.instructions[5])).toBe(5);
    expect(getImmValue(func.instructions[6])).toBe(10);
  });

  it('should propagate through multiple inline continuation labels', () => {
    // x = 42;
    // LABEL _inline_fn_0_cont
    // LABEL _inline_fn_1_cont
    // use x;
    const func = createTestFunction([
      createLoadImmInstr(42),
      createStoreByteInstr('x'),
      createLabelInstr('_inline_fn_0_cont'),
      createLabelInstr('_inline_fn_1_cont'),
      createLoadByteInstr('x'),
      createReturnInstr(),
    ]);

    const prop = new ConstantPropPass();
    prop.run(func, { level: 'O2' });

    expect(func.instructions[4].opcode).toBe(ILOpcode.LOAD_IMM);
    expect(getImmValue(func.instructions[4])).toBe(42);
  });

  it('should still KILL constants at regular labels (safety)', () => {
    // x = 5;
    // LABEL loop_start  ← regular label, NOT inline continuation
    // use x;  ← should NOT see x = 5
    const func = createTestFunction([
      createLoadImmInstr(5),
      createStoreByteInstr('x'),
      createLabelInstr('loop_start'),
      createLoadByteInstr('x'),
      createReturnInstr(),
    ]);

    const prop = new ConstantPropPass();
    const result = prop.run(func, { level: 'O2' });

    // Regular label MUST kill constant state
    expect(result.modified).toBe(false);
    expect(func.instructions[3].opcode).toBe(ILOpcode.LOAD_BYTE);
  });

  it('should NOT propagate through inline ENTRY labels (only _cont)', () => {
    // Entry labels could be branch targets — only _cont labels are safe
    // x = 5;
    // LABEL _inline_fn_0_entry  ← inline entry label, NOT continuation
    // use x;
    const func = createTestFunction([
      createLoadImmInstr(5),
      createStoreByteInstr('x'),
      createLabelInstr('_inline_fn_0_entry'),
      createLoadByteInstr('x'),
      createReturnInstr(),
    ]);

    const prop = new ConstantPropPass();
    const result = prop.run(func, { level: 'O2' });

    // Entry labels are NOT continuation labels — must kill state
    expect(result.modified).toBe(false);
    expect(func.instructions[3].opcode).toBe(ILOpcode.LOAD_BYTE);
  });

  it('should handle mixed inline and regular labels correctly', () => {
    // x = 5;
    // LABEL _inline_fn_0_cont   ← transparent
    // use x;                     ← should see x = 5
    // LABEL regular_label        ← kills state
    // use x;                     ← should NOT see x = 5
    const func = createTestFunction([
      createLoadImmInstr(5),
      createStoreByteInstr('x'),
      createLabelInstr('_inline_fn_0_cont'),
      createLoadByteInstr('x'), // index 3 - should propagate
      createLabelInstr('regular_label'),
      createLoadByteInstr('x'), // index 5 - should NOT propagate
      createReturnInstr(),
    ]);

    const prop = new ConstantPropPass();
    const result = prop.run(func, { level: 'O2' });

    expect(result.modified).toBe(true);
    expect(result.instructionsAdded).toBe(1);
    // After inline cont label: propagation works
    expect(func.instructions[3].opcode).toBe(ILOpcode.LOAD_IMM);
    expect(getImmValue(func.instructions[3])).toBe(5);
    // After regular label: propagation killed
    expect(func.instructions[5].opcode).toBe(ILOpcode.LOAD_BYTE);
  });

  it('should track new constants AFTER inline continuation label', () => {
    // x = 5;
    // LABEL _inline_fn_0_cont
    // y = 10;
    // use y;  ← should see y = 10 (tracked after the label)
    const func = createTestFunction([
      createLoadImmInstr(5),
      createStoreByteInstr('x'),
      createLabelInstr('_inline_fn_0_cont'),
      createLoadImmInstr(10),
      createStoreByteInstr('y'),
      createLoadByteInstr('y'),
      createReturnInstr(),
    ]);

    const prop = new ConstantPropPass();
    prop.run(func, { level: 'O2' });

    expect(func.instructions[5].opcode).toBe(ILOpcode.LOAD_IMM);
    expect(getImmValue(func.instructions[5])).toBe(10);
  });
});

// ============================================================================
// Integration Tests
// ============================================================================

describe('ConstantPropPass integration', () => {
  it('should work with PassManager', async () => {
    const { PassManager } = await import('../../../optimizer/pass-manager.js');

    const manager = new PassManager({
      level: 'O2',
      enabledPasses: ['constant-prop'],
    });
    manager.registerPass(new ConstantPropPass());

    const func = createTestFunction([
      createLoadImmInstr(5),
      createStoreByteInstr('x'),
      createLoadByteInstr('x'),
      createReturnInstr(),
    ]);

    const result = manager.optimize(func);

    expect(result.modified).toBe(true);
    expect(result.stats).toHaveLength(1);
    expect(result.stats[0].pass).toBe('constant-prop');
  });

  it('should work with constant folding for cascade', async () => {
    const { PassManager } = await import('../../../optimizer/pass-manager.js');
    const { ConstantFoldPass } = await import('../../../optimizer/passes/constant-fold.js');

    const manager = new PassManager({
      level: 'O2',
      enabledPasses: ['constant-fold', 'constant-prop'],
    });
    manager.registerPass(new ConstantFoldPass());
    manager.registerPass(new ConstantPropPass());

    // x = 5;
    // use x; // propagated to LOAD_IMM 5
    // y = x + 3; // x propagated, then 5+3 can be folded
    const func = createTestFunction([
      createLoadImmInstr(5),
      createStoreByteInstr('x'),
      createLoadByteInstr('x'),
      createStoreByteInstr('y'),
      createReturnInstr(),
    ]);

    const result = manager.optimize(func);

    expect(result.modified).toBe(true);
    // After propagation, LOAD_BYTE x becomes LOAD_IMM 5
    expect(func.instructions[2].opcode).toBe(ILOpcode.LOAD_IMM);
    expect(getImmValue(func.instructions[2])).toBe(5);
  });
});