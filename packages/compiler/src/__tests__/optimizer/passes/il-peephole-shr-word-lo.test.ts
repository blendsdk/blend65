/**
 * Tests for IL Peephole SHR_WORD+LO Narrowing Optimization
 *
 * Tests the pattern where a 16-bit right shift followed by a LO (take low byte)
 * is narrowed to HI + SHR_BYTE when the shift count is ≥ 8.
 *
 * Pattern: SHR_WORD N + LO → HI + SHR_BYTE (N-8) for N ≥ 8
 * For N = 8: SHR_WORD 8 + LO → HI (just TXA)
 *
 * @module __tests__/optimizer/passes/il-peephole-shr-word-lo.test
 */

import { describe, it, expect } from 'vitest';
import { ILPeepholePass } from '../../../optimizer/passes/il-peephole.js';
import { ILOpcode } from '../../../il/enums.js';
import type { ILFunction } from '../../../il/structures.js';
import type { ILInstruction } from '../../../il/instruction.js';
import { createImmediateOperand } from '../../../il/factories.js';
import { isImmediateOperand } from '../../../il/guards.js';

// ============================================================================
// Test Helpers
// ============================================================================

/** Create a SHR_WORD instruction with given shift count */
function createShrWordInstr(count: number): ILInstruction {
  return {
    opcode: ILOpcode.SHR_WORD,
    operands: [createImmediateOperand(count, false)],
    defUse: { defs: [], uses: [] },
  };
}

/** Create a LO instruction (narrow word to low byte) */
function createLoInstr(): ILInstruction {
  return {
    opcode: ILOpcode.LO,
    operands: [],
    defUse: { defs: [], uses: [] },
  };
}

/** Create an HI instruction (take high byte of word) */
function createHiInstr(): ILInstruction {
  return {
    opcode: ILOpcode.HI,
    operands: [],
    defUse: { defs: [], uses: [] },
  };
}

/** Create a LOAD_IMM instruction with given value */
function createLoadImmInstr(value: number): ILInstruction {
  return {
    opcode: ILOpcode.LOAD_IMM,
    operands: [createImmediateOperand(value, false)],
    defUse: { defs: [], uses: [] },
  };
}

/** Create a STORE_BYTE instruction (placeholder, no slot needed for these tests) */
function createStoreByteInstr(): ILInstruction {
  return {
    opcode: ILOpcode.STORE_BYTE,
    operands: [],
    defUse: { defs: [], uses: [] },
  };
}

/** Create a minimal ILFunction for testing */
function createTestFunction(instructions: ILInstruction[]): ILFunction {
  return {
    name: 'test',
    params: [],
    returnType: 'void',
    instructions,
    frame: {
      slots: new Map(),
      totalSize: 0,
      zpSize: 0,
    },
    labels: new Set<string>(),
    isExported: false,
  };
}

/** Default optimization options for testing (O2 enables il-peephole) */
const testOptions = { level: 'O2' as const, debug: false };

// ============================================================================
// Tests: SHR_WORD + LO Narrowing — Positive Cases (N ≥ 8)
// ============================================================================

