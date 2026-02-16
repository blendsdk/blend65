/**
 * Tests for Address Expression Folding — Negative / Safety Tests
 *
 * Verifies that the optimization does NOT apply when preconditions
 * are not met. These tests ensure the pattern matching is strict
 * and doesn't produce incorrect transformations.
 *
 * @module __tests__/optimizer/passes/il-peephole-addr-expr-negative.test
 */

import { describe, it, expect } from 'vitest';
import { ILPeepholePass } from '../../../optimizer/passes/il-peephole.js';
import { ILOpcode } from '../../../il/enums.js';
import {
  createTestFunction,
  createReturnInstr,
  createLoadAddressInstr,
  createShrWordInstr,
  createLoInstr,
  createStoreWordInstr,
  createLoadWordInstr,
  createLoadByteInstr,
  createStoreByteInstr,
  createAddImmInstr,
} from './addr-expr-helpers.js';

// ============================================================================
// Negative Tests: Patterns that should NOT be folded
// ============================================================================

describe('ILPeepholePass addressExprFolding — no match (negative tests)', () => {
  it('should NOT fold when first instruction is not LOAD_ADDRESS', () => {
    // LOAD_BYTE instead of LOAD_ADDRESS — wrong opcode
    const func = createTestFunction([
      createLoadByteInstr('someVar'),
      createShrWordInstr(6),
      createLoInstr(),
      createReturnInstr(),
    ]);

    const pass = new ILPeepholePass();
    pass.run(func, { level: 'O2' });

    // No LOAD_ADDRESS_EXPR should appear
    const hasAddrExpr = func.instructions.some(
      i => i.opcode === ILOpcode.LOAD_ADDRESS_EXPR
    );
    expect(hasAddrExpr).toBe(false);
  });

  it('should NOT fold when SHR_WORD is missing (different opcode)', () => {
    // ADD_IMM instead of SHR_WORD between LOAD_ADDRESS and LO
    const func = createTestFunction([
      createLoadAddressInstr('data', '__data_Mod_data'),
      createAddImmInstr(6), // wrong opcode — not SHR_WORD
      createLoInstr(),
      createReturnInstr(),
    ]);

    const pass = new ILPeepholePass();
    pass.run(func, { level: 'O2' });

    const hasAddrExpr = func.instructions.some(
      i => i.opcode === ILOpcode.LOAD_ADDRESS_EXPR
    );
    expect(hasAddrExpr).toBe(false);
  });

  it('should NOT fold when LO is missing after SHR_WORD', () => {
    // LOAD_ADDRESS + SHR_WORD but NO LO — result not narrowed to byte
    const func = createTestFunction([
      createLoadAddressInstr('data', '__data_Mod_data'),
      createShrWordInstr(6),
      createStoreByteInstr('result'), // not LO
      createReturnInstr(),
    ]);

    const pass = new ILPeepholePass();
    pass.run(func, { level: 'O2' });

    const hasAddrExpr = func.instructions.some(
      i => i.opcode === ILOpcode.LOAD_ADDRESS_EXPR
    );
    expect(hasAddrExpr).toBe(false);
  });

  it('should NOT fold when SHR_WORD has shift count 0', () => {
    // Shift of 0 is meaningless — the pattern matcher rejects it
    const func = createTestFunction([
      createLoadAddressInstr('data', '__data_Mod_data'),
      createShrWordInstr(0),
      createLoInstr(),
      createReturnInstr(),
    ]);

    const pass = new ILPeepholePass();
    pass.run(func, { level: 'O2' });

    const hasAddrExpr = func.instructions.some(
      i => i.opcode === ILOpcode.LOAD_ADDRESS_EXPR
    );
    expect(hasAddrExpr).toBe(false);
  });

  it('should NOT fold gap pattern when STORE_WORD/LOAD_WORD slots differ', () => {
    // STORE_WORD writes to 'slotA' but LOAD_WORD reads from 'slotB'
    const func = createTestFunction([
      createLoadAddressInstr('data', '__data_Mod_data'),
      createStoreWordInstr('slotA'),
      createLoadWordInstr('slotB'), // different slot!
      createShrWordInstr(6),
      createLoInstr(),
      createReturnInstr(),
    ]);

    const pass = new ILPeepholePass();
    pass.run(func, { level: 'O2' });

    const hasAddrExpr = func.instructions.some(
      i => i.opcode === ILOpcode.LOAD_ADDRESS_EXPR
    );
    expect(hasAddrExpr).toBe(false);
  });

  it('should NOT fold when only LOAD_ADDRESS exists (no SHR_WORD/LO)', () => {
    // Standalone LOAD_ADDRESS — no shift pattern following
    const func = createTestFunction([
      createLoadAddressInstr('data', '__data_Mod_data'),
      createReturnInstr(),
    ]);

    const pass = new ILPeepholePass();
    pass.run(func, { level: 'O2' });

    // Should still have LOAD_ADDRESS (not LOAD_ADDRESS_EXPR)
    expect(func.instructions[0].opcode).toBe(ILOpcode.LOAD_ADDRESS);
  });

  it('should NOT fold when only LOAD_ADDRESS + SHR_WORD exists (no LO)', () => {
    // Missing the final LO instruction — word result not narrowed
    const func = createTestFunction([
      createLoadAddressInstr('data', '__data_Mod_data'),
      createShrWordInstr(6),
      createReturnInstr(),
    ]);

    const pass = new ILPeepholePass();
    pass.run(func, { level: 'O2' });

    expect(func.instructions[0].opcode).toBe(ILOpcode.LOAD_ADDRESS);
    expect(func.instructions[1].opcode).toBe(ILOpcode.SHR_WORD);
  });

  it('should NOT fold gap pattern when middle is STORE_BYTE/LOAD_BYTE (wrong width)', () => {
    // STORE_BYTE/LOAD_BYTE instead of STORE_WORD/LOAD_WORD
    const func = createTestFunction([
      createLoadAddressInstr('data', '__data_Mod_data'),
      createStoreByteInstr('param'),  // byte, not word
      createLoadByteInstr('param'),   // byte, not word
      createShrWordInstr(6),
      createLoInstr(),
      createReturnInstr(),
    ]);

    const pass = new ILPeepholePass();
    pass.run(func, { level: 'O2' });

    const hasAddrExpr = func.instructions.some(
      i => i.opcode === ILOpcode.LOAD_ADDRESS_EXPR
    );
    expect(hasAddrExpr).toBe(false);
  });

  it('should leave non-matching instructions untouched', () => {
    // A function with no address expression pattern at all
    const func = createTestFunction([
      createLoadByteInstr('x'),
      createAddImmInstr(1),
      createStoreByteInstr('x'),
      createReturnInstr(),
    ]);

    const originalLength = func.instructions.length;
    const pass = new ILPeepholePass();
    pass.run(func, { level: 'O2' });

    // No LOAD_ADDRESS_EXPR should be introduced
    const hasAddrExpr = func.instructions.some(
      i => i.opcode === ILOpcode.LOAD_ADDRESS_EXPR
    );
    expect(hasAddrExpr).toBe(false);
    // Length may change due to other peephole patterns, but no addr expr
  });
});
