/**
 * Tests for Address Expression Folding — Gap Pattern (store/reload)
 *
 * Tests the 5-instruction gap pattern in ISOLATION using TestableILPeepholePass.
 * This is necessary because the full run() method runs load-store elimination
 * before address expression folding, which removes the STORE_WORD/LOAD_WORD
 * pair before the gap matcher can see it.
 *
 * Pattern: LOAD_ADDRESS slot + STORE_WORD slotX + LOAD_WORD slotX + SHR_WORD N + LO
 * → LOAD_ADDRESS_EXPR slot, N
 *
 * @module __tests__/optimizer/passes/il-peephole-addr-expr-gap.test
 */

import { describe, it, expect } from 'vitest';
import { ILOpcode } from '../../../il/enums.js';
import { isImmediateOperand } from '../../../il/guards.js';
import {
  TestableILPeepholePass,
  createGapPattern,
  createTestFunction,
  createReturnInstr,
  createLoadByteInstr,
  createStoreByteInstr,
  getSlotName,
} from './addr-expr-helpers.js';

// ============================================================================
// Gap Pattern (isolated): LOAD_ADDRESS + STORE_WORD + LOAD_WORD + SHR_WORD + LO
// ============================================================================

describe('ILPeepholePass addressExprFolding — gap pattern (isolated)', () => {
  it('should fold 5-instruction gap pattern into LOAD_ADDRESS_EXPR', () => {
    const func = createTestFunction([
      ...createGapPattern('lineFrames', '__data_Mod_lineFrames', 'paramAddr', 6),
      createReturnInstr(),
    ]);

    const pass = new TestableILPeepholePass();
    const result = pass.runAddressExprFoldingOnly(func, { level: 'O2' });

    // 5 instructions → 1 LOAD_ADDRESS_EXPR + RETURN = 2
    expect(result.modified).toBe(true);
    expect(func.instructions).toHaveLength(2);
    expect(func.instructions[0].opcode).toBe(ILOpcode.LOAD_ADDRESS_EXPR);
    expect(func.instructions[1].opcode).toBe(ILOpcode.RETURN);
  });

  it('should preserve original slot name from LOAD_ADDRESS', () => {
    const func = createTestFunction([
      ...createGapPattern('spriteData', '__data_Game_spriteData', 'p0', 6),
      createReturnInstr(),
    ]);

    const pass = new TestableILPeepholePass();
    pass.runAddressExprFoldingOnly(func, { level: 'O2' });

    expect(func.instructions[0].opcode).toBe(ILOpcode.LOAD_ADDRESS_EXPR);
    expect(getSlotName(func.instructions[0])).toBe('spriteData');
  });

  it('should set correct shift count from SHR_WORD', () => {
    const func = createTestFunction([
      ...createGapPattern('data', '__data_Mod_data', 'tmp', 6),
      createReturnInstr(),
    ]);

    const pass = new TestableILPeepholePass();
    pass.runAddressExprFoldingOnly(func, { level: 'O2' });

    const shiftOp = func.instructions[0].operands[1];
    expect(isImmediateOperand(shiftOp)).toBe(true);
    if (isImmediateOperand(shiftOp)) {
      expect(shiftOp.value).toBe(6);
      expect(shiftOp.isWord).toBe(true);
    }
  });

  it('should fold gap pattern with shift count 3', () => {
    const func = createTestFunction([
      ...createGapPattern('table', '__data_Mod_table', 'slot0', 3),
      createReturnInstr(),
    ]);

    const pass = new TestableILPeepholePass();
    pass.runAddressExprFoldingOnly(func, { level: 'O2' });

    expect(func.instructions).toHaveLength(2);
    const shiftOp = func.instructions[0].operands[1];
    if (isImmediateOperand(shiftOp)) {
      expect(shiftOp.value).toBe(3);
    }
  });

  it('should fold gap pattern with shift count 8', () => {
    const func = createTestFunction([
      ...createGapPattern('addr', '__data_Mod_addr', 'slot0', 8),
      createReturnInstr(),
    ]);

    const pass = new TestableILPeepholePass();
    pass.runAddressExprFoldingOnly(func, { level: 'O2' });

    expect(func.instructions).toHaveLength(2);
    expect(func.instructions[0].opcode).toBe(ILOpcode.LOAD_ADDRESS_EXPR);
  });

  it('should handle gap pattern with surrounding instructions', () => {
    const func = createTestFunction([
      createLoadByteInstr('counter'),
      createStoreByteInstr('result'),
      ...createGapPattern('frames', '__data_Mod_frames', 'paramSlot', 6),
      createStoreByteInstr('spritePtr'),
      createReturnInstr(),
    ]);

    const pass = new TestableILPeepholePass();
    pass.runAddressExprFoldingOnly(func, { level: 'O2' });

    // 2 prefix + 1 folded + 1 store + 1 return = 5
    expect(func.instructions).toHaveLength(5);
    expect(func.instructions[2].opcode).toBe(ILOpcode.LOAD_ADDRESS_EXPR);
  });

  it('should fold two gap patterns in the same function', () => {
    const func = createTestFunction([
      ...createGapPattern('spriteA', '__data_Mod_spriteA', 'p0', 6),
      createStoreByteInstr('ptrA'),
      ...createGapPattern('spriteB', '__data_Mod_spriteB', 'p1', 6),
      createStoreByteInstr('ptrB'),
      createReturnInstr(),
    ]);

    const pass = new TestableILPeepholePass();
    const result = pass.runAddressExprFoldingOnly(func, { level: 'O2' });

    expect(result.modified).toBe(true);
    // 1 + 1 + 1 + 1 + 1 = 5
    expect(func.instructions).toHaveLength(5);
    expect(func.instructions[0].opcode).toBe(ILOpcode.LOAD_ADDRESS_EXPR);
    expect(getSlotName(func.instructions[0])).toBe('spriteA');
    expect(func.instructions[2].opcode).toBe(ILOpcode.LOAD_ADDRESS_EXPR);
    expect(getSlotName(func.instructions[2])).toBe('spriteB');
  });

  it('should report 4 removed for gap pattern (5 → 1)', () => {
    const func = createTestFunction([
      ...createGapPattern('data', '__data_Mod_data', 'param', 6),
      createReturnInstr(),
    ]);

    const pass = new TestableILPeepholePass();
    const result = pass.runAddressExprFoldingOnly(func, { level: 'O2' });

    // 5 original - 1 replacement = 4 removed
    expect(result.instructionsRemoved).toBe(4);
  });

  it('should include gap pattern type in debug info', () => {
    const func = createTestFunction([
      ...createGapPattern('data', '__data_Mod_data', 'param', 6),
      createReturnInstr(),
    ]);

    const pass = new TestableILPeepholePass();
    const result = pass.runAddressExprFoldingOnly(func, { level: 'O2', debug: true });

    expect(result.debugInfo).toBeDefined();
    const addrDebug = result.debugInfo!.find(d =>
      d.includes('Address expr folding')
    );
    expect(addrDebug).toBeDefined();
    expect(addrDebug).toContain('with-store-reload-gap');
  });
});