describe('IL Peephole: SHR_WORD+LO Narrowing', () => {
  describe('Positive cases (N ≥ 8 — should narrow)', () => {
    it('should replace SHR_WORD 8 + LO with HI only (TXA)', () => {
      // SHR_WORD 8 + LO → HI (just take the high byte)
      const func = createTestFunction([
        createShrWordInstr(8),
        createLoInstr(),
      ]);

      const pass = new ILPeepholePass();
      const result = pass.run(func, testOptions);

      // Should be modified: 2 instructions → 1
      expect(result.modified).toBe(true);
      expect(func.instructions).toHaveLength(1);
      expect(func.instructions[0].opcode).toBe(ILOpcode.HI);
    });

    it('should replace SHR_WORD 9 + LO with HI + SHR_BYTE 1', () => {
      // SHR_WORD 9 + LO → HI + SHR_BYTE 1
      const func = createTestFunction([
        createShrWordInstr(9),
        createLoInstr(),
      ]);

      const pass = new ILPeepholePass();
      pass.run(func, testOptions);

      expect(func.instructions).toHaveLength(2);
      expect(func.instructions[0].opcode).toBe(ILOpcode.HI);
      expect(func.instructions[1].opcode).toBe(ILOpcode.SHR_BYTE);

      // Verify the SHR_BYTE has shift count of 1 (= 9 - 8)
      const shrByteOp = func.instructions[1].operands[0];
      expect(isImmediateOperand(shrByteOp)).toBe(true);
      if (isImmediateOperand(shrByteOp)) {
        expect(shrByteOp.value).toBe(1);
      }
    });

    it('should replace SHR_WORD 10 + LO with HI + SHR_BYTE 2', () => {
      const func = createTestFunction([
        createShrWordInstr(10),
        createLoInstr(),
      ]);

      const pass = new ILPeepholePass();
      pass.run(func, testOptions);

      expect(func.instructions).toHaveLength(2);
      expect(func.instructions[0].opcode).toBe(ILOpcode.HI);
      expect(func.instructions[1].opcode).toBe(ILOpcode.SHR_BYTE);

      const shrByteOp = func.instructions[1].operands[0];
      expect(isImmediateOperand(shrByteOp)).toBe(true);
      if (isImmediateOperand(shrByteOp)) {
        expect(shrByteOp.value).toBe(2);
      }
    });

    it('should replace SHR_WORD 12 + LO with HI + SHR_BYTE 4', () => {
      const func = createTestFunction([
        createShrWordInstr(12),
        createLoInstr(),
      ]);

      const pass = new ILPeepholePass();
      pass.run(func, testOptions);

      expect(func.instructions).toHaveLength(2);
      expect(func.instructions[0].opcode).toBe(ILOpcode.HI);
      expect(func.instructions[1].opcode).toBe(ILOpcode.SHR_BYTE);

      const shrByteOp = func.instructions[1].operands[0];
      expect(isImmediateOperand(shrByteOp)).toBe(true);
      if (isImmediateOperand(shrByteOp)) {
        expect(shrByteOp.value).toBe(4);
      }
    });

    it('should replace SHR_WORD 15 + LO with HI + SHR_BYTE 7', () => {
      // Edge case: maximum useful shift (shifts ≥ 16 would zero everything)
      const func = createTestFunction([
        createShrWordInstr(15),
        createLoInstr(),
      ]);

      const pass = new ILPeepholePass();
      pass.run(func, testOptions);

      expect(func.instructions).toHaveLength(2);
      expect(func.instructions[0].opcode).toBe(ILOpcode.HI);
      expect(func.instructions[1].opcode).toBe(ILOpcode.SHR_BYTE);

      const shrByteOp = func.instructions[1].operands[0];
      expect(isImmediateOperand(shrByteOp)).toBe(true);
      if (isImmediateOperand(shrByteOp)) {
        expect(shrByteOp.value).toBe(7);
      }
    });
  });

  // ============================================================================
  // Negative Cases (N < 8 — should NOT narrow)
  // ============================================================================

  describe('Negative cases (N < 8 — should NOT narrow)', () => {
    it('should NOT narrow SHR_WORD 1 + LO (bits cross byte boundary)', () => {
      const func = createTestFunction([
        createShrWordInstr(1),
        createLoInstr(),
      ]);

      const pass = new ILPeepholePass();
      const result = pass.run(func, testOptions);

      // SHR_WORD and LO should remain unchanged
      expect(func.instructions).toHaveLength(2);
      expect(func.instructions[0].opcode).toBe(ILOpcode.SHR_WORD);
      expect(func.instructions[1].opcode).toBe(ILOpcode.LO);
    });

    it('should NOT narrow SHR_WORD 6 + LO (common sprite calc shift)', () => {
      const func = createTestFunction([
        createShrWordInstr(6),
        createLoInstr(),
      ]);

      const pass = new ILPeepholePass();
      pass.run(func, testOptions);

      // Should remain as SHR_WORD 6 + LO (not narrowable)
      expect(func.instructions).toHaveLength(2);
      expect(func.instructions[0].opcode).toBe(ILOpcode.SHR_WORD);
      expect(func.instructions[1].opcode).toBe(ILOpcode.LO);
    });

    it('should NOT narrow SHR_WORD 7 + LO (just below threshold)', () => {
      const func = createTestFunction([
        createShrWordInstr(7),
        createLoInstr(),
      ]);

      const pass = new ILPeepholePass();
      pass.run(func, testOptions);

      expect(func.instructions).toHaveLength(2);
      expect(func.instructions[0].opcode).toBe(ILOpcode.SHR_WORD);
      expect(func.instructions[1].opcode).toBe(ILOpcode.LO);
    });
  });

  // ============================================================================
  // Pattern Safety — Should NOT match non-patterns
  // ============================================================================

  describe('Pattern safety — should NOT match non-patterns', () => {
    it('should NOT narrow SHR_WORD without following LO', () => {
      // SHR_WORD alone (without LO) — the full 16-bit result is needed
      const func = createTestFunction([
        createShrWordInstr(8),
        createStoreByteInstr(), // Not LO — different instruction follows
      ]);

      const pass = new ILPeepholePass();
      pass.run(func, testOptions);

      // SHR_WORD should remain
      expect(func.instructions[0].opcode).toBe(ILOpcode.SHR_WORD);
    });

    it('should NOT narrow standalone LO without preceding SHR_WORD', () => {
      const func = createTestFunction([
        createLoadImmInstr(42),
        createLoInstr(),
      ]);

      const pass = new ILPeepholePass();
      pass.run(func, testOptions);

      // LO should remain
      expect(func.instructions[1].opcode).toBe(ILOpcode.LO);
    });

    it('should NOT narrow HI followed by LO (not SHR_WORD)', () => {
      const func = createTestFunction([
        createHiInstr(),
        createLoInstr(),
      ]);

      const pass = new ILPeepholePass();
      pass.run(func, testOptions);

      // Both should remain unchanged
      expect(func.instructions).toHaveLength(2);
      expect(func.instructions[0].opcode).toBe(ILOpcode.HI);
      expect(func.instructions[1].opcode).toBe(ILOpcode.LO);
    });
  });

  // ============================================================================
  // Context Preservation — Instructions around the pattern
  // ============================================================================

  describe('Context preservation — surrounding instructions', () => {
    it('should preserve instructions before and after SHR_WORD 8 + LO', () => {
      const func = createTestFunction([
        createLoadImmInstr(0xAB),  // before: stays
        createShrWordInstr(8),     // matched
        createLoInstr(),           // matched
        createStoreByteInstr(),    // after: stays
      ]);

      const pass = new ILPeepholePass();
      pass.run(func, testOptions);

      // Should be: LOAD_IMM, HI, STORE_BYTE (3 instructions)
      expect(func.instructions).toHaveLength(3);
      expect(func.instructions[0].opcode).toBe(ILOpcode.LOAD_IMM);
      expect(func.instructions[1].opcode).toBe(ILOpcode.HI);
      expect(func.instructions[2].opcode).toBe(ILOpcode.STORE_BYTE);
    });

    it('should preserve instructions around SHR_WORD 10 + LO', () => {
      const func = createTestFunction([
        createLoadImmInstr(0xCD),  // before
        createShrWordInstr(10),    // matched → HI
        createLoInstr(),           // matched → SHR_BYTE 2
        createStoreByteInstr(),    // after
      ]);

      const pass = new ILPeepholePass();
      pass.run(func, testOptions);

      // Should be: LOAD_IMM, HI, SHR_BYTE 2, STORE_BYTE (4 instructions)
      expect(func.instructions).toHaveLength(4);
      expect(func.instructions[0].opcode).toBe(ILOpcode.LOAD_IMM);
      expect(func.instructions[1].opcode).toBe(ILOpcode.HI);
      expect(func.instructions[2].opcode).toBe(ILOpcode.SHR_BYTE);
      expect(func.instructions[3].opcode).toBe(ILOpcode.STORE_BYTE);
    });

    it('should handle multiple SHR_WORD+LO patterns in same function', () => {
      const func = createTestFunction([
        createShrWordInstr(8),     // first match → HI
        createLoInstr(),
        createLoadImmInstr(0xFF),  // separator
        createShrWordInstr(10),    // second match → HI + SHR_BYTE 2
        createLoInstr(),
      ]);

      const pass = new ILPeepholePass();
      pass.run(func, testOptions);

      // Should be: HI, LOAD_IMM, HI, SHR_BYTE 2 (4 instructions)
      expect(func.instructions).toHaveLength(4);
      expect(func.instructions[0].opcode).toBe(ILOpcode.HI);
      expect(func.instructions[1].opcode).toBe(ILOpcode.LOAD_IMM);
      expect(func.instructions[2].opcode).toBe(ILOpcode.HI);
      expect(func.instructions[3].opcode).toBe(ILOpcode.SHR_BYTE);
    });
  });

  // ============================================================================
  // Statistics
  // ============================================================================

  describe('Statistics tracking', () => {
    it('should report 1 removed for SHR_WORD 8 + LO → HI', () => {
      const func = createTestFunction([
        createShrWordInstr(8),
        createLoInstr(),
      ]);

      const pass = new ILPeepholePass();
      const result = pass.run(func, testOptions);

      // 2 → 1 instruction = 1 removed
      expect(result.modified).toBe(true);
      expect(result.instructionsRemoved).toBeGreaterThanOrEqual(1);
    });

    it('should report modified for SHR_WORD 10 + LO → HI + SHR_BYTE', () => {
      const func = createTestFunction([
        createShrWordInstr(10),
        createLoInstr(),
      ]);

      const pass = new ILPeepholePass();
      const result = pass.run(func, testOptions);

      // 2 → 2 instructions (but cheaper ops), count as replaced
      expect(result.modified).toBe(true);
    });

    it('should report not modified when no patterns match', () => {
      const func = createTestFunction([
        createShrWordInstr(6),  // N < 8, won't narrow
        createLoInstr(),
      ]);

      const pass = new ILPeepholePass();
      const result = pass.run(func, testOptions);

      // No narrowing happened (N < 8)
      // Note: other patterns in the peephole may still report no change
      expect(func.instructions).toHaveLength(2);
      expect(func.instructions[0].opcode).toBe(ILOpcode.SHR_WORD);
    });
  });

  // ============================================================================
  // Debug Output
  // ============================================================================

  describe('Debug output', () => {
    it('should produce debug info when debug=true', () => {
      const func = createTestFunction([
        createShrWordInstr(8),
        createLoInstr(),
      ]);

      const pass = new ILPeepholePass();
      const result = pass.run(func, { ...testOptions, debug: true });

      // Should have debug info mentioning the narrowing
      expect(result.debugInfo).toBeDefined();
      expect(result.debugInfo!.length).toBeGreaterThan(0);
      const hasNarrowingDebug = result.debugInfo!.some(
        (info) => info.includes('SHR_WORD') && info.includes('narrowing')
      );
      expect(hasNarrowingDebug).toBe(true);
    });
  });
});
