/**
 * RegisterPromotePass Tests
 *
 * Tests for the loop counter register promotion pass.
 * Verifies that INC/DEC memory operations in loops are promoted to
 * INX/DEX (or INY/DEY) when registers are available, including
 * associated LDA→TXA and CMP→CPX transformations.
 *
 * @module __tests__/codegen/asm-il/optimizer/passes/register-promote
 */

import { describe, it, expect } from 'vitest';
import { RegisterPromotePass } from '../../../../../codegen/asm-il/optimizer/passes/register-promote.js';
import {
  AsmAddressingMode,
  createAsmILProgram,
  createInstructionElement,
  createLabelElement,
  createCommentElement,
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

/** Get all instructions from the first section as an array */
function getInstructions(program: AsmILProgram) {
  return program.sections[0].elements
    .filter(isInstructionElement)
    .map(el => el.instruction);
}

/** Count instructions with a specific mnemonic */
function countMnemonic(program: AsmILProgram, mnemonic: string): number {
  return getInstructions(program).filter(i => i.mnemonic === mnemonic).length;
}

// ============================================================================
// Tests
// ============================================================================

describe('RegisterPromotePass', () => {
  const pass = new RegisterPromotePass();

  // ========================================================================
  // Basic Properties
  // ========================================================================

  describe('pass properties', () => {
    it('should have the name "register-promote"', () => {
      expect(pass.name).toBe('register-promote');
    });

    it('should be a transform pass', () => {
      expect(pass.isTransform).toBe(true);
    });
  });

  // ========================================================================
  // INC → INX Promotion
  // ========================================================================

  describe('INC addr → INX promotion', () => {
    it('should promote INC $50 → INX when X is free in loop', () => {
      // A simple loop: label, LDA counter, INC counter, BNE back
      const program = createTestProgram([
        createLabelElement('.loop', true),
        instr('LDA', AsmAddressingMode.ZeroPage, 0x50),
        instr('INC', AsmAddressingMode.ZeroPage, 0x50),
        instr('BNE', AsmAddressingMode.Relative, undefined, '.loop'),
      ]);

      const result = pass.run(program);

      expect(result.changed).toBe(true);

      const instrs = getInstructions(result.program);
      const mnemonics = instrs.map(i => i.mnemonic);

      // Should have LDX before loop, TXA inside, INX inside, STX after
      expect(mnemonics).toContain('LDX');
      expect(mnemonics).toContain('TXA');
      expect(mnemonics).toContain('INX');
      expect(mnemonics).toContain('STX');

      // Should NOT contain INC $50 anymore
      expect(countMnemonic(result.program, 'INC')).toBe(0);
      // Should NOT contain LDA $50 anymore (replaced with TXA)
      const ldasWithAddr = instrs.filter(
        i => i.mnemonic === 'LDA' && i.operand === 0x50
      );
      expect(ldasWithAddr.length).toBe(0);
    });

    it('should use absolute addressing for addresses > 0xFF', () => {
      const program = createTestProgram([
        createLabelElement('.loop', true),
        instr('INC', AsmAddressingMode.Absolute, 0x1000),
        instr('BNE', AsmAddressingMode.Relative, undefined, '.loop'),
      ]);

      const result = pass.run(program);
      expect(result.changed).toBe(true);

      const instrs = getInstructions(result.program);
      const ldx = instrs.find(i => i.mnemonic === 'LDX');
      expect(ldx?.mode).toBe(AsmAddressingMode.Absolute);
      expect(ldx?.operand).toBe(0x1000);
    });
  });

  // ========================================================================
  // DEC → DEX Promotion
  // ========================================================================

  describe('DEC addr → DEX promotion', () => {
    it('should promote DEC $50 → DEX when X is free in loop', () => {
      const program = createTestProgram([
        createLabelElement('.loop', true),
        instr('LDA', AsmAddressingMode.ZeroPage, 0x50),
        instr('DEC', AsmAddressingMode.ZeroPage, 0x50),
        instr('BNE', AsmAddressingMode.Relative, undefined, '.loop'),
      ]);

      const result = pass.run(program);
      expect(result.changed).toBe(true);

      expect(countMnemonic(result.program, 'DEX')).toBe(1);
      expect(countMnemonic(result.program, 'DEC')).toBe(0);
    });
  });

  // ========================================================================
  // Y Register Fallback
  // ========================================================================

  describe('Y register fallback', () => {
    it('should promote to Y when X is already used in loop', () => {
      // Loop body uses X (STX), so Y should be used instead
      const program = createTestProgram([
        createLabelElement('.loop', true),
        instr('STX', AsmAddressingMode.ZeroPage, 0x60), // X is used
        instr('INC', AsmAddressingMode.ZeroPage, 0x50),
        instr('BNE', AsmAddressingMode.Relative, undefined, '.loop'),
      ]);

      const result = pass.run(program);
      expect(result.changed).toBe(true);

      const instrs = getInstructions(result.program);
      // Should use Y register variants
      expect(instrs.some(i => i.mnemonic === 'LDY')).toBe(true);
      expect(instrs.some(i => i.mnemonic === 'INY')).toBe(true);
      expect(instrs.some(i => i.mnemonic === 'STY')).toBe(true);
    });
  });

  // ========================================================================
  // Safety: Skip Cases
  // ========================================================================

  describe('safety constraints', () => {
    it('should NOT promote when both X and Y are used in loop', () => {
      const program = createTestProgram([
        createLabelElement('.loop', true),
        instr('STX', AsmAddressingMode.ZeroPage, 0x60), // X is used
        instr('STY', AsmAddressingMode.ZeroPage, 0x61), // Y is used
        instr('INC', AsmAddressingMode.ZeroPage, 0x50),
        instr('BNE', AsmAddressingMode.Relative, undefined, '.loop'),
      ]);

      const result = pass.run(program);
      expect(result.changed).toBe(false);
    });

    it('should NOT promote when loop contains JSR', () => {
      const program = createTestProgram([
        createLabelElement('.loop', true),
        instr('INC', AsmAddressingMode.ZeroPage, 0x50),
        instr('JSR', AsmAddressingMode.Absolute, 0x1000, 'subroutine'),
        instr('BNE', AsmAddressingMode.Relative, undefined, '.loop'),
      ]);

      const result = pass.run(program);
      expect(result.changed).toBe(false);
    });

    it('should NOT promote when INC/DEC uses unsupported addressing mode', () => {
      // ZeroPageX is not supported for promotion
      const program = createTestProgram([
        createLabelElement('.loop', true),
        instr('INC', AsmAddressingMode.ZeroPageX, 0x50),
        instr('BNE', AsmAddressingMode.Relative, undefined, '.loop'),
      ]);

      const result = pass.run(program);
      expect(result.changed).toBe(false);
    });

    it('should NOT promote when there are multiple INC/DEC to same address', () => {
      // Two INC to same addr → complex pattern, skip
      const program = createTestProgram([
        createLabelElement('.loop', true),
        instr('INC', AsmAddressingMode.ZeroPage, 0x50),
        instr('INC', AsmAddressingMode.ZeroPage, 0x50),
        instr('BNE', AsmAddressingMode.Relative, undefined, '.loop'),
      ]);

      const result = pass.run(program);
      expect(result.changed).toBe(false);
    });
  });

  // ========================================================================
  // CMP Replacement
  // ========================================================================

  describe('CMP addr → CPX replacement', () => {
    it('should replace CMP of counter address with CPX', () => {
      // Pattern: LDA counter, CMP counter, BNE loop
      // After: counter in X, the CMP $50 should become CPX $50
      const program = createTestProgram([
        createLabelElement('.loop', true),
        instr('LDA', AsmAddressingMode.ZeroPage, 0x50),
        instr('CMP', AsmAddressingMode.ZeroPage, 0x50),
        instr('INC', AsmAddressingMode.ZeroPage, 0x50),
        instr('BNE', AsmAddressingMode.Relative, undefined, '.loop'),
      ]);

      const result = pass.run(program);
      expect(result.changed).toBe(true);

      const instrs = getInstructions(result.program);
      // CMP $50 should be replaced with CPX $50
      expect(instrs.some(i => i.mnemonic === 'CPX')).toBe(true);
      const cmpToAddr = instrs.filter(
        i => i.mnemonic === 'CMP' && i.operand === 0x50
      );
      expect(cmpToAddr.length).toBe(0);
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

    it('should handle section with no loops', () => {
      const program = createTestProgram([
        instr('LDA', AsmAddressingMode.Immediate, 5),
        instr('STA', AsmAddressingMode.Absolute, 0xD020),
      ]);

      const result = pass.run(program);
      expect(result.changed).toBe(false);
      expect(result.program).toBe(program); // Same reference
    });

    it('should handle forward branch (not a loop)', () => {
      // BNE to a label that comes AFTER the branch → not a loop
      const program = createTestProgram([
        instr('INC', AsmAddressingMode.ZeroPage, 0x50),
        instr('BNE', AsmAddressingMode.Relative, undefined, '.skip'),
        instr('NOP'),
        createLabelElement('.skip', true),
      ]);

      const result = pass.run(program);
      expect(result.changed).toBe(false);
    });

    it('should preserve comments in loop body', () => {
      const program = createTestProgram([
        createLabelElement('.loop', true),
        createCommentElement('loop body'),
        instr('INC', AsmAddressingMode.ZeroPage, 0x50),
        instr('BNE', AsmAddressingMode.Relative, undefined, '.loop'),
      ]);

      const result = pass.run(program);
      expect(result.changed).toBe(true);

      // Comment should still be present
      const hasComment = result.program.sections[0].elements.some(
        el => el.kind === 'comment'
      );
      expect(hasComment).toBe(true);
    });
  });

  // ========================================================================
  // Statistics
  // ========================================================================

  describe('statistics', () => {
    it('should report correct stats for a promotion', () => {
      const program = createTestProgram([
        createLabelElement('.loop', true),
        instr('LDA', AsmAddressingMode.ZeroPage, 0x50),
        instr('INC', AsmAddressingMode.ZeroPage, 0x50),
        instr('BNE', AsmAddressingMode.Relative, undefined, '.loop'),
      ]);

      const result = pass.run(program);
      expect(result.changed).toBe(true);
      // INC→INX = 1 pattern, LDA→TXA = 1 pattern → 2 patterns matched
      expect(result.stats.patternsMatched).toBe(2);
      // LDX + STX = 2 instructions added
      expect(result.stats.instructionsAdded).toBe(2);
      expect(result.stats.estimatedCyclesSaved).toBeGreaterThan(0);
      expect(result.stats.estimatedBytesSaved).toBeGreaterThan(0);
    });

    it('should return unchanged result when no promotion possible', () => {
      const program = createTestProgram([
        instr('LDA', AsmAddressingMode.Immediate, 5),
        instr('RTS'),
      ]);

      const result = pass.run(program);
      expect(result.changed).toBe(false);
      expect(result.program).toBe(program);
    });
  });
});
