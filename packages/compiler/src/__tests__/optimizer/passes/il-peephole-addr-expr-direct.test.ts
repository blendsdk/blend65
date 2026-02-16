/**
 * Tests for Address Expression Folding — Direct Pattern
 *
 * Tests the 3-instruction direct pattern:
 * LOAD_ADDRESS slot + SHR_WORD N + LO → LOAD_ADDRESS_EXPR slot, N
 *
 * This pattern occurs when function inlining produces address-shift-narrow
 * sequences without intermediate store/reload pairs.
 *
 * @module __tests__/optimizer/passes/il-peephole-addr-expr-direct.test
 */

import { describe, it, expect } from 'vitest';
import { ILPeepholePass } from '../../../optimizer/passes/il-peephole.js';
import { ILOpcode } from '../../../il/enums.js';
import { isImmediateOperand } from '../../../il/guards.js';
import {
  createDirectPattern,
  createTestFunction,
  createReturnInstr,
  createLoadByteInstr,
  createStoreByteInstr,
  getImmValue,
  getSlotName,
} from './addr-expr-helpers.js';

// ============================================================================
// Direct Pattern: LOAD_ADDRESS + SHR_WORD + LO → LOAD_ADDRESS_EXPR
// ============================================================================

describe('ILPeepholePass addressExprFolding — direct pattern', () => {
  it('should fold LOAD_ADDRESS + SHR_WORD 6 + LO into LOAD_ADDRESS_EXPR', () => {
    // This is the most common real-world case: @sprite data / 64
    const func = createTestFunction([
      ...createDirectPattern('lineFrames', '__data_Mod_lineFrames', 6),
      createReturnInstr(),
    ]);

    const pass = new ILPeepholePass();
    const result = pass.run(func, { level: 'O2' });

    // 3 instructions → 1 LOAD_ADDRESS_EXPR + RETURN = 2
    expect(result.modified).toBe(true);
    expect(func.instructions).toHaveLength(2);
    expect(func.instructions[0].opcode).toBe(ILOpcode.LOAD_ADDRESS_EXPR);
    expect(func.instructions[1].opcode).toBe(ILOpcode.RETURN);
  });

  it('should preserve the slot operand from LOAD_ADDRESS', () => {
    const func = createTestFunction([
      ...createDirectPattern('spriteData', '__data_Game_spriteData', 6),
      createReturnInstr(),
    ]);

    const pass = new ILPeepholePass();
    pass.run(func, { level: 'O2' });

    // The first operand should be the slot from LOAD_ADDRESS
    const addrExpr = func.instructions[0];
    expect(addrExpr.opcode).toBe(ILOpcode.LOAD_ADDRESS_EXPR);
    expect(getSlotName(addrExpr)).toBe('spriteData');
  });

  it('should set shift count as second operand (ImmediateOperand)', () => {
    const func = createTestFunction([
      ...createDirectPattern('frames', '__data_Mod_frames', 6),
      createReturnInstr(),
    ]);

    const pass = new ILPeepholePass();
    pass.run(func, { level: 'O2' });

    const addrExpr = func.instructions[0];
    expect(addrExpr.operands).toHaveLength(2);

    // Second operand should be ImmediateOperand with value=6, isWord=true
    const shiftOp = addrExpr.operands[1];
    expect(isImmediateOperand(shiftOp)).toBe(true);
    if (isImmediateOperand(shiftOp)) {
      expect(shiftOp.value).toBe(6);
      expect(shiftOp.isWord).toBe(true); // isWord=true signals >> to codegen
    }
  });

  it('should fold with shift count 1', () => {
    const func = createTestFunction([
      ...createDirectPattern('data', '__data_Mod_data', 1),
      createReturnInstr(),
    ]);

    const pass = new ILPeepholePass();
    pass.run(func, { level: 'O2' });

    expect(func.instructions).toHaveLength(2);
    expect(func.instructions[0].opcode).toBe(ILOpcode.LOAD_ADDRESS_EXPR);

    const shiftOp = func.instructions[0].operands[1];
    if (isImmediateOperand(shiftOp)) {
      expect(shiftOp.value).toBe(1);
    }
  });

  it('should fold with shift count 3', () => {
    const func = createTestFunction([
      ...createDirectPattern('table', '__data_Mod_table', 3),
      createReturnInstr(),
    ]);

    const pass = new ILPeepholePass();
    pass.run(func, { level: 'O2' });

    expect(func.instructions).toHaveLength(2);
    const shiftOp = func.instructions[0].operands[1];
    if (isImmediateOperand(shiftOp)) {
      expect(shiftOp.value).toBe(3);
    }
  });

  it('should fold with shift count 8 (high byte extraction)', () => {
    const func = createTestFunction([
      ...createDirectPattern('addr', '__data_Mod_addr', 8),
      createReturnInstr(),
    ]);

    const pass = new ILPeepholePass();
    pass.run(func, { level: 'O2' });

    expect(func.instructions).toHaveLength(2);
    const shiftOp = func.instructions[0].operands[1];
    if (isImmediateOperand(shiftOp)) {
      expect(shiftOp.value).toBe(8);
    }
  });

  it('should handle pattern with surrounding instructions', () => {
    // Simulates a function that loads a byte, does the pattern, then stores
    const func = createTestFunction([
      createLoadByteInstr('counter'),
      createStoreByteInstr('result1'),
      ...createDirectPattern('lineFrames', '__data_Mod_lineFrames', 6),
      createStoreByteInstr('spritePtr'),
      createReturnInstr(),
    ]);

    const pass = new ILPeepholePass();
    pass.run(func, { level: 'O2' });

    // 2 prefix + 1 folded + 1 store + 1 return = 5
    // (Note: LOAD_BYTE counter + STORE_BYTE counter is a load-store pair
    //  that gets eliminated too. Let's check what's actually there.)
    // Actually: LOAD_BYTE 'counter' + STORE_BYTE 'result1' are different slots, so kept.
    expect(func.instructions).toHaveLength(5);

    // The LOAD_ADDRESS_EXPR should be at index 2
    expect(func.instructions[2].opcode).toBe(ILOpcode.LOAD_ADDRESS_EXPR);
    expect(getSlotName(func.instructions[2])).toBe('lineFrames');
  });

  it('should fold two direct patterns in the same function', () => {
    const func = createTestFunction([
      ...createDirectPattern('spriteA', '__data_Mod_spriteA', 6),
      createStoreByteInstr('ptrA'),
      ...createDirectPattern('spriteB', '__data_Mod_spriteB', 6),
      createStoreByteInstr('ptrB'),
      createReturnInstr(),
    ]);

    const pass = new ILPeepholePass();
    const result = pass.run(func, { level: 'O2' });

    expect(result.modified).toBe(true);
    // 1 + 1 + 1 + 1 + 1 = 5 (two LOAD_ADDRESS_EXPR + two STORE_BYTE + RETURN)
    expect(func.instructions).toHaveLength(5);
    expect(func.instructions[0].opcode).toBe(ILOpcode.LOAD_ADDRESS_EXPR);
    expect(getSlotName(func.instructions[0])).toBe('spriteA');
    expect(func.instructions[2].opcode).toBe(ILOpcode.LOAD_ADDRESS_EXPR);
    expect(getSlotName(func.instructions[2])).toBe('spriteB');
  });

  it('should handle pattern at very start of function', () => {
    const func = createTestFunction([
      ...createDirectPattern('data', '__data_Mod_data', 4),
    ]);

    const pass = new ILPeepholePass();
    pass.run(func, { level: 'O2' });

    expect(func.instructions).toHaveLength(1);
    expect(func.instructions[0].opcode).toBe(ILOpcode.LOAD_ADDRESS_EXPR);
  });

  it('should handle pattern at end of function (before RETURN)', () => {
    const func = createTestFunction([
      createLoadByteInstr('x'),
      createStoreByteInstr('y'),
      ...createDirectPattern('data', '__data_Mod_data', 6),
      createReturnInstr(),
    ]);

    const pass = new ILPeepholePass();
    pass.run(func, { level: 'O2' });

    // 2 prefix + 1 folded + 1 return = 4
    expect(func.instructions).toHaveLength(4);
    expect(func.instructions[2].opcode).toBe(ILOpcode.LOAD_ADDRESS_EXPR);
  });
});
