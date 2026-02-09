/**
 * IndexedAddrPass Tests
 *
 * Tests for the computed-address → indexed-addressing optimization pass.
 * Verifies the LDA+CLC+ADC+STA+LDA(ind) → LDX+LDA,X transformation,
 * safety constraints, and edge cases.
 *
 * @module __tests__/codegen/asm-il/optimizer/passes/indexed-addr
 */

import { describe, it, expect } from 'vitest';
import { IndexedAddrPass } from '../../../../../codegen/asm-il/optimizer/passes/indexed-addr.js';
import {
  AsmAddressingMode,
  createAsmILProgram,
  createInstructionElement,
  createLabelElement,
  isInstructionElement,
} from '../../../../../codegen/asm-il/types.js';
import type { AsmILProgram, AsmILElement } from '../../../../../codegen/asm-il/types.js';

// ============================================================================
// Test Helpers
// ============================================================================

/** Shorthand for creating an instruction element */
function instr(
  mnemonic: string,
  mode: AsmAddressingMode = AsmAddressingMode.Implied,
  operand?: number,
  labelOperand?: string
): AsmILElement {
  return createInstructionElement(mnemonic, mode, operand, labelOperand);
}

/** Create a program with a single section containing the given elements */
function createTestProgram(elements: AsmILElement[]): AsmILProgram {
  return {
    ...createAsmILProgram('test'),
    sections: [{ name: 'code', elements }],
  };
}

/** Count instructions in the first section */
function countInstructions(program: AsmILProgram): number {
  if (program.sections.length === 0) return 0;
  return program.sections[0].elements.filter(isInstructionElement).length;
}

/** Get instruction at a specific index (among instruction elements only) */
function getInstruction(program: AsmILProgram, index: number) {
  const instrs = program.sections[0].elements.filter(isInstructionElement);
  const el = instrs[index];
  if (el && el.kind === 'instruction') return el.instruction;
  return undefined;
}

// ============================================================================
// Tests
// ============================================================================

