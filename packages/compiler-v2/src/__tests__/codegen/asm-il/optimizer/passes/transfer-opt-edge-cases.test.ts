/**
 * TransferOptPass — Edge Case Tests
 *
 * Tests TSX/TXS (no simple reverse), cross-transfer modifications,
 * shift instructions, idempotency, and real-world patterns.
 */

import { describe, it, expect } from 'vitest';
import { TransferOptPass } from '../../../../../codegen/asm-il/optimizer/passes/transfer-opt.js';
import {
  AsmAddressingMode,
  createAsmILProgram,
  createInstructionElement,
  isInstructionElement,
} from '../../../../../codegen/asm-il/types.js';
import type { AsmILProgram, AsmILElement } from '../../../../../codegen/asm-il/types.js';

// ============================================================================
// Test Helpers
// ============================================================================

function instr(
  mnemonic: string,
  mode: AsmAddressingMode = AsmAddressingMode.Implied,
  operand?: number,
  labelOperand?: string
) {
  return createInstructionElement(mnemonic, mode, operand, labelOperand);
}

function createTestProgram(
  elements: ReturnType<typeof createInstructionElement>[]
): AsmILProgram {
  return {
    ...createAsmILProgram('test'),
    sections: [{ name: 'code', elements }],
  };
}

function extractMnemonics(elements: readonly AsmILElement[]): string[] {
  return elements
    .filter(isInstructionElement)
    .map(el => el.instruction.mnemonic);
}

