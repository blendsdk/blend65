/**
 * Tests for Address Expression Folding — Store-Gap Pattern
 *
 * Tests the 4-instruction "store-gap" pattern that emerges when
 * loadStoreElimination removes LOAD_WORD but leaves behind a dead
 * STORE_WORD between LOAD_ADDRESS and SHR_WORD:
 *
 * LOAD_ADDRESS slot + STORE_WORD(dead) + SHR_WORD N + LO → LOAD_ADDRESS_EXPR
 *
 * Also tests inline-label load-store elimination patterns.
 *
 * @module __tests__/optimizer/passes/il-peephole-addr-expr-store-gap.test
 */

import { describe, it, expect } from 'vitest';
import { ILOpcode } from '../../../il/enums.js';
import {
  createLoadAddressInstr,
  createStoreWordInstr,
  createShrWordInstr,
  createLoInstr,
  createReturnInstr,
  createLoadWordInstr,
  createStoreByteInstr,
  createLoadByteInstr,
  createLabelInstr,
  createInlineContinuationLabelInstr,
  createTestFunction,
  TestableILPeepholePass,
  getSlotName,
} from './addr-expr-helpers.js';
import { ILPeepholePass } from '../../../optimizer/passes/il-peephole.js';
import { isImmediateOperand } from '../../../il/guards.js';

// ============================================================================
// Store-Gap Pattern: LOAD_ADDRESS + STORE_WORD(dead) + SHR_WORD + LO
// ============================================================================

describe('ILPeepholePass addressExprFolding — store-gap pattern', () => {
  it('should fold store-gap pattern with N=6 when STORE_WORD target is dead', () => {
    // This is the exact pattern that emerges after loadStoreElimination
    // removes the LOAD_WORD but leaves the dead STORE_WORD behind.
    const func = createTestFunction([
      createLoadAddressInstr('lineFrames', '__data_Mod_lineFrames'),
      createStoreWordInstr('paramSlot'),   // dead store — no subsequent LOAD_WORD
      createShrWordInstr(6),
      createLoInstr(),
      createReturnInstr(),
    ]);

    // Use TestableILPeepholePass to test addressExprFolding in isolation
    // (avoids loadStoreElimination removing the STORE first)
    const pass = new TestableILPeepholePass();
    const result = pass.runAddressExprFoldingOnly(func, { level: 'O3' });

    // 4 instructions → 1 LOAD_ADDRESS_EXPR + RETURN = 2
    expect(result.modified).toBe(true);
    expect(func.instructions).toHaveLength(2);
    expect(func.instructions[0].opcode).toBe(ILOpcode.LOAD_ADDRESS_EXPR);
    expect(getSlotName(func.instructions[0])).toBe('lineFrames');

    // Verify shift count operand
    const shiftOp = func.instructions[0].operands[1];
    expect(isImmediateOperand(shiftOp)).toBe(true);
    if (isImmediateOperand(shiftOp)) {
      expect(shiftOp.value).toBe(6);
    }
  });

  it('should NOT fold store-gap when STORE_WORD target slot is still live', () => {
    // The STORE_WORD target has a subsequent LOAD_WORD → NOT dead → skip
    const func = createTestFunction([
      createLoadAddressInstr('lineFrames', '__data_Mod_lineFrames'),
      createStoreWordInstr('paramSlot'),
      createShrWordInstr(6),
      createLoInstr(),
      createStoreByteInstr('result'),
      createLoadWordInstr('paramSlot'),  // reads paramSlot → it's live!
      createReturnInstr(),
    ]);

    const pass = new TestableILPeepholePass();
    const result = pass.runAddressExprFoldingOnly(func, { level: 'O3' });

    // Should NOT match — store-gap skipped because paramSlot is read later
    expect(result.modified).toBe(false);
    expect(func.instructions).toHaveLength(7);
  });

  it('should fold store-gap pattern with different shift counts', () => {
    // Test with N=3
    const func = createTestFunction([
      createLoadAddressInstr('table', '__data_Mod_table'),
      createStoreWordInstr('tmp'),
      createShrWordInstr(3),
      createLoInstr(),
      createReturnInstr(),
    ]);

    const pass = new TestableILPeepholePass();
    pass.runAddressExprFoldingOnly(func, { level: 'O3' });

    expect(func.instructions).toHaveLength(2);
    expect(func.instructions[0].opcode).toBe(ILOpcode.LOAD_ADDRESS_EXPR);

    const shiftOp = func.instructions[0].operands[1];
    if (isImmediateOperand(shiftOp)) {
      expect(shiftOp.value).toBe(3);
    }
  });

  it('should still match existing direct pattern (regression test)', () => {
    // Verify that the direct 3-instruction pattern still works
    const func = createTestFunction([
      createLoadAddressInstr('data', '__data_Mod_data'),
      createShrWordInstr(6),
      createLoInstr(),
      createReturnInstr(),
    ]);

    const pass = new TestableILPeepholePass();
    pass.runAddressExprFoldingOnly(func, { level: 'O2' });

    expect(func.instructions).toHaveLength(2);
    expect(func.instructions[0].opcode).toBe(ILOpcode.LOAD_ADDRESS_EXPR);
  });

  it('should still match existing gap pattern (regression test)', () => {
    // Verify that the 5-instruction STORE+LOAD gap still works
    const func = createTestFunction([
      createLoadAddressInstr('data', '__data_Mod_data'),
      createStoreWordInstr('paramSlot'),
      createLoadWordInstr('paramSlot'),
      createShrWordInstr(6),
      createLoInstr(),
      createReturnInstr(),
    ]);

    const pass = new TestableILPeepholePass();
    pass.runAddressExprFoldingOnly(func, { level: 'O2' });

    expect(func.instructions).toHaveLength(2);
    expect(func.instructions[0].opcode).toBe(ILOpcode.LOAD_ADDRESS_EXPR);
  });

  it('should prefer direct pattern over store-gap when SHR_WORD is at i+1', () => {
    // If SHR_WORD is directly after LOAD_ADDRESS, direct match wins
    // (even though the next instruction could look like a store-gap start)
    const func = createTestFunction([
      createLoadAddressInstr('data', '__data_Mod_data'),
      createShrWordInstr(6),
      createLoInstr(),
      createReturnInstr(),
    ]);

    const pass = new TestableILPeepholePass();
    pass.runAddressExprFoldingOnly(func, { level: 'O3' });

    // Direct match produces 1 LOAD_ADDRESS_EXPR
    expect(func.instructions).toHaveLength(2);
    expect(func.instructions[0].opcode).toBe(ILOpcode.LOAD_ADDRESS_EXPR);
  });
});

