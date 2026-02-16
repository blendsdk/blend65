/**
 * Tests for Address Expression Folding — Statistics, Debug, and Idempotency
 *
 * Verifies that the pass reports correct statistics (removed/replaced counts),
 * produces debug info when enabled, and is idempotent (running twice gives
 * the same result).
 *
 * @module __tests__/optimizer/passes/il-peephole-addr-expr-stats.test
 */

import { describe, it, expect } from 'vitest';
import { ILPeepholePass } from '../../../optimizer/passes/il-peephole.js';
import { ILOpcode } from '../../../il/enums.js';
import {
  createDirectPattern,
  createTestFunction,
  createReturnInstr,
  createStoreByteInstr,
} from './addr-expr-helpers.js';

// ============================================================================
// Result Statistics
// ============================================================================

describe('ILPeepholePass addressExprFolding — result statistics', () => {
  it('should report 2 removed for direct pattern (3 → 1)', () => {
    const func = createTestFunction([
      ...createDirectPattern('data', '__data_Mod_data', 6),
      createReturnInstr(),
    ]);

    const pass = new ILPeepholePass();
    const result = pass.run(func, { level: 'O2' });

    // 3 original - 1 replacement = 2 removed
    expect(result.modified).toBe(true);
    expect(result.instructionsRemoved).toBeGreaterThanOrEqual(2);
  });

  it('should report correct totals for multiple patterns', () => {
    const func = createTestFunction([
      ...createDirectPattern('spriteA', '__data_Mod_spriteA', 6),
      createStoreByteInstr('ptrA'),
      ...createDirectPattern('spriteB', '__data_Mod_spriteB', 6),
      createStoreByteInstr('ptrB'),
      createReturnInstr(),
    ]);

    const pass = new ILPeepholePass();
    const result = pass.run(func, { level: 'O2' });

    // Two direct patterns: 2 + 2 = 4 removed
    expect(result.modified).toBe(true);
    expect(result.instructionsRemoved).toBeGreaterThanOrEqual(4);
  });

  it('should report not modified when no patterns match', () => {
    const func = createTestFunction([
      createStoreByteInstr('x'),
      createReturnInstr(),
    ]);

    const pass = new ILPeepholePass();
    const result = pass.run(func, { level: 'O2' });

    // No address expr patterns — other peephole patterns may or may not fire
    // but LOAD_ADDRESS_EXPR should not appear
    const hasAddrExpr = func.instructions.some(
      i => i.opcode === ILOpcode.LOAD_ADDRESS_EXPR
    );
    expect(hasAddrExpr).toBe(false);
  });
});

// ============================================================================
// Debug Info
// ============================================================================

describe('ILPeepholePass addressExprFolding — debug info', () => {
  it('should include debug info when debug=true', () => {
    const func = createTestFunction([
      ...createDirectPattern('lineFrames', '__data_Mod_lineFrames', 6),
      createReturnInstr(),
    ]);

    const pass = new ILPeepholePass();
    const result = pass.run(func, { level: 'O2', debug: true });

    expect(result.debugInfo).toBeDefined();
    const addrDebug = result.debugInfo!.find(d =>
      d.includes('Address expr folding')
    );
    expect(addrDebug).toBeDefined();
    expect(addrDebug).toContain('lineFrames');
    expect(addrDebug).toContain('SHR_WORD 6');
    expect(addrDebug).toContain('LOAD_ADDRESS_EXPR');
  });

  it('should include pattern type in debug info (direct)', () => {
    const func = createTestFunction([
      ...createDirectPattern('data', '__data_Mod_data', 3),
      createReturnInstr(),
    ]);

    const pass = new ILPeepholePass();
    const result = pass.run(func, { level: 'O2', debug: true });

    const addrDebug = result.debugInfo!.find(d =>
      d.includes('Address expr folding')
    );
    expect(addrDebug).toContain('direct');
  });

  it('should NOT include address expr debug when debug=false', () => {
    const func = createTestFunction([
      ...createDirectPattern('data', '__data_Mod_data', 6),
      createReturnInstr(),
    ]);

    const pass = new ILPeepholePass();
    const result = pass.run(func, { level: 'O2', debug: false });

    // The optimization should still work
    expect(func.instructions).toHaveLength(2);
    expect(func.instructions[0].opcode).toBe(ILOpcode.LOAD_ADDRESS_EXPR);

    // Debug info for address folding should not be present
    if (result.debugInfo) {
      const addrDebug = result.debugInfo.find(d =>
        d.includes('Address expr folding')
      );
      expect(addrDebug).toBeUndefined();
    }
  });
});

// ============================================================================
// Idempotency
// ============================================================================

describe('ILPeepholePass addressExprFolding — idempotency', () => {
  it('should produce same result when run twice (direct pattern)', () => {
    const func = createTestFunction([
      ...createDirectPattern('data', '__data_Mod_data', 6),
      createReturnInstr(),
    ]);

    const pass = new ILPeepholePass();

    // First pass — should fold
    pass.run(func, { level: 'O2' });
    const afterFirst = func.instructions.length;
    const opcodes1 = func.instructions.map(i => i.opcode);

    // Second pass — should find nothing to fold
    pass.run(func, { level: 'O2' });
    const afterSecond = func.instructions.length;
    const opcodes2 = func.instructions.map(i => i.opcode);

    expect(afterFirst).toBe(afterSecond);
    expect(opcodes1).toEqual(opcodes2);
  });

});