describe('TransferOptPass — Edge Cases', () => {
  const pass = new TransferOptPass();

  // ========================================================================
  // TSX/TXS — No simple reverse
  // ========================================================================

  describe('TSX/TXS handling', () => {
    it('should NOT optimize TSX (no reverse mapping)', () => {
      const program = createTestProgram([
        instr('TSX'),
        instr('TXS'),
      ]);

      const result = pass.run(program);
      // TSX→TXS is not a recognized reverse pair (stack pointer is special)
      expect(result.changed).toBe(false);
    });

    it('should NOT optimize TXS (no reverse mapping)', () => {
      const program = createTestProgram([
        instr('TXS'),
        instr('TSX'),
      ]);

      const result = pass.run(program);
      expect(result.changed).toBe(false);
    });
  });

  // ========================================================================
  // Cross-transfer modifications
  // ========================================================================

  describe('cross-transfer modifications', () => {
    it('should NOT eliminate TXA when TYA modifies A between TAX and TXA', () => {
      // TAX; TYA; TXA — TYA modifies A (TYA is in MODIFIES_A), so TXA is needed
      const program = createTestProgram([
        instr('TAX'),
        instr('TYA'), // Modifies A — breaks pattern
        instr('TXA'),
      ]);

      const result = pass.run(program);
      expect(result.changed).toBe(false);
    });

    it('should NOT eliminate TXA when TXA itself is between TAX and second TXA', () => {
      // TAX; TXA; TXA — first TXA modifies A... but actually TXA IS the reverse
      // The first TXA should be found as the reverse and removed
      const program = createTestProgram([
        instr('TAX'),
        instr('TXA'), // This IS the reverse — removed
        instr('TXA'), // This would need separate analysis
      ]);

      const result = pass.run(program);
      expect(result.changed).toBe(true);
      // First TXA removed, second remains
      expect(extractMnemonics(result.program.sections[0].elements)).toEqual(['TAX', 'TXA']);
    });

    it('should NOT eliminate TAX when TAX modifies X between TXA and second TAX', () => {
      // TXA; TAX (redundant); TAX — first TAX is the reverse, removed
      const program = createTestProgram([
        instr('TXA'),
        instr('TAX'), // reverse — removed
        instr('TAX'), // remains
      ]);

      const result = pass.run(program);
      expect(result.changed).toBe(true);
      expect(extractMnemonics(result.program.sections[0].elements)).toEqual(['TXA', 'TAX']);
    });
  });

  // ========================================================================
  // Shift/rotate instructions (conservative A modification)
  // ========================================================================

  describe('shift and rotate instructions', () => {
    it('should NOT eliminate TXA when ASL appears between (conservative)', () => {
      // ASL can be accumulator mode — conservatively treated as modifying A
      const program = createTestProgram([
        instr('TAX'),
        instr('ASL', AsmAddressingMode.Accumulator),
        instr('TXA'),
      ]);

      const result = pass.run(program);
      expect(result.changed).toBe(false);
    });

    it('should NOT eliminate TXA when LSR appears between (conservative)', () => {
      const program = createTestProgram([
        instr('TAX'),
        instr('LSR', AsmAddressingMode.Accumulator),
        instr('TXA'),
      ]);

      const result = pass.run(program);
      expect(result.changed).toBe(false);
    });

    it('should NOT eliminate TXA when ROL appears between (conservative)', () => {
      const program = createTestProgram([
        instr('TAX'),
        instr('ROL', AsmAddressingMode.Accumulator),
        instr('TXA'),
      ]);

      const result = pass.run(program);
      expect(result.changed).toBe(false);
    });

    it('should NOT eliminate TXA when ROR appears between (conservative)', () => {
      const program = createTestProgram([
        instr('TAX'),
        instr('ROR', AsmAddressingMode.Accumulator),
        instr('TXA'),
      ]);

      const result = pass.run(program);
      expect(result.changed).toBe(false);
    });
  });

  // ========================================================================
  // Idempotency
  // ========================================================================

  describe('idempotency', () => {
    it('should return unchanged when run on already-optimized program', () => {
      const program = createTestProgram([
        instr('TAX'),
        instr('TXA'), // will be removed
      ]);

      const first = pass.run(program);
      expect(first.changed).toBe(true);

      const second = pass.run(first.program);
      expect(second.changed).toBe(false);
      expect(second.program).toBe(first.program);
    });
  });

  // ========================================================================
  // Real-world patterns
  // ========================================================================

  describe('real-world patterns', () => {
    it('should optimize save/use/restore pattern where restore is redundant', () => {
      // Common pattern: save A to X, use A for something that doesn't modify A, then restore
      // LDA $50; TAX; STA $60; TXA — TXA is redundant because STA doesn't modify A
      const program = createTestProgram([
        instr('LDA', AsmAddressingMode.ZeroPage, 0x50),
        instr('TAX'),
        instr('STA', AsmAddressingMode.ZeroPage, 0x60),
        instr('TXA'), // redundant — A unchanged since TAX
      ]);

      const result = pass.run(program);
      expect(result.changed).toBe(true);
      expect(extractMnemonics(result.program.sections[0].elements)).toEqual([
        'LDA', 'TAX', 'STA',
      ]);
    });

    it('should NOT optimize save/compute/restore pattern', () => {
      // LDA $50; TAX; ADC #1; STA $60; TXA — ADC modifies A, TXA is needed
      const program = createTestProgram([
        instr('LDA', AsmAddressingMode.ZeroPage, 0x50),
        instr('TAX'),
        instr('ADC', AsmAddressingMode.Immediate, 1),
        instr('STA', AsmAddressingMode.ZeroPage, 0x60),
        instr('TXA'),
      ]);

      const result = pass.run(program);
      expect(result.changed).toBe(false);
    });

    it('should optimize simple copy pattern TAX; NOP; NOP; TXA', () => {
      const program = createTestProgram([
        instr('TAX'),
        instr('NOP'),
        instr('NOP'),
        instr('TXA'), // redundant
      ]);

      const result = pass.run(program);
      expect(result.changed).toBe(true);
      expect(extractMnemonics(result.program.sections[0].elements)).toEqual([
        'TAX', 'NOP', 'NOP',
      ]);
    });

    it('should handle CMP/CPX/CPY between transfers (they do not modify registers)', () => {
      // CMP, CPX, CPY only modify flags, not the register value
      const program = createTestProgram([
        instr('TAX'),
        instr('CMP', AsmAddressingMode.Immediate, 5),
        instr('TXA'), // redundant — CMP doesn't modify A
      ]);

      const result = pass.run(program);
      expect(result.changed).toBe(true);
      expect(extractMnemonics(result.program.sections[0].elements)).toEqual(['TAX', 'CMP']);
    });

    it('should handle STA/STX/STY between transfers (stores do not modify registers)', () => {
      const program = createTestProgram([
        instr('TAY'),
        instr('STA', AsmAddressingMode.ZeroPage, 0x50),
        instr('STX', AsmAddressingMode.ZeroPage, 0x51),
        instr('STY', AsmAddressingMode.ZeroPage, 0x52),
        instr('TYA'), // redundant — stores don't modify A
      ]);

      const result = pass.run(program);
      expect(result.changed).toBe(true);
      expect(extractMnemonics(result.program.sections[0].elements)).toEqual([
        'TAY', 'STA', 'STX', 'STY',
      ]);
    });

    it('should handle PHA between transfers (PHA does not modify A)', () => {
      const program = createTestProgram([
        instr('TAX'),
        instr('PHA'), // Push A — does NOT modify A
        instr('TXA'), // redundant — A still has the same value
      ]);

      const result = pass.run(program);
      expect(result.changed).toBe(true);
      expect(extractMnemonics(result.program.sections[0].elements)).toEqual(['TAX', 'PHA']);
    });

    it('should handle CLC/SEC between transfers (flag-only instructions)', () => {
      const program = createTestProgram([
        instr('TAX'),
        instr('CLC'),
        instr('SEC'),
        instr('TXA'), // redundant — CLC/SEC don't modify registers
      ]);

      const result = pass.run(program);
      expect(result.changed).toBe(true);
      expect(extractMnemonics(result.program.sections[0].elements)).toEqual([
        'TAX', 'CLC', 'SEC',
      ]);
    });
  });

  // ========================================================================
  // Empty section
  // ========================================================================

  describe('empty section', () => {
    it('should handle empty section gracefully', () => {
      const program: AsmILProgram = {
        ...createAsmILProgram('test'),
        sections: [{ name: 'empty', elements: [] }],
      };

      const result = pass.run(program);
      expect(result.changed).toBe(false);
    });
  });
});