// ============================================================================
// Inline-Label Load-Store Elimination
// ============================================================================

describe('ILPeepholePass loadStoreElimination — inline label gap', () => {
  it('should eliminate LOAD_WORD after STORE_WORD across inline continuation label', () => {
    const func = createTestFunction([
      createStoreWordInstr('paramSlot'),
      createInlineContinuationLabelInstr('getSpriteFrame', 1),
      createLoadWordInstr('paramSlot'),
      createReturnInstr(),
    ]);

    const pass = new ILPeepholePass();
    const result = pass.run(func, { level: 'O3' });

    // LOAD_WORD should be removed — value still in A:X after STORE
    expect(result.modified).toBe(true);
    expect(func.instructions).toHaveLength(3);
    expect(func.instructions[0].opcode).toBe(ILOpcode.STORE_WORD);
    expect(func.instructions[1].opcode).toBe(ILOpcode.LABEL);
    expect(func.instructions[2].opcode).toBe(ILOpcode.RETURN);
  });

  it('should eliminate LOAD_BYTE after STORE_BYTE across inline continuation label', () => {
    const func = createTestFunction([
      createStoreByteInstr('counter'),
      createInlineContinuationLabelInstr('updateCounter', 2),
      createLoadByteInstr('counter'),
      createReturnInstr(),
    ]);

    const pass = new ILPeepholePass();
    const result = pass.run(func, { level: 'O3' });

    // LOAD_BYTE should be removed — value still in A after STORE
    expect(result.modified).toBe(true);
    expect(func.instructions).toHaveLength(3);
    expect(func.instructions[0].opcode).toBe(ILOpcode.STORE_BYTE);
    expect(func.instructions[1].opcode).toBe(ILOpcode.LABEL);
    expect(func.instructions[2].opcode).toBe(ILOpcode.RETURN);
  });

  it('should NOT eliminate when label is NOT an inline continuation label', () => {
    const func = createTestFunction([
      createStoreWordInstr('paramSlot'),
      createLabelInstr('some_other_label'),  // NOT an inline continuation label
      createLoadWordInstr('paramSlot'),
      createReturnInstr(),
    ]);

    const pass = new ILPeepholePass();
    pass.run(func, { level: 'O3' });

    // Should keep all 4 instructions — non-inline label is a real merge point
    expect(func.instructions).toHaveLength(4);
  });

  it('should NOT eliminate when slots do not match', () => {
    const func = createTestFunction([
      createStoreWordInstr('slotA'),
      createInlineContinuationLabelInstr('func', 1),
      createLoadWordInstr('slotB'),  // different slot!
      createReturnInstr(),
    ]);

    const pass = new ILPeepholePass();
    pass.run(func, { level: 'O3' });

    // Should keep all 4 — different slots means the LOAD is needed
    expect(func.instructions).toHaveLength(4);
  });

  it('should NOT eliminate LOAD_BYTE when slots mismatch across inline label', () => {
    const func = createTestFunction([
      createStoreByteInstr('x'),
      createInlineContinuationLabelInstr('func', 1),
      createLoadByteInstr('y'),  // different slot!
      createReturnInstr(),
    ]);

    const pass = new ILPeepholePass();
    pass.run(func, { level: 'O3' });

    expect(func.instructions).toHaveLength(4);
  });
});