describe('IndexedAddrPass', () => {
  const pass = new IndexedAddrPass();

  // ========================================================================
  // Basic Properties
  // ========================================================================

  describe('pass properties', () => {
    it('should have the name "indexed-addr"', () => {
      expect(pass.name).toBe('indexed-addr');
    });

    it('should be a transform pass', () => {
      expect(pass.isTransform).toBe(true);
    });
  });

  // ========================================================================
  // Pattern Matching: LDA+CLC+ADC+STA+LDA(ind) → LDX+LDA,X
  // ========================================================================

  describe('computed-address pattern with IndirectIndexed', () => {
    it('should replace LDA+CLC+ADC+STA+LDA(ptr),Y with LDX+LDA,X', () => {
      // LDA $1000; CLC; ADC $50; STA $FE; LDA ($FE),Y → LDX $50; LDA $1000,X
      const program = createTestProgram([
        instr('LDA', AsmAddressingMode.Absolute, 0x1000),
        instr('CLC'),
        instr('ADC', AsmAddressingMode.ZeroPage, 0x50),
        instr('STA', AsmAddressingMode.ZeroPage, 0xFE),
        instr('LDA', AsmAddressingMode.IndirectIndexed, 0xFE),
      ]);

      const result = pass.run(program);

      expect(result.changed).toBe(true);
      expect(countInstructions(result.program)).toBe(2);

      // Should produce LDX $50 (load index into X)
      const ldx = getInstruction(result.program, 0);
      expect(ldx?.mnemonic).toBe('LDX');
      expect(ldx?.mode).toBe(AsmAddressingMode.ZeroPage);
      expect(ldx?.operand).toBe(0x50);

      // Should produce LDA $1000,X (indexed addressing)
      const lda = getInstruction(result.program, 1);
      expect(lda?.mnemonic).toBe('LDA');
      expect(lda?.mode).toBe(AsmAddressingMode.AbsoluteX);
      expect(lda?.operand).toBe(0x1000);
    });

    it('should handle label-based base address', () => {
      const program = createTestProgram([
        instr('LDA', AsmAddressingMode.Absolute, undefined, 'table'),
        instr('CLC'),
        instr('ADC', AsmAddressingMode.ZeroPage, 0x50),
        instr('STA', AsmAddressingMode.ZeroPage, 0xFE),
        instr('LDA', AsmAddressingMode.IndirectIndexed, 0xFE),
      ]);

      const result = pass.run(program);
      expect(result.changed).toBe(true);

      const lda = getInstruction(result.program, 1);
      expect(lda?.mnemonic).toBe('LDA');
      expect(lda?.labelOperand).toBe('table');
      expect(lda?.mode).toBe(AsmAddressingMode.AbsoluteX);
    });

    it('should handle immediate index value (ADC #imm)', () => {
      const program = createTestProgram([
        instr('LDA', AsmAddressingMode.Absolute, 0x2000),
        instr('CLC'),
        instr('ADC', AsmAddressingMode.Immediate, 5),
        instr('STA', AsmAddressingMode.ZeroPage, 0xFE),
        instr('LDA', AsmAddressingMode.IndirectIndexed, 0xFE),
      ]);

      const result = pass.run(program);
      expect(result.changed).toBe(true);

      // LDX #5 (immediate)
      const ldx = getInstruction(result.program, 0);
      expect(ldx?.mnemonic).toBe('LDX');
      expect(ldx?.mode).toBe(AsmAddressingMode.Immediate);
      expect(ldx?.operand).toBe(5);
    });
  });

  // ========================================================================
  // IndexedIndirect pattern (uses Y register)
  // ========================================================================

  describe('computed-address pattern with IndexedIndirect', () => {
    it('should use LDY+LDA,Y for IndexedIndirect (ptr,X) patterns', () => {
      // When the indirect mode is IndexedIndirect (ptr,X), we use Y for the
      // indexed addressing to avoid register conflict
      const program = createTestProgram([
        instr('LDA', AsmAddressingMode.Absolute, 0x3000),
        instr('CLC'),
        instr('ADC', AsmAddressingMode.ZeroPage, 0x40),
        instr('STA', AsmAddressingMode.ZeroPage, 0xFC),
        instr('LDA', AsmAddressingMode.IndexedIndirect, 0xFC),
      ]);

      const result = pass.run(program);
      expect(result.changed).toBe(true);

      // Should use Y register since original used IndexedIndirect (ptr,X)
      const ldy = getInstruction(result.program, 0);
      expect(ldy?.mnemonic).toBe('LDY');

      const lda = getInstruction(result.program, 1);
      expect(lda?.mode).toBe(AsmAddressingMode.AbsoluteY);
    });
  });

  // ========================================================================
  // Safety: Patterns That Must NOT Be Optimized
  // ========================================================================

  describe('safety constraints', () => {
    it('should NOT optimize when STA and indirect LDA use different pointers', () => {
      const program = createTestProgram([
        instr('LDA', AsmAddressingMode.Absolute, 0x1000),
        instr('CLC'),
        instr('ADC', AsmAddressingMode.ZeroPage, 0x50),
        instr('STA', AsmAddressingMode.ZeroPage, 0xFE),
        instr('LDA', AsmAddressingMode.IndirectIndexed, 0xFC), // Different pointer!
      ]);

      const result = pass.run(program);
      expect(result.changed).toBe(false);
    });

    it('should NOT optimize when LDA base uses immediate addressing', () => {
      // Base must be a memory address, not an immediate value
      const program = createTestProgram([
        instr('LDA', AsmAddressingMode.Immediate, 0x10),
        instr('CLC'),
        instr('ADC', AsmAddressingMode.ZeroPage, 0x50),
        instr('STA', AsmAddressingMode.ZeroPage, 0xFE),
        instr('LDA', AsmAddressingMode.IndirectIndexed, 0xFE),
      ]);

      const result = pass.run(program);
      expect(result.changed).toBe(false);
    });

    it('should NOT optimize when second instruction is not CLC', () => {
      const program = createTestProgram([
        instr('LDA', AsmAddressingMode.Absolute, 0x1000),
        instr('SEC'), // SEC instead of CLC
        instr('ADC', AsmAddressingMode.ZeroPage, 0x50),
        instr('STA', AsmAddressingMode.ZeroPage, 0xFE),
        instr('LDA', AsmAddressingMode.IndirectIndexed, 0xFE),
      ]);

      const result = pass.run(program);
      expect(result.changed).toBe(false);
    });

    it('should NOT optimize when final LDA is not indirect', () => {
      const program = createTestProgram([
        instr('LDA', AsmAddressingMode.Absolute, 0x1000),
        instr('CLC'),
        instr('ADC', AsmAddressingMode.ZeroPage, 0x50),
        instr('STA', AsmAddressingMode.ZeroPage, 0xFE),
        instr('LDA', AsmAddressingMode.Absolute, 0xFE), // Absolute, not indirect
      ]);

      const result = pass.run(program);
      expect(result.changed).toBe(false);
    });

    it('should NOT optimize when fewer than 5 instructions remain', () => {
      const program = createTestProgram([
        instr('LDA', AsmAddressingMode.Absolute, 0x1000),
        instr('CLC'),
        instr('ADC', AsmAddressingMode.ZeroPage, 0x50),
        instr('STA', AsmAddressingMode.ZeroPage, 0xFE),
        // Missing 5th instruction
      ]);

      const result = pass.run(program);
      expect(result.changed).toBe(false);
    });
  });

  // ========================================================================
  // Statistics
  // ========================================================================

  describe('statistics', () => {
    it('should report correct stats for a single transformation', () => {
      const program = createTestProgram([
        instr('LDA', AsmAddressingMode.Absolute, 0x1000),
        instr('CLC'),
        instr('ADC', AsmAddressingMode.ZeroPage, 0x50),
        instr('STA', AsmAddressingMode.ZeroPage, 0xFE),
        instr('LDA', AsmAddressingMode.IndirectIndexed, 0xFE),
      ]);

      const result = pass.run(program);
      expect(result.stats?.patternsMatched).toBe(1);
      expect(result.stats?.instructionsRemoved).toBe(5);
      expect(result.stats?.instructionsAdded).toBe(2);
      expect(result.stats?.estimatedBytesSaved).toBe(4);
      expect(result.stats?.estimatedCyclesSaved).toBe(6);
    });

    it('should return no-change result for unoptimizable code', () => {
      const program = createTestProgram([
        instr('LDA', AsmAddressingMode.Immediate, 5),
        instr('STA', AsmAddressingMode.Absolute, 0xD020),
      ]);

      const result = pass.run(program);
      expect(result.changed).toBe(false);
      expect(result.program).toBe(program);
    });
  });

  // ========================================================================
  // Edge Cases
  // ========================================================================

  describe('edge cases', () => {
    it('should handle empty program', () => {
      const program = createTestProgram([]);
      const result = pass.run(program);
      expect(result.changed).toBe(false);
    });

    it('should handle label-based pointer matching', () => {
      const program = createTestProgram([
        instr('LDA', AsmAddressingMode.Absolute, undefined, 'buffer'),
        instr('CLC'),
        instr('ADC', AsmAddressingMode.ZeroPage, 0x50),
        instr('STA', AsmAddressingMode.ZeroPage, undefined, 'ptr'),
        instr('LDA', AsmAddressingMode.IndirectIndexed, undefined, 'ptr'),
      ]);

      const result = pass.run(program);
      expect(result.changed).toBe(true);
      expect(countInstructions(result.program)).toBe(2);
    });

    it('should preserve surrounding instructions', () => {
      const program = createTestProgram([
        instr('NOP'),
        instr('LDA', AsmAddressingMode.Absolute, 0x1000),
        instr('CLC'),
        instr('ADC', AsmAddressingMode.ZeroPage, 0x50),
        instr('STA', AsmAddressingMode.ZeroPage, 0xFE),
        instr('LDA', AsmAddressingMode.IndirectIndexed, 0xFE),
        instr('STA', AsmAddressingMode.Absolute, 0xD020),
      ]);

      const result = pass.run(program);
      expect(result.changed).toBe(true);
      // NOP + LDX + LDA,X + STA = 4 instructions
      expect(countInstructions(result.program)).toBe(4);

      // NOP should still be first
      const nop = getInstruction(result.program, 0);
      expect(nop?.mnemonic).toBe('NOP');

      // STA $D020 should still be last
      const sta = getInstruction(result.program, 3);
      expect(sta?.mnemonic).toBe('STA');
      expect(sta?.operand).toBe(0xD020);
    });
  });
});
